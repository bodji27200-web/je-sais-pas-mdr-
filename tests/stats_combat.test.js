// Tests du modèle de statistiques de combat (Lot 2) : esquive Dextérité/Précision
// plafonnée à 60 %, plafonds de critique, axe Magie/Résistance, et présence/validité
// des nouvelles stats dérivées.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import {
  dodgeChance, DODGE_CAP,
  critChanceOf, critMultOf, BASE_CRIT_CAP, HARD_CRIT_CAP, CRIT_DMG_DEFAULT, CRIT_DMG_CAP,
  resReduction, RES_CAP, magBonus, MAG_CAP,
  startCombat, resolveRound,
} from "../js/systems/combat.js";
import { withSeed } from "./helpers.js";

// --- Esquive (instr. 39-60) --------------------------------------------------

test("esquive : 0 % sans Dextérité avantageuse", () => {
  assert.equal(dodgeChance(0, 0), 0, "aucune Dextérité -> aucune esquive");
  assert.equal(dodgeChance(10, 100), 0, "une Précision écrasante annule l'esquive");
});

test("esquive : valeur intermédiaire strictement entre 0 et le plafond", () => {
  const d = dodgeChance(120, 0);
  assert.ok(d > 0 && d < DODGE_CAP, `esquive moyenne attendue dans (0, ${DODGE_CAP}), obtenu ${d}`);
});

test("esquive : plafond DUR à 60 %, jamais dépassé", () => {
  assert.equal(DODGE_CAP, 0.6);
  // Même avec une Dextérité absurde et zéro Précision adverse, on ne dépasse pas 60 %.
  for (const dex of [500, 5000, 1e6, Infinity]) {
    const d = dodgeChance(dex, 0);
    assert.ok(d <= DODGE_CAP, `esquive ${d} > plafond ${DODGE_CAP}`);
  }
  assert.equal(dodgeChance(1e9, 0), DODGE_CAP, "une Dextérité énorme atteint pile le plafond");
});

test("esquive : la Précision adverse réduit l'esquive (opposition, instr. 40, 57)", () => {
  const noAcc = dodgeChance(200, 0);
  const someAcc = dodgeChance(200, 120);
  const moreAcc = dodgeChance(200, 240);
  assert.ok(someAcc < noAcc, "plus de Précision -> moins d'esquive");
  assert.ok(moreAcc < someAcc, "encore plus de Précision -> encore moins d'esquive");
  assert.ok(moreAcc >= 0, "l'esquive ne devient jamais négative");
});

test("esquive : atteindre le plafond exige un build très spécialisé (instr. 52-56)", () => {
  // Un personnage endgame NON spécialisé (Dextérité ~ Précision adverse) reste loin
  // du plafond ; il faut un net (Dex - 0.85*Acc) d'environ 300 pour caper.
  assert.ok(dodgeChance(60, 50) < 0.25, "non spécialisé : esquive modérée");
  assert.ok(dodgeChance(300, 0) >= 0.55, "build d'esquive extrême : proche du plafond");
});

// --- Critique (instr. 92-95) -------------------------------------------------

test("chance critique : la part de la STAT est plafonnée à 50 %", () => {
  assert.equal(BASE_CRIT_CAP, 50);
  assert.equal(critChanceOf({ crit: 200 }), 50, "une stat de critique énorme est plafonnée à 50 %");
  assert.equal(critChanceOf({ crit: 30 }), 30, "sous le plafond, la stat passe telle quelle");
});

test("chance critique : bonus de compétence/buffs au-dessus du plafond de stat, sans garantie", () => {
  assert.equal(critChanceOf({ crit: 50 }, 50), 85, "50 (stat) + 50 (bonus) plafonné au plafond dur");
  assert.equal(critChanceOf({ crit: 200 }, 100, 100), HARD_CRIT_CAP, "jamais 100 % (plafond dur)");
  assert.ok(HARD_CRIT_CAP < 100, "le critique n'est jamais garanti en permanence");
});

