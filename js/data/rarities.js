// Raretés d'équipement. Chaque cran multiplie les stats de base de la pièce et
// se tire plus rarement. `rank` ordonne les raretés (tri, comparaison).
// `mult` : multiplicateur appliqué aux stats positives de la pièce.
// `weight` / `luckGain` : poids de tirage de base et sensibilité à la « chance »
// (ennemis forts / boss -> meilleur loot). Voir core/items.js.

export const RARITIES = {
  common: {
    id: "common",
    name: "Commun",
    rank: 0,
    color: "#aeb6c2",
    mult: 1.0,
    weight: 100,
    luckGain: 0,
  },
  uncommon: {
    id: "uncommon",
    name: "Inhabituel",
    rank: 1,
    color: "#54d36a",
    mult: 1.18,
    weight: 42,
    luckGain: 1.2,
  },
  rare: {
    id: "rare",
    name: "Rare",
    rank: 2,
    color: "#4ea3ff",
    mult: 1.38,
    weight: 15,
    luckGain: 2.4,
  },
  epic: {
    id: "epic",
    name: "Épique",
    rank: 3,
    color: "#b96bff",
    mult: 1.62,
    weight: 4,
    luckGain: 4.5,
  },
  legendary: {
    id: "legendary",
    name: "Légendaire",
    rank: 4,
    color: "#f0a93b",
    mult: 1.95,
    weight: 0.7,
    luckGain: 7.5,
  },
};

// Ordre croissant (commun -> légendaire).
export const RARITY_ORDER = Object.values(RARITIES).sort((a, b) => a.rank - b.rank);

export function getRarity(id) {
  return RARITIES[id] || RARITIES.common;
}
