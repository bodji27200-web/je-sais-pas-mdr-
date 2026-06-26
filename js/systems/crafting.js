// Système de craft (instantané). Vérifie les prérequis, consomme les ressources,
// produit l'objet.

import { getRecipe } from "../data/recipes.js";
import {
  resourceCount,
  removeResource,
  addResource,
  addEquipment,
} from "../core/state.js";

// Le joueur peut-il lancer cette recette ? Renvoie { ok, reason }.
export function canCraft(state, recipe) {
  if (state.character.level < (recipe.levelReq || 0))
    return { ok: false, reason: `Niveau ${recipe.levelReq} requis` };
  for (const input of recipe.inputs) {
    if (resourceCount(input.resource) < input.qty)
      return { ok: false, reason: "Ressources insuffisantes" };
  }
  return { ok: true };
}

// Combien de fois cette recette peut être réalisée avec l'inventaire actuel.
export function craftableTimes(state, recipe) {
  if (state.character.level < (recipe.levelReq || 0)) return 0;
  let times = Infinity;
  for (const input of recipe.inputs) {
    times = Math.min(times, Math.floor(resourceCount(input.resource) / input.qty));
  }
  return times === Infinity ? 0 : times;
}

export function craft(state, recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) return { ok: false, error: "Recette inconnue." };
  const check = canCraft(state, recipe);
  if (!check.ok) return { ok: false, error: check.reason };

  for (const input of recipe.inputs) removeResource(input.resource, input.qty);

  const out = recipe.output;
  if (out.type === "resource") addResource(out.id, out.qty);
  else if (out.type === "equipment") addEquipment(out.id, out.qty);

  state.counters.crafted += 1;
  return { ok: true, output: out };
}
