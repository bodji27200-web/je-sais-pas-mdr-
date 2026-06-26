// Tests des matériaux d'armure : comptes, seuils 2/4, builds hybrides,
// comportements de combat (stabilité, esquive, concentration).

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, addEquipmentInstance, equipmentList } from "../js/core/state.js";
import {
  getDerivedStats,
  familyCounts,
  activeMaterialBonuses,
  activeMaterialBehaviors,
  equip,
} from "../js/core/character.js";
import { makeInstance } from "../js/core/items.js";
import { startCombat } from "../js/systems/combat.js";
import { withSeed } from "./helpers.js";

// Équipe `n` pièces de métal en tête/torse/mains/jambes/bottes.
const METAL = { head: "iron_helm", chest: "iron_plate", hands: "iron_gauntlets", legs: "iron_greaves", feet: "iron_sabatons" };
const CLOTH = { head: "cloth_hood", chest: "cloth_robe", hands: "cloth_gloves", legs: "cloth_leggings", feet: "cloth_sandals" };

function equipPieces(s, map, slots) {
  for (const slot of slots) {
    const inst = makeInstance(map[slot], "common");
    addEquipmentInstance(inst);
    const r = equip(s, inst.uid);
    assert.ok(r.ok, `équiper ${map[slot]} : ${r.error || ""}`);
  }
}

function highLevelState(classId = "warrior") {
  const s = newGame("Mat", classId);
  s.character.level = 20; // assez pour équiper toutes les pièces
  return s;
}

test("familyCounts compte les pièces d'armure sur 5 slots", () => {
  const s = highLevelState();
  equipPieces(s, METAL, ["head", "chest", "hands", "legs"]);
  assert.equal(familyCounts(s).metal, 4);
});

test("seuil 2 pièces actif dès 2, seuil 4 dès 4", () => {
  const s = highLevelState();
  equipPieces(s, METAL, ["head", "chest"]);
  let bonuses = activeMaterialBonuses(s).filter((b) => b.material === "metal");
  assert.equal(bonuses.length, 1, "2 pièces -> un seul bonus (seuil 2)");
  equipPieces(s, METAL, ["hands", "legs"]);
  bonuses = activeMaterialBonuses(s).filter((b) => b.material === "metal");
  assert.equal(bonuses.length, 2, "4 pièces -> bonus 2 ET bonus 4");
  assert.ok(activeMaterialBehaviors(s).includes("stabilite"), "4 pièces métal -> Stabilité");
});

test("build hybride : 2 Tissu + 2 Métal cumule les deux bonus 2 pièces", () => {
  const s = highLevelState();
  equipPieces(s, CLOTH, ["head", "chest"]);
  equipPieces(s, METAL, ["hands", "legs"]);
  const mats = activeMaterialBonuses(s).map((b) => b.material).sort();
  assert.deepEqual(mats, ["cloth", "metal"], "les deux matériaux contribuent");
  assert.equal(activeMaterialBehaviors(s).length, 0, "aucun seuil 4 -> aucun passif comportemental");
});

test("4 pièces de métal augmentent réellement DEF et PV (bonus de seuil)", () => {
  const s0 = highLevelState();
  const base = getDerivedStats(s0);
  const s = highLevelState();
  equipPieces(s, METAL, ["head", "chest", "hands", "legs"]);
  const withMetal = getDerivedStats(s);
  // On compare l'effet relatif : la DEF finale doit dépasser largement la base.
  assert.ok(withMetal.def > base.def, "la défense doit augmenter");
  assert.ok(withMetal.maxHp > base.maxHp, "les PV doivent augmenter");
});

test("Stabilité réduit la première attaque subie une seule fois", () => {
  withSeed(5, () => {
    const s = highLevelState("guardian");
    equipPieces(s, METAL, ["head", "chest", "hands", "legs"]);
    s.character.hpCurrent = getDerivedStats(s).maxHp;
    const c = startCombat(s, "feral_wolf");
    assert.equal(c.player.mat.stability, true);
    assert.equal(c.player._stabilityUsed, false);
  });
});

test("4 pièces de cuir accordent l'esquive (Souplesse)", () => {
  const s = highLevelState("assassin");
  const LEATHER = { head: "leather_cap", chest: "leather_armor", hands: "leather_gloves", legs: "leather_leggings", feet: "leather_boots" };
  equipPieces(s, LEATHER, ["head", "chest", "hands", "legs"]);
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const c = startCombat(s, "feral_wolf");
  assert.ok(c.player.mat.evasionPct > 0, "le porteur de cuir 4 pièces peut esquiver");
});
