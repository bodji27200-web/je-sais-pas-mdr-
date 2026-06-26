// Système de familiers (Lot 11) : éclosion d'œufs, collection, équipement, lien,
// nourrissage (Essence), progression d'XP plafonnée au niveau du héros.
//
// Soutien LÉGER : le familier équipé applique un petit passif au héros en combat
// (voir effectiveFamiliarPassive + intégration dans systems/combat.js). Il ne
// joue pas à la place du joueur.

import { getFamiliar, familiarsByRarity, getEgg, FEED_ESSENCE_COST, LINK_MAX } from "../data/familiars.js";
import { familiarXpAt } from "../data/curves.js";
import { applyXp } from "../core/progression.js";

// Essence rendue par un doublon, selon la rareté.
const ESSENCE_BY_RARITY = { common: 1, uncommon: 2, rare: 4, epic: 8, legendary: 15 };

// Initialise/normalise la structure (sécurité ; la migration v8 l'a déjà posée).
export function ensureFamiliars(state) {
  if (!state.familiars) state.familiars = { owned: {}, eggs: {}, equipped: null, essence: 0 };
  const f = state.familiars;
  if (!f.owned) f.owned = {};
  if (!f.eggs) f.eggs = {};
  if (f.essence == null) f.essence = 0;
  if (f.equipped === undefined) f.equipped = null;
  return f;
}

export function ownedCount(state) {
  return Object.keys(ensureFamiliars(state).owned).length;
}

export function addEgg(state, eggId, n = 1) {
  const f = ensureFamiliars(state);
  f.eggs[eggId] = (f.eggs[eggId] || 0) + n;
}

// Tirage pondéré : d'abord une rareté (selon les poids de l'œuf), puis un
// familier de cette rareté. Probabilités claires et testables (graine).
export function rollFamiliar(eggId) {
  const egg = getEgg(eggId);
  if (!egg) return null;
  const weights = egg.weights;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let rarity = Object.keys(weights)[0];
  for (const k of Object.keys(weights)) {
    if (r < weights[k]) { rarity = k; break; }
    r -= weights[k];
  }
  const pool = familiarsByRarity(rarity);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

// Fait éclore un œuf : nouveau familier (ajouté) ou doublon (-> Essence).
export function hatchEgg(state, eggId) {
  const f = ensureFamiliars(state);
  if (!(f.eggs[eggId] > 0)) return { ok: false, error: "Aucun œuf de ce type." };
  const id = rollFamiliar(eggId);
  if (!id) return { ok: false, error: "Éclosion impossible." };
  f.eggs[eggId] -= 1;
  const fam = getFamiliar(id);
  if (f.owned[id]) {
    const gain = ESSENCE_BY_RARITY[fam.rarity] || 1;
    f.essence += gain;
    return { ok: true, id, familiar: fam, duplicate: true, essenceGain: gain };
  }
  f.owned[id] = { level: 1, xp: 0, link: 0 };
  if (!f.equipped) f.equipped = id; // le premier familier est équipé d'office
  return { ok: true, id, familiar: fam, duplicate: false, essenceGain: 0 };
}

// Équipe (ou déséquipe par bascule) un familier possédé.
export function equipFamiliar(state, id) {
  const f = ensureFamiliars(state);
  if (!f.owned[id]) return { ok: false, error: "Familier non possédé." };
  f.equipped = f.equipped === id ? null : id;
  return { ok: true, equipped: f.equipped };
}

// Nourrit le familier (dépense de l'Essence) -> +1 cran de lien.
export function feedFamiliar(state, id) {
  const f = ensureFamiliars(state);
  const o = f.owned[id];
  if (!o) return { ok: false, error: "Familier non possédé." };
  if (o.link >= LINK_MAX) return { ok: false, error: "Lien déjà au maximum." };
  if (f.essence < FEED_ESSENCE_COST) return { ok: false, error: `Essence insuffisante (${f.essence}/${FEED_ESSENCE_COST}).` };
  f.essence -= FEED_ESSENCE_COST;
  o.link = Math.min(LINK_MAX, o.link + 1);
  return { ok: true, link: o.link };
}

// Le familier ne dépasse pas le niveau du héros (il accompagne, sans le remplacer).
export function familiarLevelCap(state) {
  return state.character.level;
}

// Gain d'XP + lien à l'issue d'un combat gagné, pour le familier équipé.
export function gainEquippedFamiliarXp(state, amount) {
  const f = ensureFamiliars(state);
  if (!f.equipped) return { levels: 0 };
  const o = f.owned[f.equipped];
  if (!o) return { levels: 0 };
  const cap = familiarLevelCap(state);
  let levels = 0;
  if (o.level < cap) {
    const before = o.level;
    applyXp(o, amount, familiarXpAt);
    if (o.level >= cap) { o.level = cap; o.xp = 0; } // plafonné au héros
    levels = o.level - before;
  }
  // Lien : petite hausse occasionnelle en combattant (récompense l'attachement).
  if (o.link < LINK_MAX && Math.random() < 0.34) o.link = Math.min(LINK_MAX, o.link + 1);
  return { levels, id: f.equipped };
}

// Passif EFFECTIF du familier équipé (le lien renforce légèrement : +1,5 %/cran,
// plafonné à +15 %). Renvoie une copie prête à appliquer, ou null.
export function effectiveFamiliarPassive(state) {
  const f = ensureFamiliars(state);
  if (!f.equipped) return null;
  const fam = getFamiliar(f.equipped);
  const o = f.owned[f.equipped];
  if (!fam || !o) return null;
  const mult = 1 + Math.min(0.15, (o.link || 0) * 0.015);
  const p = {};
  for (const k of Object.keys(fam.passive || {})) {
    const v = fam.passive[k];
    if (typeof v === "number") p[k] = v * mult;
    else if (k === "elementDmgPct") {
      p[k] = {};
      for (const el of Object.keys(v)) p[k][el] = v[el] * mult;
    }
  }
  return { id: fam.id, sprite: fam.sprite, image: fam.image, element: fam.element, role: fam.role, passive: p, level: o.level, link: o.link };
}
