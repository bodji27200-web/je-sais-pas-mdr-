// Objectifs de départ : une mini-checklist qui guide les premières minutes.
// Verrouillage « one-way » : une fois accompli, un objectif le reste.

import { getEquipment } from "../data/equipment.js";
import { resourceCount } from "../core/state.js";

export const OBJECTIVES = [
  { id: "woodcut", label: "Couper du bois" },
  { id: "ingot", label: "Fabriquer un lingot" },
  { id: "weapon", label: "Forger une arme" },
  { id: "equipWeapon", label: "Équiper une arme" },
  { id: "firstKill", label: "Vaincre un premier ennemi" },
];

export function ensureObjectives(state) {
  if (!state.objectives) {
    state.objectives = {
      woodcut: false,
      ingot: false,
      weapon: false,
      equipWeapon: false,
      firstKill: false,
    };
  }
  return state.objectives;
}

function ownsAnyWeapon(state) {
  if (state.character.equipment.weapon) return true;
  return state.inventory.equipment.some(
    (inst) => getEquipment(inst.baseId)?.slot === "weapon"
  );
}

// Met à jour les objectifs et renvoie la liste des ids nouvellement accomplis.
export function updateObjectives(state) {
  const o = ensureObjectives(state);
  const newly = [];
  const set = (k, cond) => {
    if (!o[k] && cond) {
      o[k] = true;
      newly.push(k);
    }
  };
  set("woodcut", resourceCount("soft_wood") > 0 || resourceCount("oak_wood") > 0);
  set("ingot", resourceCount("copper_ingot") > 0 || resourceCount("iron_ingot") > 0);
  set("weapon", ownsAnyWeapon(state));
  set("equipWeapon", !!state.character.equipment.weapon);
  set("firstKill", state.counters.kills > 0);
  return newly;
}

export function allObjectivesDone(state) {
  const o = ensureObjectives(state);
  return OBJECTIVES.every((ob) => o[ob.id]);
}

export function objectiveLabel(id) {
  return (OBJECTIVES.find((o) => o.id === id) || {}).label || id;
}
