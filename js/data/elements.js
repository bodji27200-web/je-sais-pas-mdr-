// Éléments de l'univers — data-driven. Chaque élément a une couleur, une icône
// de secours et l'état qu'il a tendance à appliquer (voir data/states.js).
//
// Univers propre au jeu (aucun emprunt) :
//   Umbral = morts, âmes, spectres, monde funéraire (≠ simples ténèbres).
//   Chaos  = instabilité, altération, anomalies contrôlées.

export const ELEMENTS = {
  fire: { id: "fire", name: "Feu", color: "#ff6b3d", icon: "🔥", state: "burn" },
  water: { id: "water", name: "Eau", color: "#4ea3ff", icon: "💧", state: "wet" },
  wind: { id: "wind", name: "Vent", color: "#8fe3b0", icon: "🌀", state: "unbalance" },
  nature: { id: "nature", name: "Nature", color: "#7ec850", icon: "🌿", state: "root" },
  lightning: { id: "lightning", name: "Foudre", color: "#f5d24e", icon: "⚡", state: "charge" },
  light: { id: "light", name: "Lumière", color: "#ffe9a8", icon: "✨", state: "expose" },
  chaos: { id: "chaos", name: "Chaos", color: "#c45cff", icon: "🌌", state: "unstable" },
  umbral: { id: "umbral", name: "Umbral", color: "#8a7fae", icon: "💀", state: "soulmark" },
};

export function getElement(id) {
  return ELEMENTS[id] || null;
}

export const ELEMENT_ORDER = Object.keys(ELEMENTS);