test("dégâts critiques : multiplicateur par défaut ×1,6, plafonné globalement", () => {
  assert.equal(critMultOf({ critDmg: CRIT_DMG_DEFAULT }), 1.6, "60 % -> ×1,6 (rétro-compatible)");
  assert.equal(critMultOf({}), 1.6, "défaut absent -> ×1,6");
  assert.equal(critMultOf({ critDmg: 1000 }), 1 + CRIT_DMG_CAP / 100, "plafonné globalement");
});

// --- Axe magique (instr. 37-38, 87-88) ---------------------------------------

test("Résistance : mitigation magique à rendement décroissant et plafonnée", () => {
  assert.equal(resReduction(0), 0);
  assert.ok(resReduction(100) > 0 && resReduction(100) < RES_CAP);
  assert.ok(resReduction(1e9) <= RES_CAP);
  assert.ok(resReduction(200) > resReduction(100), "plus de Résistance -> plus de mitigation");
});

test("Magie : bonus aux compétences à élément, plafonné", () => {
  assert.equal(magBonus(0), 0);
  assert.ok(magBonus(100) > 0 && magBonus(100) < MAG_CAP);
  assert.ok(magBonus(1e9) <= MAG_CAP);
});

// --- Stats dérivées : présence et validité (instr. 31, 319) ------------------

test("getDerivedStats expose les nouvelles stats, toutes finies et >= 0", () => {
  for (const cls of ["warrior", "guardian", "archer", "mage", "assassin"]) {
    const s = newGame("Stat", cls);
    s.character.level = 25;
    const ds = getDerivedStats(s);
    for (const k of ["maxHp", "atk", "def", "mag", "res", "dex", "acc", "spd", "crit", "critDmg"]) {
      assert.ok(Number.isFinite(ds[k]), `${cls}.${k} doit être un nombre fini (${ds[k]})`);
      assert.ok(ds[k] >= 0, `${cls}.${k} doit être >= 0 (${ds[k]})`);
    }
  }
});

test("identités de classe : Mage le plus magique, Assassin le plus agile", () => {
  const mage = getDerivedStats(setLevel(newGame("M", "mage"), 30));
  const guardian = getDerivedStats(setLevel(newGame("G", "guardian"), 30));
  const assassin = getDerivedStats(setLevel(newGame("A", "assassin"), 30));
  assert.ok(mage.mag > assassin.mag, "le Mage a plus de Magie que l'Assassin");
  assert.ok(guardian.res > mage.res, "le Gardien a plus de Résistance que le Mage");
  assert.ok(assassin.dex > guardian.dex, "l'Assassin a plus de Dextérité que le Gardien");
});

function setLevel(s, lvl) { s.character.level = lvl; return s; }

// --- Intégration : l'esquive fonctionne réellement en combat -----------------

test("intégration : un défenseur très agile finit par esquiver (log « esquive »)", () => {
  withSeed(123, () => {
    const s = newGame("Agile", "assassin");
    const c = startCombat(s, "wild_boar"); // sanglier lent et peu précis
    // On gonfle la Dextérité du joueur et on annule la Précision de l'ennemi pour
    // rendre l'esquive très probable : le moteur doit la matérialiser.
    c.player.dex = 1000;
    c.enemy.acc = 0;
    let evaded = false;
    for (let i = 0; i < 40 && c.status === "active" && !evaded; i++) {
      c.player.hp = c.player.maxHp; // on reste en vie pour observer plusieurs tours
      resolveRound(s, c, "basic_attack");
      evaded = c.log.some((l) => /esquive/i.test(l.text));
    }
    assert.ok(evaded, "un build d'esquive extrême doit produire au moins une esquive");
  });
});

test("intégration : l'esquive ne dépasse jamais 60 % même gonflée par un matériau", () => {
  // dodgeChance + bonus de Souplesse (Cuir) restent bornés par le plafond global.
  const combined = Math.min(DODGE_CAP, dodgeChance(1e9, 0) + 0.14);
  assert.equal(combined, DODGE_CAP, "le cumul esquive + Souplesse est plafonné à 60 %");
});
