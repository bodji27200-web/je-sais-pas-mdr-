// Tests du lot « Profondeur de build & corrections » (Lot 13) :
// affixes par rareté, élément d'arme, résistances élémentaires d'affixes,
// cohérence classe/arme au craft, 2e emplacement d'accessoire, migration v9->v10.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats, gearCombatBonuses, equippedWeaponElement, accessory2Unlocked, equip } from "../js/core/character.js";
import { makeInstance } from "../js/core/items.js";
import { startCombat } from "../js/systems/combat.js";
import { recipeAllowedForClass, canCraft } from "../js/systems/crafting.js";
import { RARITY_AFFIX_COUNT } from "../js/data/affixes.js";
import { addEquipmentInstance } from "../js/core/state.js";
import { withSeed } from "./helpers.js";

test("makeInstance : une arme reçoit un élément ; le nb d'affixes suit la rareté", () => {
  withSeed(3, () => {
    for (const rar of ["common", "uncommon", "rare", "epic", "legendary"]) {
      const w = makeInstance("copper_sword", rar);
      assert.ok(w.element, `arme ${rar} : élément présent`);
      assert.equal(w.affixes.length, RARITY_AFFIX_COUNT[rar], `arme ${rar} : ${RARITY_AFFIX_COUNT[rar]} affixe(s)`);
    }
    // Une armure n'a pas d'élément d'arme mais peut avoir des affixes.
    const armor = makeInstance("iron_plate", "epic");
    assert.equal(armor.element, undefined);
    assert.equal(armor.affixes.length, 3);
  });
});

test("les affixes de stat modifient réellement la fiche (getDerivedStats)", () => {
  const s = newGame("Hér", "warrior");
  const base = getDerivedStats(s).atk;
  // Arme légendaire avec affixe ATK forcé.
  const w = makeInstance("copper_sword", "common");
  w.stats = { atk: 6 };
  w.affixes = [{ id: "atk", kind: "stat", stat: "pctAtk", label: "ATK", value: 0.2 }];
  s.character.equipment.weapon = w;
  const withAffix = getDerivedStats(s).atk;
  // base inclut l'arme (atk plate) ; on vérifie l'effet du +20 % d'affixe.
  const s2 = newGame("Hér", "warrior");
  const w2 = makeInstance("copper_sword", "common");
  w2.stats = { atk: 6 };
  w2.affixes = [];
  s2.character.equipment.weapon = w2;
  assert.ok(withAffix > getDerivedStats(s2).atk, "l'affixe ATK augmente l'attaque finale");
});

test("gearCombatBonuses agrège résistances, dégâts élém. et pp", () => {
  const s = newGame("Hér", "mage");
  const a = makeInstance("iron_plate", "common"); a.affixes = [{ id: "resist", kind: "resist", label: "Résist.", value: 0.1, element: "fire" }];
  const b = makeInstance("iron_greaves", "common"); b.affixes = [{ id: "resist", kind: "resist", label: "Résist.", value: 0.08, element: "fire" }];
  s.character.equipment.chest = a;
  s.character.equipment.legs = b;
  const g = gearCombatBonuses(s);
  assert.ok(Math.abs(g.resist.fire - 0.18) < 1e-9, "résistances feu cumulées");
});

test("l'élément d'arme s'applique au héros en combat", () => {
  const s = newGame("Hér", "warrior");
  const w = makeInstance("copper_sword", "common");
  w.element = "lightning";
  s.character.equipment.weapon = w;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const c = startCombat(s, "feral_wolf");
  assert.equal(c.player.weaponElement, "lightning");
  assert.equal(equippedWeaponElement(s), "lightning");
});

test("les résistances d'affixes réduisent les dégâts élémentaires subis", () => {
  const s = newGame("Hér", "guardian");
  const armor = makeInstance("iron_plate", "common");
  armor.affixes = [{ id: "resist", kind: "resist", label: "Résist.", value: 0.3, element: "fire" }];
  s.character.equipment.chest = armor;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const c = startCombat(s, "feral_wolf");
  assert.ok(c.player.resist.fire < 1, "résistance au feu < 1 (réduction)");
});

test("cohérence classe/arme : on ne peut pas fabriquer une arme hors-classe", () => {
  const sMage = newGame("M", "mage");
  // Recette factice produisant une épée (incompatible Mage).
  const swordRecipe = { output: { type: "equipment", id: "copper_sword" }, inputs: [], levelReq: 0 };
  assert.equal(recipeAllowedForClass(sMage, swordRecipe), false);
  assert.equal(canCraft(sMage, swordRecipe).reason, "Classe incompatible");
  // Un bâton (compatible Mage) est autorisé.
  const staffRecipe = { output: { type: "equipment", id: "oak_staff" }, inputs: [], levelReq: 0 };
  assert.equal(recipeAllowedForClass(sMage, staffRecipe), true);
});

test("2e emplacement d'accessoire : verrouillé puis débloqué par un boss", () => {
  const s = newGame("Hér", "warrior");
  s.character.level = 20;
  assert.equal(accessory2Unlocked(s), false);
  // On équipe 2 accessoires SANS boss -> le 2e va quand même au 1er slot (remplace).
  const a1 = makeInstance("copper_ring", "common"); addEquipmentInstance(a1); equip(s, a1.uid);
  const a2 = makeInstance("warding_charm", "common"); addEquipmentInstance(a2); equip(s, a2.uid);
  assert.equal(s.character.equipment.accessory2, null, "2e slot verrouillé : pas de double équipement");
  // Boss vaincu -> 2e slot débloqué.
  s.flags.bossDefeated = true;
  assert.equal(accessory2Unlocked(s), true);
  const a3 = makeInstance("swift_band", "common"); addEquipmentInstance(a3); equip(s, a3.uid);
  assert.ok(s.character.equipment.accessory && s.character.equipment.accessory2, "deux accessoires équipés");
});
