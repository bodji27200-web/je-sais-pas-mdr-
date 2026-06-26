// Ennemis et boss. stats : { hp, atk, def, spd, crit }.
// role    : archétype de combat (informe l'IA : voir systems/combat.js).
//           skirmisher | brute | bruiser | tank | caster | boss
// passive : passive ennemie (effet dynamique en combat ; voir data/skills.js).
// skills  : compétences ennemies (l'attaque de base est implicite).
// resist  : facteurs élémentaires { element: facteur }. <1 = résiste, >1 = faible.
//           (Stratégie alternative, jamais obligatoire — voir cahier des charges.)
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
    resist: { fire: 1.3, nature: 0.8 }, // pelage inflammable ; endurci à la nature
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
    resist: { fire: 0.8, water: 1.25 }, // coriace au feu, vulnérable à l'eau
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
    resist: { fire: 1.3, nature: 0.7 }, // sa régénération naturelle craint le feu
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
    resist: { water: 0.85, lightning: 1.25 }, // armure mouillée : conduit la foudre
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
    resist: { fire: 0.8, water: 1.25, lightning: 1.15 }, // Trempé puis foudroyé : combo gagnant
    xp: 240,
    gold: 90,
    drops: [
      { item: "rough_gem", type: "resource", min: 1, max: 2, chance: 1 },
      { item: "iron_ingot", type: "resource", min: 2, max: 3, chance: 1 },
      { item: "gem_amulet", type: "equipment", min: 1, max: 1, chance: 0.2 },
      { item: "common", type: "egg", min: 1, max: 1, chance: 0.5 }, // œuf de familier
    ],
  },

  // ===================== ZONE 2 : Carrière d'Ombrepierre =====================
  dust_weaver: {
    id: "dust_weaver", name: "Tisseur de poussière", isBoss: false, level: 6, role: "skirmisher",
    icon: "🌫️", image: "assets/enemies/dust_weaver.png", sprite: "assets/sprites/dust_weaver.png",
    stats: { hp: 140, atk: 23, def: 7, spd: 13, crit: 8 },
    skills: ["dust_bolt", "spectral_wail"], passive: null,
    resist: { umbral: 0.8, light: 1.25 },
    xp: 60, gold: 20,
    drops: [
      { item: "stone", type: "resource", min: 2, max: 4, chance: 0.9 },
      { item: "coarse_cloth", type: "resource", min: 1, max: 2, chance: 0.5 },
    ],
  },
  miner_wraith: {
    id: "miner_wraith", name: "Spectre de mineur", isBoss: false, level: 7, role: "caster",
    icon: "👻", image: "assets/enemies/miner_wraith.png", sprite: "assets/sprites/miner_wraith.png",
    stats: { hp: 160, atk: 27, def: 8, spd: 12, crit: 10 },
    skills: ["soul_drain", "spectral_wail"], passive: null,
    resist: { umbral: 0.7, light: 1.3, nature: 0.9 },
    xp: 72, gold: 26,
    drops: [
      { item: "rough_gem", type: "resource", min: 1, max: 2, chance: 0.6 },
      { item: "coal", type: "resource", min: 1, max: 2, chance: 0.6 },
    ],
  },
  shale_golem: {
    id: "shale_golem", name: "Golem de schiste", isBoss: false, level: 8, role: "tank",
    icon: "🪨", image: "assets/enemies/shale_golem.png", sprite: "assets/sprites/shale_golem.png",
    stats: { hp: 340, atk: 23, def: 24, spd: 6, crit: 3 },
    skills: ["stone_fist", "brace"], passive: "regeneration",
    resist: { umbral: 0.85, nature: 1.2, wind: 1.2 },
    xp: 96, gold: 30,
    drops: [
      { item: "stone", type: "resource", min: 3, max: 6, chance: 1 },
      { item: "iron_ore", type: "resource", min: 1, max: 2, chance: 0.6 },
    ],
  },
  echo_bat: {
    id: "echo_bat", name: "Chiroptère d'écho", isBoss: false, level: 9, role: "skirmisher",
    icon: "🦇", image: "assets/enemies/echo_bat.png", sprite: "assets/sprites/echo_bat.png",
    stats: { hp: 185, atk: 29, def: 7, spd: 23, crit: 14 },
    skills: ["screech", "dive"], passive: null,
    resist: { wind: 0.8, lightning: 1.25 },
    xp: 110, gold: 34,
    drops: [
      { item: "raw_hide", type: "resource", min: 2, max: 3, chance: 0.85 },
      { item: "coarse_cloth", type: "resource", min: 1, max: 2, chance: 0.5 },
    ],
  },
  damned_foreman: {
    id: "damned_foreman", name: "Contremaître damné", isBoss: false, level: 10, role: "brute",
    icon: "⛏️", image: "assets/enemies/damned_foreman.png", sprite: "assets/sprites/damned_foreman.png",
    stats: { hp: 320, atk: 33, def: 15, spd: 12, crit: 10 },
    skills: ["cursed_smash", "dark_rally"], passive: "enrage",
    resist: { umbral: 0.7, light: 1.3 },
    xp: 150, gold: 48,
    drops: [
      { item: "silver_ore", type: "resource", min: 1, max: 2, chance: 0.7 },
      { item: "rough_gem", type: "resource", min: 1, max: 2, chance: 0.6 },
    ],
  },
  vorrak_collapse: {
    id: "vorrak_collapse", name: "Vorrak, l'Effondrement", isBoss: true, level: 11, role: "boss",
    icon: "💀", image: "assets/enemies/vorrak_collapse.png", sprite: "assets/sprites/vorrak_collapse.png",
    stats: { hp: 1100, atk: 38, def: 20, spd: 11, crit: 10 },
    skills: ["vorrak_smash", "soul_harvest", "grave_ward"], passive: "enrage",
    secondPassive: "soul_siphon",
    resist: { umbral: 0.6, light: 1.35, nature: 1.15 },
    // Phases : se déclenchent quand les PV passent SOUS atHpPct. `set` = règles
    // persistantes ; `heal`/`clearShields`/`grant` = effets à l'entrée.
    phases: [
      { atHpPct: 0.6, name: "Le gouffre s'ouvre", announce: "Vorrak fait s'effondrer les galeries : tes barrières volent en éclats !",
        set: { atkPct: 0.2, element: "umbral", clearShields: true } },
      { atHpPct: 0.3, name: "Dernier effondrement", announce: "Vorrak puise dans les âmes : la roche se liquéfie sous tes pieds.",
        set: { atkPct: 0.4, defShredPct: 0.25 }, grant: "collapse", heal: 0.08 },
    ],
    xp: 520, gold: 180,
    drops: [
      { item: "silver_ingot", type: "resource", min: 2, max: 3, chance: 1 },
      { item: "rough_gem", type: "resource", min: 2, max: 4, chance: 1 },
      { item: "silver_amulet", type: "equipment", min: 1, max: 1, chance: 0.25 },
      { item: "rare", type: "egg", min: 1, max: 1, chance: 0.6 }, // œuf rare de familier
    ],
  },

  // ===================== ZONE 3 : Cendres de Pyrelac =====================
  magma_larva: {
    id: "magma_larva", name: "Larve de magma", isBoss: false, level: 10, role: "skirmisher",
    icon: "🐛", image: "assets/enemies/magma_larva.png", sprite: "assets/sprites/magma_larva.png",
    stats: { hp: 210, atk: 31, def: 9, spd: 11, crit: 6 },
    skills: ["ember_spit"], passive: null,
    resist: { fire: 0.6, water: 1.35 },
    xp: 150, gold: 44,
    drops: [
      { item: "stone", type: "resource", min: 2, max: 4, chance: 0.9 },
      { item: "coal", type: "resource", min: 1, max: 2, chance: 0.7 },
    ],
  },
  spark_elemental: {
    id: "spark_elemental", name: "Élémentaire d'étincelles", isBoss: false, level: 11, role: "caster",
    icon: "⚡", image: "assets/enemies/spark_elemental.png", sprite: "assets/sprites/spark_elemental.png",
    stats: { hp: 215, atk: 34, def: 8, spd: 18, crit: 12 },
    skills: ["arc_zap", "ember_spit"], passive: null,
    resist: { lightning: 0.6, nature: 1.2, water: 1.15 },
    xp: 165, gold: 48,
    drops: [
      { item: "coal", type: "resource", min: 1, max: 3, chance: 0.8 },
      { item: "silver_ore", type: "resource", min: 1, max: 2, chance: 0.5 },
    ],
  },
  ash_carapace: {
    id: "ash_carapace", name: "Carapace de cendre", isBoss: false, level: 12, role: "tank",
    icon: "🛡️", image: "assets/enemies/ash_carapace.png", sprite: "assets/sprites/ash_carapace.png",
    stats: { hp: 440, atk: 27, def: 26, spd: 6, crit: 3 },
    skills: ["stone_fist", "cinder_guard"], passive: "regeneration",
    resist: { fire: 0.5, water: 1.3, umbral: 0.9 },
    xp: 200, gold: 56,
    drops: [
      { item: "stone", type: "resource", min: 3, max: 6, chance: 1 },
      { item: "iron_ore", type: "resource", min: 1, max: 3, chance: 0.6 },
      { item: "coal", type: "resource", min: 1, max: 2, chance: 0.6 },
    ],
  },
  sulfur_prowler: {
    id: "sulfur_prowler", name: "Rôdeur de soufre", isBoss: false, level: 13, role: "skirmisher",
    icon: "🦂", image: "assets/enemies/sulfur_prowler.png", sprite: "assets/sprites/sulfur_prowler.png",
    stats: { hp: 240, atk: 39, def: 10, spd: 21, crit: 16 },
    skills: ["sear_claw", "bandit_shiv"], passive: null,
    resist: { fire: 0.7, water: 1.25 },
    xp: 230, gold: 64,
    drops: [
      { item: "raw_hide", type: "resource", min: 2, max: 4, chance: 0.85 },
      { item: "silver_ore", type: "resource", min: 1, max: 2, chance: 0.55 },
    ],
  },
  flame_priest: {
    id: "flame_priest", name: "Prêtre des flammes", isBoss: false, level: 14, role: "caster",
    icon: "🔥", image: "assets/enemies/flame_priest.png", sprite: "assets/sprites/flame_priest.png",
    stats: { hp: 350, atk: 36, def: 14, spd: 13, crit: 10 },
    skills: ["flame_lash", "searing_mend"], passive: "regeneration",
    resist: { fire: 0.6, water: 1.3, umbral: 1.2 }, // vulnérable à l'Umbral : Marque funéraire coupe ses soins
    xp: 280, gold: 78,
    drops: [
      { item: "silver_ingot", type: "resource", min: 1, max: 2, chance: 0.7 },
      { item: "rough_gem", type: "resource", min: 1, max: 2, chance: 0.6 },
    ],
  },
  ignar_emberheart: {
    id: "ignar_emberheart", name: "Ignar, Cœur de Braise", isBoss: true, level: 15, role: "boss",
    icon: "🌋", image: "assets/enemies/ignar_emberheart.png", sprite: "assets/sprites/ignar_emberheart.png",
    stats: { hp: 1000, atk: 34, def: 18, spd: 12, crit: 12 },
    skills: ["ignar_slam", "flame_wave", "thunder_call", "ember_shield"], passive: "enrage",
    secondPassive: "boss_resilience",
    resist: { fire: 0.5, water: 1.4, umbral: 1.1 },
    phases: [
      { atHpPct: 0.65, name: "Surchauffe", announce: "Ignar entre en surchauffe : sa fournaise se ravive (il se régénère).",
        set: { atkPct: 0.2, element: "fire" }, heal: 0.1 },
      { atHpPct: 0.33, name: "Tempête de braises", announce: "Le cœur d'Ignar explose en foudre : il change d'élément et invoque les météores !",
        set: { atkPct: 0.35, element: "lightning", defShredPct: 0.2, clearShields: true }, grant: "meteor" },
    ],
    xp: 640, gold: 220,
    drops: [
      { item: "silver_ingot", type: "resource", min: 2, max: 4, chance: 1 },
      { item: "rough_gem", type: "resource", min: 2, max: 4, chance: 1 },
      { item: "ancient_staff", type: "equipment", min: 1, max: 1, chance: 0.2 },
      { item: "epic", type: "egg", min: 1, max: 1, chance: 0.5 }, // œuf épique de familier
    ],
  },
};

export function getEnemy(id) {
  return ENEMIES[id] || null;
}
