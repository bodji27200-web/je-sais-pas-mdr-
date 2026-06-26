// Tests du Lot 11 — familiers : éclosion, doublons->essence, équipement, lien,
// XP plafonnée, passif en combat, migration de sauvegarde.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, SAVE_VERSION } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { startCombat } from "../js/systems/combat.js";
import {
  ensureFamiliars, rollFamiliar, hatchEgg, equipFamiliar, feedFamiliar,
  gainEquippedFamiliarXp, familiarLevelCap, effectiveFamiliarPassive, addEgg,
} from "../js/systems/familiars.js";
import { FAMILIARS, getFamiliar, EGGS, FEED_ESSENCE_COST, LINK_MAX } from "../js/data/familiars.js";
import { withSeed, approxEqual } from "./helpers.js";

function fresh() {
  const s = newGame("Dompteur", "mage");
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

test("nouvelle partie : structure familiers initialisée + œuf commun offert", () => {
  const s = fresh();
  assert.ok(s.familiars, "familiars présent");
  assert.equal(s.familiars.eggs.common, 1, "un œuf commun de départ");
  assert.equal(s.familiars.equipped, null);
  assert.equal(s.familiars.essence, 0);
});

test("rollFamiliar respecte les poids de rareté de l'œuf (grand volume)", () => {
  const N = 40000;
  withSeed(123, () => {
    const counts = {};
    for (let i = 0; i < N; i++) {
      const id = rollFamiliar("rare");
      const r = getFamiliar(id).rarity;
      counts[r] = (counts[r] || 0) + 1;
    }
    // Œuf rare : { uncommon:55, rare:40, epic:5 }.
    approxEqual((counts.uncommon || 0) / N, 0.55, 0.03, "part inhabituel");
    approxEqual((counts.rare || 0) / N, 0.40, 0.03, "part rare");
    approxEqual((counts.epic || 0) / N, 0.05, 0.02, "part épique");
  });
});

test("faire éclore un nouvel œuf ajoute un familier ; le premier est équipé", () => {
  withSeed(4, () => {
    const s = fresh();
    const r = hatchEgg(s, "common");
    assert.equal(r.ok, true);
    assert.equal(r.duplicate, false);
    assert.ok(s.familiars.owned[r.id], "familier ajouté à la collection");
    assert.equal(s.familiars.equipped, r.id, "premier familier équipé d'office");
    assert.equal(s.familiars.eggs.common, 0, "œuf consommé");
  });
});

test("un doublon est converti en Essence (pas de familier perdu)", () => {
  const s = fresh();
  // On possède déjà ce familier -> nouvel exemplaire = essence.
  s.familiars.owned["pebble_mite"] = { level: 1, xp: 0, link: 0 };
  addEgg(s, "common", 1);
  withSeed(0, () => {
    // Force le tirage sur un familier commun déjà possédé en ne gardant que lui.
    // (On vérifie surtout la mécanique doublon -> essence via un id connu.)
  });
  // Mécanique directe : simuler un doublon.
  const before = s.familiars.essence;
  // hatch jusqu'à retomber sur un doublon connu, sinon on teste la voie doublon
  // déterministe en pré-remplissant toute la collection.
  for (const id of Object.keys(FAMILIARS)) s.familiars.owned[id] = s.familiars.owned[id] || { level: 1, xp: 0, link: 0 };
  addEgg(s, "epic", 1);
  const r = withSeed(2, () => hatchEgg(s, "epic"));
  assert.equal(r.ok, true);
  assert.equal(r.duplicate, true, "tout est déjà possédé -> doublon");
  assert.ok(r.essenceGain > 0, "essence gagnée");
  assert.equal(s.familiars.essence, before + r.essenceGain);
});

test("équiper bascule l'équipement ; nourrir consomme de l'essence et monte le lien", () => {
  const s = fresh();
  s.familiars.owned["ember_sprite"] = { level: 1, xp: 0, link: 0 };
  assert.equal(equipFamiliar(s, "ember_sprite").ok, true);
  assert.equal(s.familiars.equipped, "ember_sprite");
  equipFamiliar(s, "ember_sprite"); // re-clic -> déséquipe
  assert.equal(s.familiars.equipped, null);

  // Nourrir : sans essence -> refus ; avec essence -> +1 lien.
  assert.equal(feedFamiliar(s, "ember_sprite").ok, false);
  s.familiars.essence = FEED_ESSENCE_COST;
  const fr = feedFamiliar(s, "ember_sprite");
  assert.equal(fr.ok, true);
  assert.equal(s.familiars.owned["ember_sprite"].link, 1);
  assert.equal(s.familiars.essence, 0);
});

test("l'XP du familier est plafonnée au niveau du héros", () => {
  const s = fresh();
  s.character.level = 3;
  s.familiars.owned["spark_mote"] = { level: 1, xp: 0, link: 0 };
  s.familiars.equipped = "spark_mote";
  // Énorme XP : le familier ne doit pas dépasser le niveau du héros (3).
  gainEquippedFamiliarXp(s, 100000);
  assert.equal(s.familiars.owned["spark_mote"].level, familiarLevelCap(s));
  assert.ok(s.familiars.owned["spark_mote"].level <= s.character.level);
});

test("le passif du familier équipé s'applique au héros en combat (soutien léger)", () => {
  const s = fresh();
  // Sans familier : crit de référence.
  const cNo = startCombat(s, "feral_wolf");
  const baseCrit = cNo.player.crit;
  const baseMax = cNo.player.maxHp;

  // Avec un familier qui donne crit + PV max + synergie d'élément.
  s.familiars.owned["dawn_seraph"] = { level: 5, xp: 0, link: 0 };
  s.familiars.equipped = "dawn_seraph"; // critFlat +2, hpRegen, lifesteal
  s.familiars.owned["pebble_mite"] = { level: 1, xp: 0, link: 0 };
  // pebble n'est pas équipé ; on teste dawn_seraph (crit+2).
  const cYes = startCombat(s, "feral_wolf");
  assert.ok(cYes.player.crit >= baseCrit + 2, "le crit du familier s'applique");
  assert.ok(cYes.player.familiar && cYes.player.familiar.id === "dawn_seraph", "familier attaché au combat");

  // Un familier à PV max applique le bonus.
  s.familiars.equipped = "pebble_mite"; // maxHpPct +4 %
  const cHp = startCombat(s, "feral_wolf");
  assert.ok(cHp.player.maxHp > baseMax, "le PV max du familier s'applique");
});

test("migration v7 -> v8 : familiers initialisés sans rien casser", () => {
  // Simule une vieille sauvegarde v7 (sans familiers) via le mécanisme interne.
  const s = fresh();
  // On retire les familiers et on rabaisse la version comme une save v7.
  const v7 = JSON.parse(JSON.stringify(s));
  delete v7.familiars;
  v7.version = 7;
  // ensureFamiliars (appelé partout) doit poser une structure saine.
  const f = ensureFamiliars(v7);
  assert.ok(f.owned && f.eggs && typeof f.essence === "number");
  assert.equal(SAVE_VERSION >= 8, true);
});
