// Tests du Lot 8 — ressources de classe, coûts et rééquilibrage des compétences.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { startCombat, resolveRound, playerCanUse, whyCannotUse } from "../js/systems/combat.js";
import { CLASS_RESOURCES, getClassResource } from "../js/data/classResources.js";
import { SKILLS, getSkill } from "../js/data/skills.js";
import { CLASSES } from "../js/data/classes.js";
import { specsForClass } from "../js/data/specializations.js";
import { withSeed } from "./helpers.js";

function readyState(classId = "warrior") {
  const s = newGame("Héros", classId);
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

test("chaque classe jouable possède une ressource cohérente (start ≤ max)", () => {
  for (const id of Object.keys(CLASSES)) {
    const r = getClassResource(id);
    assert.ok(r, `${id} doit avoir une ressource de classe`);
    assert.ok(r.max > 0, `${id} : max > 0`);
    assert.ok(r.start <= r.max, `${id} : start ≤ max`);
    assert.ok(typeof r.name === "string" && r.name.length, `${id} : nom`);
  }
});

test("le joueur démarre le combat avec sa ressource ; l'ennemi n'en a pas", () => {
  for (const id of Object.keys(CLASSES)) {
    const s = readyState(id);
    const c = startCombat(s, "feral_wolf");
    const def = getClassResource(id);
    assert.ok(c.player.res, `${id} : le joueur a une ressource`);
    assert.equal(c.player.res.cur, Math.min(def.max, def.start));
    assert.equal(c.player.res.max, def.max);
    assert.equal(c.enemy.res, null, "l'ennemi n'a pas de ressource (rétrocompat)");
  }
});

test("l'attaque de base génère de la ressource (la Rage du Guerrier monte)", () => {
  withSeed(11, () => {
    const s = readyState("warrior");
    const c = startCombat(s, "feral_wolf");
    // On part en dessous du plafond pour observer le gain (le départ exact est
    // un paramètre d'équilibrage, on ne le code donc pas en dur ici).
    c.player.res.cur = 0;
    c.enemy.nextAt = 1e9; // isole le gain d'ouverture (pas de contre-attaque)
    resolveRound(s, c, "basic_attack");
    assert.ok(c.player.res.cur > 0, "la Rage doit monter après une attaque de base");
    assert.ok(c.player.res.cur <= c.player.res.max, "jamais au-dessus du plafond");
  });
});

test("une compétence coûteuse est verrouillée sans ressource puis se débloque", () => {
  const s = readyState("warrior");
  const c = startCombat(s, "feral_wolf");
  // war_cry coûte 30 ; la Rage démarre à 0 -> indisponible pour cause de ressource.
  assert.equal(whyCannotUse(c, "war_cry"), "resource");
  assert.equal(playerCanUse(c, "war_cry"), false);
  // On remplit la ressource : la compétence devient utilisable.
  c.player.res.cur = c.player.res.max;
  assert.equal(whyCannotUse(c, "war_cry"), null);
  assert.equal(playerCanUse(c, "war_cry"), true);
});

test("lancer une compétence déduit son coût en ressource", () => {
  withSeed(5, () => {
    const s = readyState("warrior");
    const c = startCombat(s, "feral_wolf");
    c.player.res.cur = 100;
    // On empêche l'ennemi d'agir ce tour pour isoler le coût (sinon « onTakeDamage »
    // viendrait fausser le solde) : son initiative est repoussée loin.
    c.enemy.nextAt = 1e9;
    const cost = getSkill("heavy_strike").cost;
    resolveRound(s, c, "heavy_strike");
    // Coût déduit, puis un petit gain « onDealDamage » (la frappe a touché).
    const gen = CLASS_RESOURCES.warrior;
    assert.equal(c.player.res.cur, Math.min(100, 100 - cost + gen.onDealDamage));
  });
});

test("l'attaque de base reste toujours disponible (coût 0, recharge 0)", () => {
  for (const id of Object.keys(CLASSES)) {
    const s = readyState(id);
    const c = startCombat(s, "feral_wolf");
    c.player.res.cur = 0; // à sec
    assert.equal(playerCanUse(c, "basic_attack"), true, `${id} : attaque de base toujours jouable`);
  }
});

test("le Mana du Mage se régénère au fil des tours", () => {
  withSeed(9, () => {
    const s = readyState("mage");
    const c = startCombat(s, "feral_wolf");
    // On vide le mana puis on joue : il doit remonter (regenPerTurn).
    c.player.res.cur = 0;
    const before = c.player.res.cur;
    resolveRound(s, c, "basic_attack"); // déclenche un upkeep
    assert.ok(c.player.res.cur > before, "le Mana doit se régénérer");
  });
});

test("la ressource ne dépasse jamais le plafond ni ne passe sous zéro", () => {
  withSeed(21, () => {
    const s = readyState("assassin");
    const c = startCombat(s, "feral_wolf");
    let guard = 0;
    while (c.status === "active" && guard < 200) {
      const skill = c.player.skills.find((id) => playerCanUse(c, id)) || "basic_attack";
      resolveRound(s, c, skill);
      assert.ok(c.player.res.cur >= 0, "jamais négatif");
      assert.ok(c.player.res.cur <= c.player.res.max, "jamais au-dessus du plafond");
      guard++;
    }
  });
});

test("un combat complet se résout en respectant les coûts de ressource", () => {
  withSeed(42, () => {
    const s = readyState("mage");
    const c = startCombat(s, "feral_wolf");
    let guard = 0;
    while (c.status === "active" && guard < 300) {
      const skill = c.player.skills.find((id) => playerCanUse(c, id)) || "basic_attack";
      resolveRound(s, c, skill);
      guard++;
    }
    assert.notEqual(c.status, "active", "le combat doit se terminer");
  });
});

test("INTÉGRITÉ : toute compétence active de joueur a un coût atteignable (≤ max)", () => {
  // Compétences accessibles à un joueur : classe + spécialisations.
  const playerSkillIds = new Set();
  for (const id of Object.keys(CLASSES)) {
    const cls = CLASSES[id];
    const max = getClassResource(id).max;
    const ids = ["basic_attack", ...cls.skills];
    for (const sp of specsForClass(id)) for (const g of sp.grants || []) ids.push(g);
    for (const sid of ids) {
      playerSkillIds.add(sid);
      const s = getSkill(sid);
      assert.ok(s, `${sid} doit exister`);
      const cost = s.cost || 0;
      assert.ok(cost <= max, `${sid} : coût ${cost} doit être ≤ au plafond ${max} de ${id}`);
      assert.ok(cost >= 0, `${sid} : coût ≥ 0`);
    }
  }
  // L'attaque de base est gratuite.
  assert.equal(SKILLS.basic_attack.cost, 0);
});

test("INTÉGRITÉ : les compétences d'ennemis n'ont pas de coût (pas de ressource)", () => {
  const enemyOnly = ["feral_bite", "goblin_smash", "boar_charge", "bandit_shiv", "boss_cleave", "boss_quake"];
  for (const id of enemyOnly) {
    const s = getSkill(id);
    assert.ok(!s.cost, `${id} : une compétence d'ennemi ne doit pas coûter de ressource`);
  }
});
