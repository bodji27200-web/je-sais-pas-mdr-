// Quêtes de découverte (Lot 12) — remplacent l'ancienne checklist linéaire.
// Chaque quête ENSEIGNE un système, propose souvent plusieurs solutions, et
// s'adapte à la classe. Récompense modeste à la complétion (one-way).

import { getClass } from "../data/classes.js";
import { resourceCount, addGold } from "../core/state.js";
import { ensureFamiliars } from "./familiars.js";

// Arme « naturelle » de la classe (pour un libellé adapté, sans imposer un type).
function classWeaponHint(state) {
  const cls = getClass(state.character.classId);
  const w = (cls && cls.weapons && cls.weapons[0]) || "arme";
  const label = { sword: "une épée", greatsword: "une grande épée", mace: "une masse", spear: "une lance",
    shield: "un bouclier", bow: "un arc", longbow: "un grand arc", crossbow: "une arbalète",
    staff: "un bâton", wand: "une baguette", orb: "un orbe", dagger: "une dague",
    dual_daggers: "des dagues jumelles", short_blade: "une lame courte" }[w] || "une arme";
  return label;
}

function ownsFamiliar(state) {
  return Object.keys((state.familiars && state.familiars.owned) || {}).length > 0;
}
function defeatedZone2(state) {
  const d = (state.counters && state.counters.defeated) || {};
  return ["dust_weaver", "miner_wraith", "shale_golem", "echo_bat", "damned_foreman"].some((id) => d[id] > 0);
}

// Définition des quêtes. `label`/`hint` peuvent dépendre de l'état (fonction).
export const QUESTS = [
  { id: "harvest", label: "Récolter une ressource", reward: { gold: 30 },
    hint: () => "Lance le Bûcheronnage OU le Minage dans l'onglet Métiers.",
    check: (s) => resourceCount("soft_wood") > 0 || resourceCount("oak_wood") > 0 || resourceCount("copper_ore") > 0 || resourceCount("stone") > 0 },
  { id: "craftAny", label: "Fabriquer un objet", reward: { gold: 40 },
    hint: () => "N'importe quelle recette de l'Atelier fait l'affaire.",
    check: (s) => (s.counters.crafted || 0) > 0 },
  { id: "equipWeapon", label: "Équiper une arme", reward: { gold: 40 },
    hint: (s) => `Équipe ${classWeaponHint(s)} (ou toute arme compatible) depuis le Sac.`,
    check: (s) => !!s.character.equipment.weapon },
  { id: "firstKill", label: "Vaincre un ennemi", reward: { gold: 50 },
    hint: () => "Rends-toi dans l'onglet Combat et affronte un ennemi.",
    check: (s) => s.counters.kills > 0 },
  { id: "tameFamiliar", label: "Obtenir un familier", reward: { essence: 3 },
    hint: () => "Fais éclore ton œuf de départ dans l'onglet Familiers.",
    check: (s) => ownsFamiliar(s) },
  { id: "explore", label: "Explorer une nouvelle zone", reward: { gold: 120 },
    hint: () => "Vaincs le premier boss puis combats un ennemi de la Carrière d'Ombrepierre.",
    check: (s) => defeatedZone2(s) },
];

// Compat : ancien nom utilisé par les vues.
export const OBJECTIVES = QUESTS;

export function ensureObjectives(state) {
  if (!state.objectives) state.objectives = {};
  for (const q of QUESTS) if (state.objectives[q.id] === undefined) state.objectives[q.id] = false;
  return state.objectives;
}

function grantReward(state, reward) {
  if (!reward) return;
  if (reward.gold) addGold(reward.gold);
  if (reward.essence) ensureFamiliars(state).essence += reward.essence;
}

// Met à jour les quêtes, octroie les récompenses des quêtes nouvellement
// accomplies et renvoie ces quêtes (pour notification).
export function updateObjectives(state) {
  const o = ensureObjectives(state);
  const newly = [];
  for (const q of QUESTS) {
    if (!o[q.id] && q.check(state)) {
      o[q.id] = true;
      grantReward(state, q.reward);
      newly.push(q.id);
    }
  }
  return newly;
}

export function allObjectivesDone(state) {
  const o = ensureObjectives(state);
  return QUESTS.every((q) => o[q.id]);
}

export function objectiveLabel(id) {
  return (QUESTS.find((q) => q.id === id) || {}).label || id;
}

// Libellé d'indice (résout les fonctions dépendantes de l'état).
export function objectiveHint(state, id) {
  const q = QUESTS.find((x) => x.id === id);
  if (!q) return "";
  return typeof q.hint === "function" ? q.hint(state) : q.hint || "";
}

// Libellé de récompense lisible.
export function rewardLabel(reward) {
  if (!reward) return "";
  const parts = [];
  if (reward.gold) parts.push(`${reward.gold} or`);
  if (reward.essence) parts.push(`${reward.essence} ✦ Essence`);
  return parts.join(" · ");
}
