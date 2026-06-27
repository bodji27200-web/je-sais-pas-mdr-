// Tests des filtres et de la recherche de l'Atelier (vue).

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { renderCraft, renderCraftResults, renderCraftDetail, defaultCraftFilters } from "../js/ui/views.js";
import { RECIPES } from "../js/data/recipes.js";

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

// --- Refonte de l'Atelier : grille de tuiles + panneau de détail -------------

test("la grille rend des tuiles cliquables (data-recipe) et non plus de gros boutons", () => {
  const html = renderCraftResults(readyState(), defaultCraftFilters(), null);
  assert.ok(html.includes("craft-tile"), "des tuiles compactes sont rendues");
  assert.ok(html.includes("craft-select"), "les tuiles sont sélectionnables");
});

test("renderCraft intègre la mise en page maître/détail", () => {
  const html = renderCraft(readyState(), defaultCraftFilters(), null);
  assert.ok(html.includes("craft-layout"));
  assert.ok(html.includes('id="craft-detail"'));
});

test("le panneau de détail est vide sans sélection, complet avec une recette", () => {
  const s = readyState();
  const empty = renderCraftDetail(s, null);
  assert.ok(empty.includes("craft-detail-empty"), "placeholder sans sélection");
  const rec = RECIPES[0];
  const full = renderCraftDetail(s, rec.id);
  assert.ok(full.includes("Ingrédients"), "le détail liste les ingrédients");
  assert.ok(full.includes("craft-make-btn"), "le détail a un unique bouton Fabriquer");
});

test("tuile marquée réalisable seulement quand les ressources suffisent", () => {
  const s = readyState(); // sans ressources -> rien de réalisable
  const lockedHtml = renderCraftResults(s, defaultCraftFilters(), null);
  assert.ok(lockedHtml.includes("locked"), "tuiles verrouillées sans ressources");
});
