// Familiers — data-driven (Lot 11). Conçus en SOUTIEN LÉGER : ils apportent un
// vrai bonus de build (passif lu par le moteur) sans jouer à la place du joueur.
//
// Champs d'un familier :
//   element : élément (voir data/elements.js)
//   role    : "offensif" | "protecteur" | "soutien" | "rapide"
//   rarity  : commun | inhabituel | rare | épique | légendaire (voir rarities.js)
//   passive : effets appliqués au héros EN COMBAT (soutien léger, plafonné) :
//     skillPowerPct, lifestealPct, hpRegenPct   -> fusionnés dans pp
//     critFlat (+%)                              -> crit du héros
//     spdPct                                     -> vitesse (initiative)
//     maxHpPct                                   -> PV max
//     elementDmgPct { element: pct }             -> dégâts du héros de CET élément
//   image/sprite : SVG (carte + arène). Aucun emoji final.

export const FAMILIAR_ROLES = {
  offensif: { id: "offensif", name: "Offensif", icon: "⚔" },
  protecteur: { id: "protecteur", name: "Protecteur", icon: "🛡" },
  soutien: { id: "soutien", name: "Soutien", icon: "✚" },
  rapide: { id: "rapide", name: "Rapide", icon: "➤" },
};

export const FAMILIARS = {
  // --- Communs ---
  pebble_mite: {
    id: "pebble_mite", name: "Pétroglyphe", element: "nature", role: "protecteur", rarity: "common",
    image: "assets/familiars/pebble_mite.png", sprite: "assets/familiars/pebble_mite.png",
    // Rôle IRREMPLAÇABLE (instr. 294) : seul familier qui renforce la Garde-réserve.
    passive: { guardMaxPct: 0.18 },
    desc: "Une petite créature de pierre qui consolide la Garde de son maître (réserve de Garde +18 %).",
  },
  spark_mote: {
    id: "spark_mote", name: "Grésille", element: "lightning", role: "rapide", rarity: "common",
    image: "assets/familiars/spark_mote.png", sprite: "assets/familiars/spark_mote.png",
    passive: { spdPct: 0.04 },
    desc: "Une étincelle vive qui presse le pas de son maître (Clairvoyance +4 %).",
  },
  glimmer_moth: {
    id: "glimmer_moth", name: "Lampyre", element: "light", role: "soutien", rarity: "common",
    image: "assets/familiars/glimmer_moth.svg", sprite: "assets/familiars/glimmer_moth.svg",
    passive: { hpRegenPct: 0.012 },
    desc: "Un papillon de lumière : régénère très légèrement les PV de son maître (~1,2 %/tour).",
  },

  // --- Inhabituels ---
  ember_sprite: {
    id: "ember_sprite", name: "Braséon", element: "fire", role: "offensif", rarity: "uncommon",
    image: "assets/familiars/ember_sprite.png", sprite: "assets/familiars/ember_sprite.png",
    passive: { skillPowerPct: 0.05, elementDmgPct: { fire: 0.12 } },
    desc: "Un esprit de flamme : compétences +5 % et dégâts de Feu +12 %.",
  },
  tide_serpent: {
    id: "tide_serpent", name: "Onduleur", element: "water", role: "soutien", rarity: "uncommon",
    image: "assets/familiars/tide_serpent.png", sprite: "assets/familiars/tide_serpent.png",
    passive: { hpRegenPct: 0.02, elementDmgPct: { water: 0.1 } },
    desc: "Un serpent d'eau apaisant : régénère ~2 % PV/tour et Eau +10 %.",
  },
  gale_finch: {
    id: "gale_finch", name: "Bourrasque", element: "wind", role: "rapide", rarity: "uncommon",
    image: "assets/familiars/gale_finch.png", sprite: "assets/familiars/gale_finch.png",
    passive: { spdPct: 0.06, critFlat: 3 },
    desc: "Un oiseau de vent : Clairvoyance +6 % et critique +3 %.",
  },
  thorn_cub: {
    id: "thorn_cub", name: "Ronceau", element: "nature", role: "protecteur", rarity: "uncommon",
    image: "assets/familiars/thorn_cub.png", sprite: "assets/familiars/thorn_cub.png",
    passive: { maxHpPct: 0.06, hpRegenPct: 0.015 },
    desc: "Un petit gardien épineux : PV max +6 % et légère régénération.",
  },

  // --- Rares ---
  cinder_hound: {
    id: "cinder_hound", name: "Tisonnier", element: "fire", role: "rapide", rarity: "rare",
    image: "assets/familiars/cinder_hound.png", sprite: "assets/familiars/cinder_hound.png",
    passive: { spdPct: 0.06, elementDmgPct: { fire: 0.1 } },
    desc: "Un molosse de cendres : Clairvoyance +6 % et Feu +10 %.",
  },
  storm_drake: {
    id: "storm_drake", name: "Fulgureau", element: "lightning", role: "offensif", rarity: "rare",
    image: "assets/familiars/storm_drake.png", sprite: "assets/familiars/storm_drake.png",
    passive: { skillPowerPct: 0.07, elementDmgPct: { lightning: 0.12 } },
    desc: "Un draconnet d'orage : compétences +7 % et Foudre +12 %.",
  },
  grave_wisp: {
    id: "grave_wisp", name: "Funéraille", element: "umbral", role: "offensif", rarity: "rare",
    image: "assets/familiars/grave_wisp.png", sprite: "assets/familiars/grave_wisp.png",
    passive: { lifestealPct: 0.07, elementDmgPct: { umbral: 0.12 } },
    desc: "Une âme errante : vol de vie +7 % et Umbral +12 %.",
  },

  // --- Épiques ---
  dawn_seraph: {
    id: "dawn_seraph", name: "Aurore", element: "light", role: "soutien", rarity: "epic",
    image: "assets/familiars/dawn_seraph.png", sprite: "assets/familiars/dawn_seraph.png",
    passive: { hpRegenPct: 0.03, lifestealPct: 0.05, critFlat: 2 },
    desc: "Un séraphin d'aube : régénère ~3 % PV/tour, vol de vie +5 % et crit +2 %.",
  },
  frost_warden: {
    id: "frost_warden", name: "Givrelin", element: "water", role: "soutien", rarity: "epic",
    image: "assets/familiars/frost_warden.svg", sprite: "assets/familiars/frost_warden.svg",
    passive: { spdPct: 0.05, elementDmgPct: { water: 0.18 } },
    desc: "Un gardien de givre : Clairvoyance +5 % et dégâts d'Eau +18 %.",
  },
  sun_lion: {
    id: "sun_lion", name: "Solfaste", element: "fire", role: "offensif", rarity: "epic",
    image: "assets/familiars/sun_lion.svg", sprite: "assets/familiars/sun_lion.svg",
    passive: { skillPowerPct: 0.09, critFlat: 3 },
    desc: "Un lion solaire : compétences +9 % et critique +3 %.",
  },

  // --- Légendaire (œuf épique / boss) ---
  chaos_orbling: {
    id: "chaos_orbling", name: "Aléacle", element: "chaos", role: "offensif", rarity: "legendary",
    image: "assets/familiars/chaos_orbling.png", sprite: "assets/familiars/chaos_orbling.png",
    passive: { skillPowerPct: 0.1, critFlat: 4, elementDmgPct: { chaos: 0.15 } },
    desc: "Une anomalie vivante : compétences +10 %, crit +4 % et Chaos +15 %.",
  },
  void_revenant: {
    id: "void_revenant", name: "Revenant du Vide", element: "umbral", role: "offensif", rarity: "legendary",
    image: "assets/familiars/void_revenant.svg", sprite: "assets/familiars/void_revenant.svg",
    passive: { lifestealPct: 0.08, elementDmgPct: { umbral: 0.16 } },
    desc: "Un spectre du Vide : vol de vie +8 % et dégâts d'Umbral +16 %.",
  },
  astral_phoenix: {
    id: "astral_phoenix", name: "Phénix astral", element: "light", role: "soutien", rarity: "legendary",
    image: "assets/familiars/astral_phoenix.svg", sprite: "assets/familiars/astral_phoenix.svg",
    passive: { hpRegenPct: 0.025, skillPowerPct: 0.06 },
    desc: "Un phénix d'aube : régénère ~2,5 % PV/tour et compétences +6 %.",
  },
};

