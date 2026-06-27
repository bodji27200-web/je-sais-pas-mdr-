// Tests d'intégrité des données : aucune référence cassée, aucune ressource
// orpheline (toute ressource doit être récoltable, produite ou consommée).

import { test } from "node:test";
import assert from "node:assert/strict";
import { RESOURCES } from "../js/data/resources.js";
import { EQUIPMENT, SLOTS } from "../js/data/equipment.js";
import { RECIPES, STATIONS } from "../js/data/recipes.js";
import { JOBS } from "../js/data/jobs.js";
import { ENEMIES } from "../js/data/enemies.js";

test("aucune entrée RESOURCES indéfinie", () => {
  for (const [id, def] of Object.entries(RESOURCES)) {
    assert.ok(def, `ressource ${id} ne doit pas être indéfinie`);
    assert.equal(def.id, id, `l'id interne de ${id} doit correspondre à la clé`);
  }
});

test("les recettes référencent des ressources/équipements existants", () => {
  for (const r of RECIPES) {
    assert.ok(STATIONS[r.station], `station inconnue dans ${r.id}: ${r.station}`);
    for (const inp of r.inputs) {
      assert.ok(RESOURCES[inp.resource], `recette ${r.id}: ressource d'entrée inconnue ${inp.resource}`);
    }
    if (r.output.type === "resource") {
      assert.ok(RESOURCES[r.output.id], `recette ${r.id}: ressource de sortie inconnue ${r.output.id}`);
    } else if (r.output.type === "equipment") {
      assert.ok(EQUIPMENT[r.output.id], `recette ${r.id}: équipement de sortie inconnu ${r.output.id}`);
    }
  }
});

test("les paliers de métier référencent des ressources existantes", () => {
  for (const job of Object.values(JOBS)) {
    for (const tier of job.tiers) {
      assert.ok(RESOURCES[tier.resource], `palier ${tier.id}: ressource principale inconnue ${tier.resource}`);
      for (const d of tier.drops) {
        assert.ok(RESOURCES[d.resource], `palier ${tier.id}: drop inconnu ${d.resource}`);
      }
    }
  }
});

test("les drops d'ennemis référencent des ressources/équipements existants", () => {
  for (const e of Object.values(ENEMIES)) {
    for (const d of e.drops || []) {
      if (d.type === "resource") assert.ok(RESOURCES[d.item], `ennemi ${e.id}: ressource ${d.item}`);
      else if (d.type === "equipment") assert.ok(EQUIPMENT[d.item], `ennemi ${e.id}: équipement ${d.item}`);
    }
  }
});

test("aucune ressource orpheline (récoltable, produite ou consommée)", () => {
  const used = new Set();
  // Récoltes (paliers de métier).
  for (const job of Object.values(JOBS)) for (const t of job.tiers) for (const d of t.drops) used.add(d.resource);
  // Butin d'ennemis.
  for (const e of Object.values(ENEMIES)) for (const d of e.drops || []) if (d.type === "resource") used.add(d.item);
  // Recettes (entrées et sorties).
  for (const r of RECIPES) {
    for (const inp of r.inputs) used.add(inp.resource);
    if (r.output.type === "resource") used.add(r.output.id);
  }
  // Renforcement / démantèlement produit equip_essence (utilisé par le renforcement).
  used.add("equip_essence");

  for (const id of Object.keys(RESOURCES)) {
    assert.ok(used.has(id), `ressource orpheline (jamais récoltée/produite/consommée) : ${id}`);
  }
});

test("chaque équipement correspond à un slot connu", () => {
  for (const e of Object.values(EQUIPMENT)) {
    assert.ok(SLOTS[e.slot], `équipement ${e.id}: slot inconnu ${e.slot}`);
  }
});
