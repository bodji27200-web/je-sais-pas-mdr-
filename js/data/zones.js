// Zones de combat. Chaque zone liste ses ennemis communs et son boss.
// recommendedLevel : indicatif pour le joueur.

export const ZONES = {
  whispering_forest: {
    id: "whispering_forest",
    name: "Forêt des Murmures",
    icon: "🌲",
    image: "assets/zones/whispering_forest.png",
    // Décor d'arène : image fournie par le joueur (fichier direct, pas de
    // remplacement CSS/SVG). Paysage 1672×941.
    arena: "assets/backgrounds/zone1.png",
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

  shadowstone_quarry: {
    id: "shadowstone_quarry",
    name: "Carrière d'Ombrepierre",
    icon: "⛰️",
    image: "assets/zones/shadowstone_quarry.png",
    arena: "assets/backgrounds/zone2.png",
    recommendedLevel: 6,
    elements: ["umbral", "nature"], // éléments dominants de la zone
    desc:
      "Une carrière abandonnée où la pierre garde l'écho des mineurs morts. " +
      "Les âmes y marquent les vivants ; Vorrak veille sur l'effondrement.",
    enemies: ["dust_weaver", "miner_wraith", "shale_golem", "echo_bat", "damned_foreman"],
    boss: "vorrak_collapse",
    // La zone se débloque après avoir vaincu le boss de la zone précédente.
    unlock: { prevBoss: "goblin_chief_grok" },
    progression: [
      { enemy: "dust_weaver", level: 6, prevKills: 0, clearKills: 3 },
      { enemy: "miner_wraith", level: 7, prevKills: 3, clearKills: 3 },
      { enemy: "shale_golem", level: 8, prevKills: 3, clearKills: 3 },
      { enemy: "echo_bat", level: 9, prevKills: 3, clearKills: 3 },
      { enemy: "damned_foreman", level: 10, prevKills: 3, clearKills: 3 },
    ],
    bossUnlock: { level: 11, prevKills: 3 },
  },

  pyrelake_ashes: {
    id: "pyrelake_ashes",
    name: "Cendres de Pyrelac",
    icon: "🌋",
    image: "assets/zones/pyrelake_ashes.png",
    arena: "assets/backgrounds/zone3.png",
    recommendedLevel: 11,
    elements: ["fire", "lightning"],
    desc:
      "Un lac de lave figé sous une pluie de cendres. La chaleur brûle, la " +
      "foudre crépite, et Ignar bat tel un cœur de braise au centre du cratère.",
    enemies: ["magma_larva", "spark_elemental", "ash_carapace", "sulfur_prowler", "flame_priest"],
    boss: "ignar_emberheart",
    unlock: { prevBoss: "vorrak_collapse" },
    progression: [
      { enemy: "magma_larva", level: 11, prevKills: 0, clearKills: 3 },
      { enemy: "spark_elemental", level: 11, prevKills: 3, clearKills: 3 },
      { enemy: "ash_carapace", level: 12, prevKills: 3, clearKills: 3 },
      { enemy: "sulfur_prowler", level: 13, prevKills: 3, clearKills: 3 },
      { enemy: "flame_priest", level: 14, prevKills: 3, clearKills: 3 },
    ],
    bossUnlock: { level: 15, prevKills: 3 },
  },
};

export function getZone(id) {
  return ZONES[id] || null;
}

export function allZones() {
  return Object.values(ZONES);
}
