// Zones de combat. Chaque zone liste ses ennemis communs et son boss.
// recommendedLevel : indicatif pour le joueur.

export const ZONES = {
  whispering_forest: {
    id: "whispering_forest",
    name: "Forêt des Murmures",
    icon: "🌲",
    image: "assets/zones/whispering_forest.png",
    // Décor d'arène (image plate, statique). Nouveau biome = nouvelle image ici.
    arena: "assets/arenas/forest.png",
    recommendedLevel: 1,
    desc:
      "Une forêt sombre où bruissent des présences hostiles. " +
      "Le repaire du chef gobelin Grôk se trouve en son cœur.",
    enemies: ["feral_wolf", "goblin_raider", "wild_boar", "forest_bandit"],
    boss: "goblin_chief_grok",
  },
};

export function getZone(id) {
  return ZONES[id] || null;
}

export function allZones() {
  return Object.values(ZONES);
}
