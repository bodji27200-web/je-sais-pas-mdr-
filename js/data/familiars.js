// Familiers — REFONTE « combattants » (Lot 16), inspirée des familiers-combattants
// des MMO/RPG d'action : un familier équipé COMBAT à tes côtés sur le terrain,
// avec ses PROPRES compétences et sa PROPRE IA. Il n'a PAS de PV (ce n'est pas un
// joueur : il ne peut être ni tué ni ciblé), mais il agit chaque tour selon ses
// compétences. Plus un familier a d'ÉTOILES (lié à la rareté), plus il est fort
// et plus il dispose de compétences.
//
// Garde-fous d'équilibrage (instr.) :
//   - dégâts/effets MODÉRÉS et plafonnés -> un familier ne gagne jamais un combat
//     de boss à la place du joueur ;
//   - bonus de niveau et de lien plafonnés ;
//   - régénération de PV apportée TRÈS faible (FAMILIAR_REGEN_CAP) ;
//   - chaque familier a un RÔLE distinct (pas deux fois le même effet en plus gros).
//
// Champs d'un familier :
//   element, role, rarity, stars (étoiles de base), skills (compétences propres),
//   image/sprite, desc.

import { FAM_SKILLS } from "./famskills.js";

export const FAMILIAR_ROLES = {
  attaquant: { id: "attaquant", name: "Attaquant", icon: "" },
  gardien: { id: "gardien", name: "Gardien", icon: "" },
  soutien: { id: "soutien", name: "Soutien", icon: "" },
  saboteur: { id: "saboteur", name: "Saboteur", icon: "" },
  invocation: { id: "invocation", name: "Soutien d'invocation", icon: "" },
};

// Étoiles de base par rareté (plus d'étoiles = plus fort + plus de compétences).
export const STARS_BY_RARITY = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

