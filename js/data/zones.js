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
    // Progression ORDONNÉE : chaque palier se débloque par le niveau du
    // personnage ET en ayant vaincu le palier précédent `prevKills` fois.
    // `clearKills` = nombre de victoires qui « valide » le palier (progression).
    progression: [
      { enemy: "feral_wolf", level: 1, prevKills: 0, clearKills: 3 },
      { enemy: "goblin_raider", level: 2, prevKills: 3, clearKills: 3 },
      { enemy: "wild_boar", level: 3, prevKills: 3, clearKills: 3 },
      { enemy: "forest_bandit", level: 5, prevKills: 3, clearKills: 3 },
    ],
    // Boss : niveau requis + dernier palier vaincu prevKills fois.
    bossUnlock: { level: 6, prevKills: 3 },
  },
};

export function getZone(id) {
  return ZONES[id] || null;
}

export function allZones() {
  return Object.values(ZONES);
}
