// Système de craft (instantané). Vérifie les prérequis (niveau de personnage ET
// niveau du métier de transformation), consomme les ressources, produit l'objet,
// et fait progresser le métier de transformation correspondant.

import { getRecipe, STATIONS } from "../data/recipes.js";
import {
  resourceCount,
  removeResource,
  addResource,
  addEquipmentInstance,
} from "../core/state.js";
import { makeInstance } from "../core/items.js";
import { applyXp, jobXpToNext } from "../core/progression.js";
import { getEquipment } from "../data/equipment.js";
import { getClass } from "../data/classes.js";

// Cohérence classe/arme (Lot 13) : on ne peut pas fabriquer une arme que sa
// classe ne peut pas manier (sinon objet inutile). Armures/accessoires = universels.
export function recipeAllowedForClass(state, recipe) {
  if (!recipe || !recipe.output || recipe.output.type !== "equipment") return true;
  const tpl = getEquipment(recipe.output.id);
  if (!tpl || tpl.slot !== "weapon" || !tpl.wtype) return true;
  const cls = getClass(state.character.classId);
  return !cls || !cls.weapons || cls.weapons.includes(tpl.wtype);
}

// Niveau du métier de transformation d'une station (1 si non initialisé).
export function professionLevel(state, stationId) {
  const p = state.professions && state.professions[stationId];
  return p ? p.level : 1;
}

// Le joueur peut-il lancer cette recette ? Renvoie { ok, reason }.
// L'ordre des vérifications produit un message clair (la cause la plus haute).
export function canCraft(state, recipe) {
  if (!recipeAllowedForClass(state, recipe))
    return { ok: false, reason: "Classe incompatible" };
  if (state.character.level < (recipe.levelReq || 0))
    return { ok: false, reason: `Niveau ${recipe.levelReq} requis` };
  const profReq = recipe.profReq || 1;
  if (professionLevel(state, recipe.station) < profReq) {
    const st = STATIONS[recipe.station];
    return { ok: false, reason: `${st ? st.name : "Métier"} niv. ${profReq}` };
  }
  for (const input of recipe.inputs) {
    if (resourceCount(input.resource) < input.qty)
      return { ok: false, reason: "Ressources insuffisantes" };
  }
  return { ok: true };
}

// Combien de fois cette recette peut être réalisée avec l'inventaire actuel.
export function craftableTimes(state, recipe) {
  if (state.character.level < (recipe.levelReq || 0)) return 0;
  if (professionLevel(state, recipe.station) < (recipe.profReq || 1)) return 0;
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
  let instance = null;
  if (out.type === "resource") {
    addResource(out.id, out.qty);
  } else if (out.type === "equipment") {
    // Forge : pièce commune (rareté via le loot). Stats légèrement variables.
    const n = out.qty || 1;
    for (let i = 0; i < n; i++) {
      instance = makeInstance(out.id, "common");
      addEquipmentInstance(instance);
    }
  }

  // Progression du métier de transformation correspondant.
  let profLevels = 0;
  if (!state.professions) state.professions = {};
  if (!state.professions[recipe.station]) state.professions[recipe.station] = { level: 1, xp: 0 };
  const gainedXp = recipe.profXp || 5;
  profLevels = applyXp(state.professions[recipe.station], gainedXp, jobXpToNext);

  state.counters.crafted += 1;
  return { ok: true, output: out, instance, station: recipe.station, profLevels, profXp: gainedXp };
}