export const FAMILIARS = {
  // ============================ COMMUNS (3+) ============================
  pebble_mite: {
    id: "pebble_mite", name: "Pétroglyphe", element: "nature", role: "gardien", rarity: "common", stars: 1,
    image: "assets/familiars/pebble_mite.png", sprite: "assets/familiars/pebble_mite.png",
    skills: ["fam_guard_mend", "fam_pebble_strike"],
    desc: "Petite créature de pierre. Restaure la réserve de Garde de son maître et frappe faiblement.",
  },
  spark_mote: {
    id: "spark_mote", name: "Grésille", element: "lightning", role: "saboteur", rarity: "common", stars: 1,
    image: "assets/familiars/spark_mote.png", sprite: "assets/familiars/spark_mote.png",
    skills: ["fam_static_jolt"],
    desc: "Étincelle vive : décharge sur l'ennemi et le ralentit légèrement.",
  },
  glimmer_moth: {
    id: "glimmer_moth", name: "Lampyre", element: "light", role: "soutien", rarity: "common", stars: 1,
    image: "assets/familiars/glimmer_moth.png", sprite: "assets/familiars/glimmer_moth.png",
    skills: ["fam_cleanse"],
    desc: "Papillon de lumière : purifie une altération de son maître (poison, saignement, malus).",
  },

  // ============================ INHABITUELS (3+) ============================
  ember_sprite: {
    id: "ember_sprite", name: "Braséon", element: "fire", role: "attaquant", rarity: "uncommon", stars: 2,
    image: "assets/familiars/ember_sprite.png", sprite: "assets/familiars/ember_sprite.png",
    skills: ["fam_ember_bolt", "fam_pebble_strike"],
    desc: "Esprit de flamme : projette des braises (Feu) qui peuvent embraser.",
  },
  tide_serpent: {
    id: "tide_serpent", name: "Onduleur", element: "water", role: "soutien", rarity: "uncommon", stars: 2,
    image: "assets/familiars/tide_serpent.png", sprite: "assets/familiars/tide_serpent.png",
    skills: ["fam_mana_font", "fam_water_jet"],
    desc: "Serpent d'eau : stabilise la ressource de son maître et asperge l'ennemi (Trempé).",
  },
  gale_finch: {
    id: "gale_finch", name: "Bourrasque", element: "wind", role: "soutien", rarity: "uncommon", stars: 2,
    image: "assets/familiars/gale_finch.png", sprite: "assets/familiars/gale_finch.png",
    skills: ["fam_haste_song", "fam_gust"],
    desc: "Oiseau de vent : presse le pas de son maître (Clairvoyance) et déséquilibre l'ennemi.",
  },
  thorn_cub: {
    id: "thorn_cub", name: "Ronceau", element: "nature", role: "gardien", rarity: "uncommon", stars: 2,
    image: "assets/familiars/thorn_cub.png", sprite: "assets/familiars/thorn_cub.png",
    skills: ["fam_bramble_ward", "fam_pebble_strike"],
    desc: "Gardien épineux : réduit le PREMIER gros impact subi par son maître et riposte.",
  },

  // ============================ RARES (3+) ============================
  cinder_hound: {
    id: "cinder_hound", name: "Tisonnier", element: "fire", role: "attaquant", rarity: "rare", stars: 3,
    image: "assets/familiars/cinder_hound.png", sprite: "assets/familiars/cinder_hound.png",
    skills: ["fam_ember_bolt", "fam_rend", "fam_haste_song"],
    desc: "Molosse de cendres : frappes rapides de Feu et saignement.",
  },
  storm_drake: {
    id: "storm_drake", name: "Fulgureau", element: "lightning", role: "attaquant", rarity: "rare", stars: 3,
    image: "assets/familiars/storm_drake.png", sprite: "assets/familiars/storm_drake.png",
    skills: ["fam_storm_bolt", "fam_static_jolt", "fam_expose_mark"],
    desc: "Draconnet d'orage : foudre (exploite Trempé) et marque l'ennemi (Charge).",
  },
  grave_wisp: {
    id: "grave_wisp", name: "Funéraille", element: "umbral", role: "invocation", rarity: "rare", stars: 3,
    image: "assets/familiars/grave_wisp.png", sprite: "assets/familiars/grave_wisp.png",
    skills: ["fam_soul_offering", "fam_grave_chill", "fam_pebble_strike"],
    desc: "Âme errante : offre des Fragments d'âme (soutien d'invocation) et coupe les soins ennemis.",
  },
  warding_sprite: {
    id: "warding_sprite", name: "Égidon", element: "light", role: "gardien", rarity: "rare", stars: 3,
    image: "assets/familiars/warding_sprite.svg", sprite: "assets/familiars/warding_sprite.svg",
    skills: ["fam_ward_aegis", "fam_cleanse", "fam_expose_mark"],
    desc: "Esprit protecteur : protège des altérations et purifie. (Illustration PNG à fournir.)",
  },

  // ============================ ÉPIQUES (3+) ============================
  dawn_seraph: {
    id: "dawn_seraph", name: "Aurore", element: "light", role: "soutien", rarity: "epic", stars: 4,
    image: "assets/familiars/dawn_seraph.png", sprite: "assets/familiars/dawn_seraph.png",
    skills: ["fam_mend", "fam_rally", "fam_cleanse"],
    desc: "Séraphin d'aube : faibles soins (plafonnés), galvanise l'attaque et purifie.",
  },
  frost_warden: {
    id: "frost_warden", name: "Givrelin", element: "water", role: "saboteur", rarity: "epic", stars: 4,
    image: "assets/familiars/frost_warden.svg", sprite: "assets/familiars/frost_warden.svg",
    skills: ["fam_frost_bite", "fam_weaken", "fam_water_jet"],
    desc: "Gardien de givre : ralentit, affaiblit l'attaque et prépare les réactions Foudre. (PNG à fournir.)",
  },
  sun_lion: {
    id: "sun_lion", name: "Solfaste", element: "fire", role: "attaquant", rarity: "epic", stars: 4,
    image: "assets/familiars/sun_lion.svg", sprite: "assets/familiars/sun_lion.svg",
    skills: ["fam_solar_maul", "fam_rend", "fam_rally"],
    desc: "Lion solaire : frappes lourdes de Feu, saignement et galvanisation. (PNG à fournir.)",
  },

  // ============================ LÉGENDAIRES (3+) ============================
  chaos_orbling: {
    id: "chaos_orbling", name: "Aléacle", element: "chaos", role: "attaquant", rarity: "legendary", stars: 5,
    image: "assets/familiars/chaos_orbling.png", sprite: "assets/familiars/chaos_orbling.png",
    skills: ["fam_chaos_burst", "fam_expose_mark", "fam_disrupt"],
    desc: "Anomalie vivante : déflagrations de Chaos, marque et dissipe les renforts ennemis.",
  },
  void_revenant: {
    id: "void_revenant", name: "Revenant du Vide", element: "umbral", role: "invocation", rarity: "legendary", stars: 5,
    image: "assets/familiars/void_revenant.svg", sprite: "assets/familiars/void_revenant.svg",
    skills: ["fam_soul_offering", "fam_void_lance", "fam_grave_chill"],
    desc: "Spectre du Vide : Fragments d'âme abondants, lance d'Umbral et soins ennemis coupés. (PNG à fournir.)",
  },
  astral_phoenix: {
    id: "astral_phoenix", name: "Phénix astral", element: "light", role: "soutien", rarity: "legendary", stars: 5,
    image: "assets/familiars/astral_phoenix.svg", sprite: "assets/familiars/astral_phoenix.svg",
    skills: ["fam_mend", "fam_guard_mend", "fam_rally", "fam_cleanse"],
    desc: "Phénix d'aube : soutien complet (soins plafonnés, Garde, galvanisation, purification). (PNG à fournir.)",
  },
};

