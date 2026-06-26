// Tests des filtres et de la recherche de l'Atelier (vue).

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { renderCraft, renderCraftResults, defaultCraftFilters } from "../js/ui/views.js";

function readyState(classId = "warrior") {
  const s = newGame("Atelier", classId);
  s.character.level = 10;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

test("renderCraft contient barre de filtres et résumé des métiers", () => {
  const html = renderCraft(readyState());
  assert.ok(html.includes("craft-search"));
  assert.ok(html.includes("prof-summary"));
  assert.ok(html.includes("craft-results"));
});

test("filtre catégorie 'weapon' ne renvoie que des armes", () => {
  const s = readyState();
  const html = renderCraftResults(s, { ...defaultCraftFilters(), cat: "weapon" });
  assert.ok(html.includes("Armes"));
  assert.ok(!html.includes("Matériaux"), "ne doit pas afficher la catégorie Matériaux");
});

test("filtre classe 'mage' masque les armes non maniables (épée)", () => {
  const s = readyState();
  const html = renderCraftResults(s, { ...defaultCraftFilters(), cls: "mage", cat: "weapon" });
  assert.ok(html.includes("Bâton") || html.includes("Baguette") || html.includes("Orbe"), "le mage voit ses armes magiques");
  assert.ok(!html.includes("Épée de cuivre"), "le mage ne voit pas une épée");
});

test("recherche par matériau (argent) retrouve les recettes concernées", () => {
  const s = readyState();
  const html = renderCraftResults(s, { ...defaultCraftFilters(), search: "argent" });
  assert.ok(html.includes("argent") || html.includes("Argent"), "doit retrouver des recettes liées à l'argent");
});

test("filtre 'réalisable' masque les recettes non fabricables faute de ressources", () => {
  const s = readyState(); // aucune ressource
  const html = renderCraftResults(s, { ...defaultCraftFilters(), craftable: true });
  assert.ok(html.includes("Aucune recette"), "sans ressources, rien n'est réalisable");
});

test("recherche sans correspondance affiche un message vide", () => {
  const s = readyState();
  const html = renderCraftResults(s, { ...defaultCraftFilters(), search: "zzzzznope" });
  assert.ok(html.includes("Aucune recette"));
});
