// Ennemis et boss. stats : { hp, atk, def, spd, crit }.
// skills : compétences ennemies (voir data/skills.js) ; l'attaque de base est implicite.
// drops : { item, type, min, max, chance } ; type "resource" ou "equipment".
// xp / gold : récompenses de victoire.

export const ENEMIES = {
  feral_wolf: {
    id: "feral_wolf",
    name: "Loup affamé",
    isBoss: false,
    level: 1,
    icon: "🐺",
    image: "assets/enemies/feral_wolf.png",
    sprite: "assets/sprites/feral_wolf.png",
    stats: { hp: 55, atk: 12, def: 3, spd: 16, crit: 8 },
    skills: ["feral_bite"],
    xp: 16,
    gold: 4,
    drops: [{ item: "raw_hide", type: "resource", min: 1, max: 2, chance: 0.85 }],
  },
  goblin_raider: {
    id: "goblin_raider",
    name: "Gobelin pillard",
    isBoss: false,
    level: 2,
    icon: "👺",
    image: "assets/enemies/goblin_raider.png",
    sprite: "assets/sprites/goblin_raider.png",
    stats: { hp: 70, atk: 14, def: 5, spd: 12, crit: 6 },
    skills: ["goblin_smash"],
    xp: 24,
    gold: 8,
    drops: [
      { item: "coarse_cloth", type: "resource", min: 1, max: 2, chance: 0.8 },
      { item: "copper_ore", type: "resource", min: 1, max: 1, chance: 0.4 },
    ],
  },
  wild_boar: {
    id: "wild_boar",
    name: "Sanglier sauvage",
    isBoss: false,
    level: 3,
    icon: "🐗",
    image: "assets/enemies/wild_boar.png",
    sprite: "assets/sprites/wild_boar.png",
    stats: { hp: 110, atk: 15, def: 8, spd: 9, crit: 4 },
    skills: [],
    xp: 32,
    gold: 10,
    drops: [
      { item: "raw_hide", type: "resource", min: 2, max: 3, chance: 0.9 },
      { item: "coarse_cloth", type: "resource", min: 0, max: 1, chance: 0.3 },
    ],
  },
  forest_bandit: {
    id: "forest_bandit",
    name: "Bandit des bois",
    isBoss: false,
    level: 4,
    icon: "🗡️",
    image: "assets/enemies/forest_bandit.png",
    sprite: "assets/sprites/forest_bandit.png",
    stats: { hp: 95, atk: 18, def: 7, spd: 14, crit: 10 },
    skills: ["goblin_smash"],
    xp: 40,
    gold: 18,
    drops: [
      { item: "coarse_cloth", type: "resource", min: 1, max: 2, chance: 0.7 },
      { item: "iron_ore", type: "resource", min: 1, max: 1, chance: 0.25 },
    ],
  },

  // --- Boss ---
  goblin_chief_grok: {
    id: "goblin_chief_grok",
    name: "Grôk, Chef Gobelin",
    isBoss: true,
    level: 6,
    icon: "👹",
    image: "assets/enemies/goblin_chief_grok.png",
    sprite: "assets/sprites/goblin_chief_grok.png",
    stats: { hp: 420, atk: 24, def: 12, spd: 11, crit: 9 },
    skills: ["boss_cleave", "boss_roar"],
    xp: 220,
    gold: 80,
    drops: [
      { item: "rough_gem", type: "resource", min: 1, max: 2, chance: 1 },
      { item: "iron_ingot", type: "resource", min: 2, max: 3, chance: 1 },
      { item: "gem_amulet", type: "equipment", min: 1, max: 1, chance: 0.2 },
    ],
  },
};

export function getEnemy(id) {
  return ENEMIES[id] || null;
}
