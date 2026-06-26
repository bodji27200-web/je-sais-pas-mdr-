// Ennemis et boss. stats : { hp, atk, def, spd, crit }.
// role    : archétype de combat (informe l'IA : voir systems/combat.js).
//           skirmisher | brute | bruiser | tank | caster | boss
// passive : passive ennemie (effet dynamique en combat ; voir data/skills.js).
// skills  : compétences ennemies (l'attaque de base est implicite).
// drops   : { item, type, min, max, chance } ; type "resource" ou "equipment".
// xp / gold : récompenses de victoire.

export const ENEMIES = {
  feral_wolf: {
    id: "feral_wolf",
    name: "Loup affamé",
    isBoss: false,
    level: 1,
    role: "skirmisher",
    icon: "🐺",
    image: "assets/enemies/feral_wolf.png",
    sprite: "assets/sprites/feral_wolf.png",
    stats: { hp: 62, atk: 13, def: 3, spd: 17, crit: 10 },
    skills: ["feral_bite", "rending_claws"],
    passive: null,
    xp: 18,
    gold: 4,
    drops: [{ item: "raw_hide", type: "resource", min: 1, max: 2, chance: 0.85 }],
  },
  goblin_raider: {
    id: "goblin_raider",
    name: "Gobelin pillard",
    isBoss: false,
    level: 2,
    role: "brute",
    icon: "👺",
    image: "assets/enemies/goblin_raider.png",
    sprite: "assets/sprites/goblin_raider.png",
    stats: { hp: 88, atk: 16, def: 6, spd: 12, crit: 6 },
    skills: ["goblin_smash", "goblin_throw"],
    passive: "enrage",
    xp: 26,
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
    role: "bruiser",
    icon: "🐗",
    image: "assets/enemies/wild_boar.png",
    sprite: "assets/sprites/wild_boar.png",
    stats: { hp: 150, atk: 18, def: 12, spd: 9, crit: 4 },
    skills: ["boar_charge", "boar_gore"],
    passive: "regeneration",
    xp: 36,
    gold: 11,
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
    role: "skirmisher",
    icon: "🗡️",
    image: "assets/enemies/forest_bandit.png",
    sprite: "assets/sprites/forest_bandit.png",
    stats: { hp: 112, atk: 21, def: 8, spd: 15, crit: 14 },
    skills: ["bandit_shiv", "smoke_step"],
    passive: null,
    xp: 44,
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
    role: "boss",
    icon: "👹",
    image: "assets/enemies/goblin_chief_grok.png",
    sprite: "assets/sprites/goblin_chief_grok.png",
    stats: { hp: 680, atk: 30, def: 16, spd: 12, crit: 12 },
    skills: ["boss_cleave", "boss_roar", "boss_quake", "boss_guard"],
    passive: "enrage",
    xp: 240,
    gold: 90,
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
