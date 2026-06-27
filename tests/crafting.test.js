// Tests du craft et des métiers de transformation (niveau propre).

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, resourceCount } from "../js/core/state.js";
import { craft, canCraft, professionLevel } from "../js/systems/crafting.js";
import { getRecipe } from "../js/data/recipes.js";

function stateWith(resources = {}, charLevel = 1) {
  const s = newGame("Forgeron", "warrior");
  s.character.level = charLevel;
  for (const [id, qty] of Object.entries(resources)) s.inventory.resources[id] = qty;
  return s;
}

test("les professions sont initialisées au niveau 1", () => {
  const s = newGame("P", "warrior");
  assert.equal(professionLevel(s, "fonte"), 1);
  assert.equal(professionLevel(s, "forge"), 1);
});

test("craft consomme les ressources et produit la sortie", () => {
  const s = stateWith({ copper_ore: 2 });
  const r = craft(s, "smelt_copper");
  assert.equal(r.ok, true);
  assert.equal(resourceCount("copper_ore"), 0);
  assert.equal(resourceCount("copper_ingot"), 1);
});

test("craft octroie de l'XP au métier de transformation de la station", () => {
  const s = stateWith({ copper_ore: 2 });
  const before = s.professions.fonte.xp;
  const r = craft(s, "smelt_copper");
  assert.ok(s.professions.fonte.xp > before || r.profLevels > 0);
  assert.equal(r.station, "fonte");
});

test("une recette est bloquée si le niveau de métier est insuffisant", () => {
  const s = stateWith({ iron_ore: 10 }); // fonte niveau 1, smelt_iron exige niv. 3
  const check = canCraft(s, getRecipe("smelt_iron"));
  assert.equal(check.ok, false);
  assert.match(check.reason, /Fonte/);
});

test("fabriquer assez fait monter le métier de transformation de niveau", () => {
  const s = stateWith({ copper_ore: 100 });
  let leveled = false;
  for (let i = 0; i < 20; i++) {
    const r = craft(s, "smelt_copper");
    if (!r.ok) break;
    if (r.profLevels > 0) leveled = true;
  }
  assert.ok(s.professions.fonte.level >= 2, "la Fonte doit avoir gagné au moins un niveau");
  assert.ok(leveled);
});

test("la Fonte est un métier distinct de la Forge", () => {
  assert.equal(getRecipe("smelt_copper").station, "fonte");
  assert.equal(getRecipe("craft_copper_sword").station, "forge");
});
