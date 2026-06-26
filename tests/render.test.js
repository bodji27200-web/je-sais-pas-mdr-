// Tests de fumée du rendu : les vues produisent du HTML sans lever d'erreur.
// (Les vues sont des fonctions pures qui retournent des chaînes ; `document`
// n'est utilisé que dans les helpers d'interaction, pas au rendu.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { startActivity } from "../js/systems/jobs.js";
import {
  renderCreation,
  renderTopbar,
  renderCharacter,
  renderJobs,
  renderCraft,
  renderInventory,
  renderZones,
  topbarActivityInner,
} from "../js/ui/views.js";

function readyState(classId = "warrior") {
  const s = newGame("Rendu", classId);
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

test("renderCreation produit du HTML non vide", () => {
  const html = renderCreation();
  assert.ok(html.includes("class-card"));
});

test("les écrans principaux se rendent pour les 5 classes", () => {
  for (const cls of ["warrior", "guardian", "archer", "mage", "assassin"]) {
    const s = readyState(cls);
    for (const fn of [renderTopbar, renderCharacter, renderJobs, renderCraft, renderInventory, renderZones]) {
      const html = fn(s);
      assert.equal(typeof html, "string");
      assert.ok(html.length > 0, `${fn.name} (${cls}) doit produire du HTML`);
      assert.ok(!html.includes("undefined"), `${fn.name} (${cls}) ne doit pas contenir "undefined"`);
    }
  }
});

test("renderJobs affiche l'activité principale et le prochain palier", () => {
  const s = readyState();
  const html = renderJobs(s);
  assert.ok(html.includes("Bûcheronnage"));
  assert.ok(html.includes("Prochain palier"));
});

test("topbarActivityInner reflète l'activité en cours", () => {
  const s = readyState();
  assert.ok(topbarActivityInner(s).includes("Aucune activité"));
  startActivity(s, "woodcutting");
  const html = topbarActivityInner(s);
  assert.ok(html.includes("Bois tendre"));
});