export function getFamiliar(id) {
  return FAMILIARS[id] || null;
}
export function allFamiliars() {
  return Object.values(FAMILIARS);
}
export function familiarsByRarity(rarity) {
  return Object.values(FAMILIARS).filter((f) => f.rarity === rarity);
}

// Étoiles effectives d'un familier (base de rareté ; +1 étoile à lien max).
export function familiarStars(fam, owned) {
  const base = fam.stars || STARS_BY_RARITY[fam.rarity] || 1;
  const bonus = owned && owned.link >= LINK_MAX ? 1 : 0; // récompense d'attachement, plafonnée
  return Math.min(6, base + bonus);
}

// Compétences disponibles du familier selon ses étoiles (plus d'étoiles = plus de
// compétences actives, jusqu'au nombre déclaré).
export function familiarUsableSkills(fam, stars) {
  const max = Math.max(1, Math.min(fam.skills.length, Math.ceil(stars / 1.5)));
  return fam.skills.slice(0, max).map((id) => FAM_SKILLS[id]).filter(Boolean);
}

// Œufs : 3 paliers (probabilités claires et testables).
export const EGGS = {
  common: { id: "common", name: "Œuf commun", icon: "", weights: { common: 70, uncommon: 30 } },
  rare: { id: "rare", name: "Œuf rare", icon: "", weights: { uncommon: 55, rare: 40, epic: 5 } },
  epic: { id: "epic", name: "Œuf épique", icon: "", weights: { rare: 50, epic: 35, legendary: 15 } },
};
export function getEgg(id) {
  return EGGS[id] || null;
}

export const FEED_ESSENCE_COST = 3;
export const LINK_MAX = 10;

// Plafond DUR de régénération de PV qu'un familier peut apporter au héros par tour
// (instr.) : même un soin de familier reste très faible.
export const FAMILIAR_REGEN_CAP = 0.03;
