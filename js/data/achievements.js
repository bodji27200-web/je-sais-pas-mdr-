// Succès & badges (Lot 12) — data-driven. Chaque succès est ÉVALUÉ en direct à
// partir de l'état (pas de double comptabilité). `progress` (optionnel) renvoie
// { cur, max } pour une barre. `badge: true` = grand accomplissement (cosmétique,
// aucun bonus de puissance significatif, conformément au cahier des charges).

import { familyCounts } from "../core/character.js";

function ownedFamiliars(s) {
  return Object.keys((s.familiars && s.familiars.owned) || {});
}
function allGear(s) {
  const eq = s.character.equipment || {};
  return [...(s.inventory.equipment || []), ...Object.values(eq)].filter(Boolean);
}

export const ACHIEVEMENTS = [
  // --- Combat ---
  { id: "first_blood", name: "Premier sang", cat: "Combat", desc: "Vaincre un premier ennemi.",
    check: (s) => s.counters.kills > 0 },
  { id: "slayer", name: "Massacreur", cat: "Combat", desc: "Vaincre 50 ennemis.",
    progress: (s) => ({ cur: Math.min(50, s.counters.kills), max: 50 }), check: (s) => s.counters.kills >= 50 },
  // --- Boss ---
  { id: "first_boss", name: "Tombeur de géants", cat: "Boss", badge: true, desc: "Vaincre un premier boss.",
    check: (s) => s.counters.bossKills > 0 },
  { id: "boss_hunter", name: "Chasseur de boss", cat: "Boss", badge: true, desc: "Vaincre 3 boss.",
    progress: (s) => ({ cur: Math.min(3, s.counters.bossKills), max: 3 }), check: (s) => s.counters.bossKills >= 3 },
  // --- Métiers ---
  { id: "miner25", name: "Mineur chevronné", cat: "Métier", desc: "Atteindre le niveau 25 en Minage.",
    progress: (s) => ({ cur: Math.min(25, s.jobs.mining.level), max: 25 }), check: (s) => s.jobs.mining.level >= 25 },
  { id: "lumber25", name: "Bûcheron chevronné", cat: "Métier", desc: "Atteindre le niveau 25 en Bûcheronnage.",
    progress: (s) => ({ cur: Math.min(25, s.jobs.woodcutting.level), max: 25 }), check: (s) => s.jobs.woodcutting.level >= 25 },
  // --- Craft ---
  { id: "artisan", name: "Artisan", cat: "Craft", desc: "Fabriquer 20 objets.",
    progress: (s) => ({ cur: Math.min(20, s.counters.crafted || 0), max: 20 }), check: (s) => (s.counters.crafted || 0) >= 20 },
  // --- Héros ---
  { id: "specialized", name: "Une voie tracée", cat: "Héros", desc: "Choisir une spécialisation.",
    check: (s) => !!s.character.specId },
  { id: "veteran", name: "Vétéran", cat: "Héros", desc: "Atteindre le niveau 20.",
    progress: (s) => ({ cur: Math.min(20, s.character.level), max: 20 }), check: (s) => s.character.level >= 20 },
  // --- Familiers ---
  { id: "tamer", name: "Apprivoiseur", cat: "Familier", desc: "Obtenir un premier familier.",
    check: (s) => ownedFamiliars(s).length > 0 },
  { id: "collector", name: "Collectionneur", cat: "Familier", desc: "Posséder 3 familiers.",
    progress: (s) => ({ cur: Math.min(3, ownedFamiliars(s).length), max: 3 }), check: (s) => ownedFamiliars(s).length >= 3 },
  { id: "soulbond", name: "Âmes liées", cat: "Familier", badge: true, desc: "Atteindre le lien maximum avec un familier.",
    check: (s) => Object.values((s.familiars && s.familiars.owned) || {}).some((o) => o.link >= 10) },
  // --- Build ---
  { id: "hybrid", name: "Touche-à-tout", cat: "Build", desc: "Équiper 2 familles de matériaux différentes.",
    check: (s) => Object.values(familyCounts(s)).filter((n) => n > 0).length >= 2 },
  { id: "legendary", name: "Légende vivante", cat: "Build", badge: true, desc: "Posséder un objet légendaire.",
    check: (s) => allGear(s).some((i) => i.rarity === "legendary") },
];

export function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}