export function getFamiliar(id) {
  return FAMILIARS[id] || null;
}

export function allFamiliars() {
  return Object.values(FAMILIARS);
}

// Familiers par rareté (pour le tirage d'éclosion).
export function familiarsByRarity(rarity) {
  return Object.values(FAMILIARS).filter((f) => f.rarity === rarity);
}

// Œufs : 3 paliers. Chaque palier donne une rareté de familier selon des poids
// CLAIRS et TESTABLES (jamais de pay-to-win ; aucune dépense réelle).
export const EGGS = {
  common: { id: "common", name: "Œuf commun", icon: "🥚", weights: { common: 70, uncommon: 30 } },
  rare: { id: "rare", name: "Œuf rare", icon: "🥚", weights: { uncommon: 55, rare: 40, epic: 5 } },
  epic: { id: "epic", name: "Œuf épique", icon: "🥚", weights: { rare: 50, epic: 35, legendary: 15 } },
};

export function getEgg(id) {
  return EGGS[id] || null;
}

// Coût en Essence de familier pour nourrir (un cran de lien).
export const FEED_ESSENCE_COST = 3;
export const LINK_MAX = 10;

// Plafond DUR de régénération de PV apportée par un familier (instr. 100, 298) :
// un familier passif ne doit jamais restaurer plus de quelques pourcents des PV
// max par tour, sinon il neutralise seul un boss.
export const FAMILIAR_REGEN_CAP = 0.03;
