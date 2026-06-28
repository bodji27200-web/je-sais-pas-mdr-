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
    level: 5,
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
    // Équilibrage Lot 8 : un boss ne doit pas se faire encaisser sans subir de
    // dégâts. Plus de pression offensive + Précision (acc) pour qu'il touche
    // vraiment, sans gonfler aveuglément ses PV (instr. 22, 330, 333).
    stats: { hp: 760, atk: 42, def: 18, spd: 15, crit: 14, acc: 48 },
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
    id: "magma_larva", name: "Larve de magma", isBoss: false, level: 11, role: "skirmisher",
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
    // Boss de fin : vraie RÉSISTANCE magique (instr. équilibrage — on tempère les
    // nukes par la Résistance, PAS par une inflation de PV) et un peu de Précision
    // pour percer l'esquive. PV inchangés (1000).
    stats: { hp: 780, atk: 34, def: 18, spd: 12, crit: 12, res: 130, acc: 24 },
    // Fournaise : chaleur ambiante INÉVITABLE qui ronge le héros chaque manche
    // (~2 % de ses PV max). Sert à rendre les no-hit EXCEPTIONNELS sans gonfler les
    // PV ni le burst d'Ignar : il faut tuer avant que la chaleur ne morde.
    aura: { pctMaxHp: 0.02, element: "fire", name: "Fournaise d'Ignar" },
    // Plafond d'encaissement : aucune frappe ne lui retire plus de 18 % de ses PV
    // max d'un coup. Empêche les one-shots (mage burst) : le boss agit forcément et
    // la Fournaise mord -> no-hit exceptionnels, SANS inflation de PV/dégâts.
    hitCap: 0.32,
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

  // ===========================================================================
  // CONTENU ENDGAME (Lot 17) — 5 nouvelles zones de boss (après Ignar).
  // Réutilise compétences/ressources/équipements existants (intégrité préservée).
  // ===========================================================================

  // --- Zone 4 : Pics du Vent Gelé (niv. 16-22, Vent/Eau) ---------------------
  frost_revenant: { id: "frost_revenant", name: "Revenant de givre", isBoss: false, level: 16, role: "caster",
    icon: "👻", image: "assets/enemies/frost_revenant.png", sprite: "assets/sprites/frost_revenant.png",
    stats: { hp: 520, atk: 40, def: 22, spd: 20, crit: 12 }, skills: ["frost_nova", "spectral_wail"], passive: null,
    resist: { water: 0.6, fire: 1.4 }, xp: 90, gold: 30,
    drops: [{ item: "silver_ore", type: "resource", min: 1, max: 3, chance: 0.7 }] },
  glacier_brute: { id: "glacier_brute", name: "Brute des glaciers", isBoss: false, level: 17, role: "brute",
    icon: "🧊", image: "assets/enemies/glacier_brute.png", sprite: "assets/sprites/glacier_brute.png",
    stats: { hp: 720, atk: 48, def: 34, spd: 12, crit: 8 }, skills: ["heavy_strike", "boss_quake"], passive: null,
    resist: { water: 0.7, lightning: 1.3 }, xp: 105, gold: 34,
    drops: [{ item: "stone", type: "resource", min: 2, max: 4, chance: 0.8 }] },
  gale_harpy: { id: "gale_harpy", name: "Harpie des bourrasques", isBoss: false, level: 18, role: "skirmisher",
    icon: "🦅", image: "assets/enemies/gale_harpy.png", sprite: "assets/sprites/gale_harpy.png",
    stats: { hp: 480, atk: 52, def: 18, spd: 30, crit: 18 }, skills: ["pin_down", "venom_shot"], passive: null,
    resist: { wind: 0.6, nature: 1.2 }, xp: 110, gold: 36,
    drops: [{ item: "raw_hide", type: "resource", min: 1, max: 3, chance: 0.7 }] },
  rime_warden: { id: "rime_warden", name: "Gardien de frimas", isBoss: false, level: 20, role: "tank",
    icon: "🛡️", image: "assets/enemies/rime_warden.png", sprite: "assets/sprites/rime_warden.png",
    stats: { hp: 980, atk: 46, def: 50, spd: 11, crit: 6 }, skills: ["shield_bash", "boss_guard"], passive: "boss_resilience",
    resist: { water: 0.5, fire: 1.3 }, xp: 135, gold: 44,
    drops: [{ item: "silver_ingot", type: "resource", min: 1, max: 2, chance: 0.5 }] },
  frost_shaman: { id: "frost_shaman", name: "Chaman du gel", isBoss: false, level: 21, role: "caster",
    icon: "❄️", image: "assets/enemies/frost_shaman.png", sprite: "assets/sprites/frost_shaman.png",
    stats: { hp: 640, atk: 58, def: 26, spd: 22, crit: 14 }, skills: ["frost_nova", "arcane_bolt"], passive: "regeneration",
    resist: { water: 0.6, fire: 1.4 }, xp: 150, gold: 48,
    drops: [{ item: "rough_gem", type: "resource", min: 1, max: 2, chance: 0.5 }] },
  borealis_tyrant: { id: "borealis_tyrant", name: "Tyran Boréal", isBoss: true, level: 22, role: "boss",
    icon: "🌬️", image: "assets/enemies/borealis_tyrant.png", sprite: "assets/sprites/borealis_tyrant.png",
    stats: { hp: 2400, atk: 64, def: 40, spd: 18, crit: 12, res: 120, acc: 30 },
    skills: ["frost_nova", "boss_quake", "ember_shield", "thunder_call"], passive: "enrage", secondPassive: "boss_resilience",
    resist: { water: 0.5, fire: 1.3, lightning: 1.1 }, aura: { pctMaxHp: 0.018, element: "water", name: "Morsure du blizzard" }, hitCap: 0.2,
    phases: [
      { atHpPct: 0.6, name: "Tempête de neige", announce: "Le Tyran déchaîne le blizzard !", set: { atkPct: 0.2, element: "water" }, heal: 0.08 },
      { atHpPct: 0.3, name: "Zéro absolu", announce: "L'air se fige : le Tyran libère le froid absolu.", set: { atkPct: 0.35, element: "water", defShredPct: 0.2 } },
    ],
    xp: 1100, gold: 360,
    drops: [
      { item: "silver_ingot", type: "resource", min: 2, max: 4, chance: 1 },
      { item: "rough_gem", type: "resource", min: 2, max: 4, chance: 1 },
      { item: "epic", type: "egg", min: 1, max: 1, chance: 0.5 },
    ] },

  // --- Zone 5 : Abysse Verdoyant (niv. 22-30, Nature/Umbral) -----------------
  spore_horror: { id: "spore_horror", name: "Horreur sporeuse", isBoss: false, level: 23, role: "caster",
    icon: "🍄", image: "assets/enemies/spore_horror.png", sprite: "assets/sprites/spore_horror.png",
    stats: { hp: 760, atk: 62, def: 28, spd: 18, crit: 10 }, skills: ["venom_shot", "dust_bolt"], passive: null,
    resist: { nature: 0.6, fire: 1.4 }, xp: 165, gold: 52,
    drops: [{ item: "ancient_wood", type: "resource", min: 1, max: 3, chance: 0.6 }] },
  thornback_maw: { id: "thornback_maw", name: "Gueule épineuse", isBoss: false, level: 24, role: "brute",
    icon: "🌿", image: "assets/enemies/thornback_maw.png", sprite: "assets/sprites/thornback_maw.png",
    stats: { hp: 980, atk: 70, def: 36, spd: 14, crit: 12 }, skills: ["boar_charge", "rending_claws"], passive: null,
    resist: { nature: 0.7, umbral: 1.2 }, xp: 180, gold: 56,
    drops: [{ item: "ancient_wood", type: "resource", min: 2, max: 4, chance: 0.7 }] },
  gloom_stalker: { id: "gloom_stalker", name: "Traqueur des ténèbres", isBoss: false, level: 25, role: "skirmisher",
    icon: "🦂", image: "assets/enemies/gloom_stalker.png", sprite: "assets/sprites/gloom_stalker.png",
    stats: { hp: 700, atk: 82, def: 24, spd: 30, crit: 22 }, skills: ["cursed_smash", "pin_down"], passive: null,
    resist: { umbral: 0.6, light: 1.5 }, xp: 195, gold: 60,
    drops: [{ item: "equip_essence", type: "resource", min: 1, max: 2, chance: 0.4 }] },
  bog_leviathan: { id: "bog_leviathan", name: "Léviathan des marais", isBoss: false, level: 27, role: "tank",
    icon: "🐊", image: "assets/enemies/bog_leviathan.png", sprite: "assets/sprites/bog_leviathan.png",
    stats: { hp: 1500, atk: 66, def: 56, spd: 10, crit: 6 }, skills: ["boss_quake", "boss_guard"], passive: "boss_resilience",
    resist: { water: 0.5, nature: 0.7, fire: 1.3 }, xp: 230, gold: 72,
    drops: [{ item: "silver_ingot", type: "resource", min: 1, max: 3, chance: 0.5 }] },
  blight_priest: { id: "blight_priest", name: "Prêtre de la flétrissure", isBoss: false, level: 29, role: "caster",
    icon: "☠️", image: "assets/enemies/blight_priest.png", sprite: "assets/sprites/blight_priest.png",
    stats: { hp: 900, atk: 88, def: 30, spd: 22, crit: 14 }, skills: ["venom_shot", "spectral_wail"], passive: "soul_siphon",
    resist: { nature: 0.6, umbral: 0.7, light: 1.4 }, xp: 255, gold: 80,
    drops: [{ item: "rough_gem", type: "resource", min: 1, max: 3, chance: 0.5 }] },
  rootmother_silgaia: { id: "rootmother_silgaia", name: "Silgaïa, Mère-Racine", isBoss: true, level: 30, role: "boss",
    icon: "🌳", image: "assets/enemies/rootmother_silgaia.png", sprite: "assets/sprites/rootmother_silgaia.png",
    stats: { hp: 4200, atk: 92, def: 48, spd: 16, crit: 12, res: 150, acc: 34 },
    skills: ["venom_shot", "boss_quake", "ember_shield", "spectral_wail"], passive: "regeneration", secondPassive: "boss_resilience",
    resist: { nature: 0.4, umbral: 0.7, fire: 1.5 }, aura: { pctMaxHp: 0.02, element: "nature", name: "Spores corrosives" }, hitCap: 0.18,
    phases: [
      { atHpPct: 0.6, name: "Floraison vénéneuse", announce: "Silgaïa déploie ses ronces empoisonnées.", set: { atkPct: 0.2, element: "nature" }, heal: 0.12 },
      { atHpPct: 0.3, name: "Réveil de la forêt", announce: "La forêt entière se dresse pour Silgaïa.", set: { atkPct: 0.35, defShredPct: 0.25 } },
    ],
    xp: 2200, gold: 620,
    drops: [
      { item: "ancient_wood", type: "resource", min: 3, max: 6, chance: 1 },
      { item: "rough_gem", type: "resource", min: 2, max: 4, chance: 1 },
      { item: "epic", type: "egg", min: 1, max: 1, chance: 0.6 },
    ] },

  // --- Zone 6 : Hauteurs de Foudrépointe (niv. 30-45, Foudre/Vent) -----------
  storm_revenant: { id: "storm_revenant", name: "Revenant d'orage", isBoss: false, level: 31, role: "caster",
    icon: "⚡", image: "assets/enemies/storm_revenant.png", sprite: "assets/sprites/storm_revenant.png",
    stats: { hp: 1100, atk: 104, def: 34, spd: 26, crit: 16 }, skills: ["thunder_call", "arcane_bolt"], passive: null,
    resist: { lightning: 0.5, nature: 1.3 }, xp: 280, gold: 88,
    drops: [{ item: "silver_ore", type: "resource", min: 2, max: 4, chance: 0.7 }] },
  voltaic_golem: { id: "voltaic_golem", name: "Golem voltaïque", isBoss: false, level: 33, role: "tank",
    icon: "🤖", image: "assets/enemies/voltaic_golem.png", sprite: "assets/sprites/voltaic_golem.png",
    stats: { hp: 2100, atk: 96, def: 64, spd: 12, crit: 6 }, skills: ["boss_quake", "boss_guard"], passive: "boss_resilience",
    resist: { lightning: 0.4, water: 1.4 }, xp: 320, gold: 100,
    drops: [{ item: "iron_ingot", type: "resource", min: 2, max: 4, chance: 0.6 }] },
  thunderbird: { id: "thunderbird", name: "Oiseau-tonnerre", isBoss: false, level: 35, role: "skirmisher",
    icon: "🦅", image: "assets/enemies/thunderbird.png", sprite: "assets/sprites/thunderbird.png",
    stats: { hp: 1300, atk: 124, def: 38, spd: 36, crit: 24 }, skills: ["thunder_call", "pin_down"], passive: null,
    resist: { lightning: 0.5, wind: 0.6, nature: 1.3 }, xp: 360, gold: 116,
    drops: [{ item: "raw_hide", type: "resource", min: 2, max: 4, chance: 0.6 }] },
  arc_warlock: { id: "arc_warlock", name: "Sorcier des arcs", isBoss: false, level: 38, role: "caster",
    icon: "🔮", image: "assets/enemies/arc_warlock.png", sprite: "assets/sprites/arc_warlock.png",
    stats: { hp: 1500, atk: 142, def: 40, spd: 24, crit: 16 }, skills: ["thunder_call", "frost_nova", "arcane_bolt"], passive: "soul_siphon",
    resist: { lightning: 0.5, chaos: 0.8, nature: 1.3 }, xp: 420, gold: 132,
    drops: [{ item: "rough_gem", type: "resource", min: 2, max: 4, chance: 0.5 }] },
  tempest_knight: { id: "tempest_knight", name: "Chevalier des tempêtes", isBoss: false, level: 42, role: "bruiser",
    icon: "⚔️", image: "assets/enemies/tempest_knight.png", sprite: "assets/sprites/tempest_knight.png",
    stats: { hp: 2400, atk: 168, def: 58, spd: 22, crit: 18 }, skills: ["heavy_strike", "thunder_call", "boss_guard"], passive: "enrage",
    resist: { lightning: 0.5, fire: 0.9, water: 1.3 }, xp: 520, gold: 160,
    drops: [{ item: "silver_ingot", type: "resource", min: 2, max: 4, chance: 0.6 }] },
  voltaic_archon: { id: "voltaic_archon", name: "Archonte Voltaïque", isBoss: true, level: 45, role: "boss",
    icon: "🌩️", image: "assets/enemies/voltaic_archon.png", sprite: "assets/sprites/voltaic_archon.png",
    stats: { hp: 9000, atk: 196, def: 64, spd: 24, crit: 16, res: 200, acc: 42 },
    skills: ["thunder_call", "boss_quake", "ember_shield", "meteor"], passive: "enrage", secondPassive: "boss_resilience",
    resist: { lightning: 0.4, wind: 0.6, water: 1.3 }, aura: { pctMaxHp: 0.022, element: "lightning", name: "Champ statique" }, hitCap: 0.16,
    phases: [
      { atHpPct: 0.66, name: "Surtension", announce: "L'Archonte canalise la foudre céleste !", set: { atkPct: 0.25, element: "lightning" } },
      { atHpPct: 0.33, name: "Orage cataclysmique", announce: "Le ciel se déchire au-dessus de l'Archonte.", set: { atkPct: 0.4, defShredPct: 0.25, clearShields: true }, grant: "meteor" },
    ],
    xp: 5200, gold: 1500,
    drops: [
      { item: "silver_ingot", type: "resource", min: 3, max: 6, chance: 1 },
      { item: "rough_gem", type: "resource", min: 3, max: 5, chance: 1 },
      { item: "epic", type: "egg", min: 1, max: 1, chance: 0.7 },
    ] },

  // --- Zone 7 : Nécropole d'Obsidienne (niv. 45-65, Umbral/Lumière) ----------
  bone_legionnaire: { id: "bone_legionnaire", name: "Légionnaire d'os", isBoss: false, level: 46, role: "bruiser",
    icon: "💀", image: "assets/enemies/bone_legionnaire.png", sprite: "assets/sprites/bone_legionnaire.png",
    stats: { hp: 2600, atk: 200, def: 70, spd: 18, crit: 12 }, skills: ["heavy_strike", "cursed_smash"], passive: null,
    resist: { umbral: 0.5, light: 1.5 }, xp: 560, gold: 180,
    drops: [{ item: "iron_ingot", type: "resource", min: 2, max: 4, chance: 0.6 }] },
  wraith_inquisitor: { id: "wraith_inquisitor", name: "Inquisiteur spectral", isBoss: false, level: 49, role: "caster",
    icon: "🕯️", image: "assets/enemies/wraith_inquisitor.png", sprite: "assets/sprites/wraith_inquisitor.png",
    stats: { hp: 2200, atk: 244, def: 56, spd: 26, crit: 18 }, skills: ["spectral_wail", "cursed_smash", "arcane_bolt"], passive: "soul_siphon",
    resist: { umbral: 0.5, chaos: 0.8, light: 1.4 }, xp: 640, gold: 210,
    drops: [{ item: "rough_gem", type: "resource", min: 2, max: 4, chance: 0.5 }] },
  obsidian_colossus: { id: "obsidian_colossus", name: "Colosse d'obsidienne", isBoss: false, level: 52, role: "tank",
    icon: "🗿", image: "assets/enemies/obsidian_colossus.png", sprite: "assets/sprites/obsidian_colossus.png",
    stats: { hp: 5200, atk: 220, def: 96, spd: 10, crit: 6 }, skills: ["boss_quake", "boss_guard"], passive: "boss_resilience",
    resist: { umbral: 0.6, fire: 0.7, light: 1.3 }, xp: 760, gold: 250,
    drops: [{ item: "silver_ingot", type: "resource", min: 2, max: 5, chance: 0.6 }] },
  soul_harvester: { id: "soul_harvester", name: "Moissonneur d'âmes", isBoss: false, level: 56, role: "bruiser",
    icon: "⚰️", image: "assets/enemies/soul_harvester.png", sprite: "assets/sprites/soul_harvester.png",
    stats: { hp: 3600, atk: 288, def: 74, spd: 22, crit: 20 }, skills: ["cursed_smash", "spectral_wail", "heavy_strike"], passive: "soul_siphon",
    resist: { umbral: 0.5, light: 1.5 }, xp: 900, gold: 300,
    drops: [{ item: "equip_essence", type: "resource", min: 1, max: 3, chance: 0.5 }] },
  doom_herald: { id: "doom_herald", name: "Héraut du trépas", isBoss: false, level: 60, role: "caster",
    icon: "📯", image: "assets/enemies/doom_herald.png", sprite: "assets/sprites/doom_herald.png",
    stats: { hp: 4000, atk: 336, def: 70, spd: 26, crit: 18 }, skills: ["spectral_wail", "meteor", "frost_nova"], passive: "enrage",
    resist: { umbral: 0.5, chaos: 0.7, light: 1.4 }, xp: 1050, gold: 360,
    drops: [{ item: "rough_gem", type: "resource", min: 2, max: 5, chance: 0.5 }] },
  lich_king_morthane: { id: "lich_king_morthane", name: "Morthane, Roi-Liche", isBoss: true, level: 65, role: "boss",
    icon: "👑", image: "assets/enemies/lich_king_morthane.png", sprite: "assets/sprites/lich_king_morthane.png",
    stats: { hp: 18000, atk: 380, def: 92, spd: 24, crit: 18, res: 280, acc: 50 },
    skills: ["spectral_wail", "meteor", "ember_shield", "cursed_smash", "frost_nova"], passive: "enrage", secondPassive: "soul_siphon",
    resist: { umbral: 0.35, chaos: 0.7, light: 1.4, fire: 0.9 }, aura: { pctMaxHp: 0.025, element: "umbral", name: "Marée d'âmes" }, hitCap: 0.14,
    phases: [
      { atHpPct: 0.7, name: "Légion des damnés", announce: "Morthane lève son armée de morts.", set: { atkPct: 0.2, element: "umbral" }, heal: 0.1 },
      { atHpPct: 0.4, name: "Couronne de néant", announce: "La couronne de Morthane dévore la lumière.", set: { atkPct: 0.35, defShredPct: 0.3, clearShields: true }, grant: "meteor" },
      { atHpPct: 0.15, name: "Apocalypse", announce: "Morthane embrasse l'anéantissement total.", set: { atkPct: 0.6, element: "chaos" } },
    ],
    xp: 14000, gold: 4200,
    drops: [
      { item: "silver_ingot", type: "resource", min: 4, max: 8, chance: 1 },
      { item: "rough_gem", type: "resource", min: 4, max: 7, chance: 1 },
      { item: "equip_essence", type: "resource", min: 2, max: 4, chance: 1 },
      { item: "epic", type: "egg", min: 1, max: 1, chance: 0.85 },
    ] },

  // --- Zone 8 : Faille Céleste (niv. 65-100, Lumière/Chaos) ------------------
  astral_sentinel: { id: "astral_sentinel", name: "Sentinelle astrale", isBoss: false, level: 68, role: "tank",
    icon: "✨", image: "assets/enemies/astral_sentinel.png", sprite: "assets/sprites/astral_sentinel.png",
    stats: { hp: 8000, atk: 420, def: 120, spd: 16, crit: 10 }, skills: ["boss_quake", "boss_guard"], passive: "boss_resilience",
    resist: { light: 0.5, chaos: 0.8, umbral: 1.3 }, xp: 1400, gold: 460,
    drops: [{ item: "silver_ingot", type: "resource", min: 3, max: 6, chance: 0.6 }] },
  chaos_spawn: { id: "chaos_spawn", name: "Engeance du chaos", isBoss: false, level: 72, role: "skirmisher",
    icon: "🌌", image: "assets/enemies/chaos_spawn.png", sprite: "assets/sprites/chaos_spawn.png",
    stats: { hp: 6000, atk: 520, def: 90, spd: 38, crit: 28 }, skills: ["cursed_smash", "meteor", "pin_down"], passive: "enrage",
    resist: { chaos: 0.4, light: 1.3 }, xp: 1700, gold: 560,
    drops: [{ item: "rough_gem", type: "resource", min: 3, max: 6, chance: 0.5 }] },
  seraphic_judicator: { id: "seraphic_judicator", name: "Juge séraphique", isBoss: false, level: 78, role: "caster",
    icon: "⚖️", image: "assets/enemies/seraphic_judicator.png", sprite: "assets/sprites/seraphic_judicator.png",
    stats: { hp: 7600, atk: 600, def: 100, spd: 28, crit: 18 }, skills: ["meteor", "spectral_wail", "ember_shield"], passive: "regeneration",
    resist: { light: 0.4, chaos: 0.8, umbral: 1.4 }, xp: 2100, gold: 700,
    drops: [{ item: "equip_essence", type: "resource", min: 2, max: 4, chance: 0.5 }] },
  voidmaw_horror: { id: "voidmaw_horror", name: "Horreur gouffre-béant", isBoss: false, level: 85, role: "bruiser",
    icon: "🕳️", image: "assets/enemies/voidmaw_horror.png", sprite: "assets/sprites/voidmaw_horror.png",
    stats: { hp: 11000, atk: 760, def: 110, spd: 24, crit: 22 }, skills: ["cursed_smash", "meteor", "boss_quake"], passive: "soul_siphon",
    resist: { chaos: 0.4, umbral: 0.6, light: 1.3 }, xp: 2800, gold: 920,
    drops: [{ item: "rough_gem", type: "resource", min: 3, max: 7, chance: 0.5 }] },
  fallen_archseraph: { id: "fallen_archseraph", name: "Archséraphin déchu", isBoss: false, level: 92, role: "bruiser",
    icon: "😇", image: "assets/enemies/fallen_archseraph.png", sprite: "assets/sprites/fallen_archseraph.png",
    stats: { hp: 14000, atk: 900, def: 130, spd: 30, crit: 24 }, skills: ["meteor", "thunder_call", "ember_shield", "spectral_wail"], passive: "enrage",
    resist: { light: 0.4, chaos: 0.7, umbral: 1.3 }, xp: 3600, gold: 1200,
    drops: [{ item: "equip_essence", type: "resource", min: 2, max: 5, chance: 0.5 }] },
  astral_seraphon: { id: "astral_seraphon", name: "Séraphon Astral", isBoss: true, level: 100, role: "boss",
    icon: "🌟", image: "assets/enemies/astral_seraphon.png", sprite: "assets/sprites/astral_seraphon.png",
    stats: { hp: 42000, atk: 1100, def: 150, spd: 30, crit: 22, res: 380, acc: 60 },
    skills: ["meteor", "thunder_call", "spectral_wail", "ember_shield", "frost_nova"], passive: "enrage", secondPassive: "boss_resilience",
    resist: { light: 0.3, chaos: 0.5, umbral: 1.3, fire: 0.8 }, aura: { pctMaxHp: 0.028, element: "light", name: "Jugement radiant" }, hitCap: 0.12,
    phases: [
      { atHpPct: 0.75, name: "Ailes de lumière", announce: "Le Séraphon déploie ses ailes incandescentes.", set: { atkPct: 0.2, element: "light" }, heal: 0.1 },
      { atHpPct: 0.5, name: "Cataclysme stellaire", announce: "Les étoiles tombent au commandement du Séraphon.", set: { atkPct: 0.35, defShredPct: 0.3, clearShields: true }, grant: "meteor" },
      { atHpPct: 0.2, name: "Singularité divine", announce: "Le Séraphon devient une singularité de pur chaos.", set: { atkPct: 0.6, element: "chaos" } },
    ],
    xp: 40000, gold: 12000,
    drops: [
      { item: "silver_ingot", type: "resource", min: 6, max: 12, chance: 1 },
      { item: "rough_gem", type: "resource", min: 6, max: 10, chance: 1 },
      { item: "equip_essence", type: "resource", min: 3, max: 6, chance: 1 },
      { item: "epic", type: "egg", min: 1, max: 2, chance: 1 },
    ] },

  // ===========================================================================
  // WORLD BOSSES (Lot 17) — endgame ULTRA-difficiles, conçus QUASI-IMBATTABLES.
  // PV colossaux, Résistance énorme, aura sévère, plafond d'encaissement très bas
  // (le combat dure forcément longtemps) + offense brutale et multi-phases. Le but
  // est d'offrir un mur de prestige : on peut s'y frotter, presque jamais l'abattre.
  // ===========================================================================
  worldboss_kraltheth: { id: "worldboss_kraltheth", name: "Kraltheth, Dévoreur de Mondes", isBoss: true, isWorldBoss: true, level: 100, role: "boss",
    icon: "🪐", image: "assets/enemies/worldboss_kraltheth.png", sprite: "assets/sprites/worldboss_kraltheth.png",
    stats: { hp: 250000, atk: 1800, def: 220, spd: 34, crit: 28, res: 600, acc: 90 },
    skills: ["meteor", "boss_quake", "thunder_call", "ember_shield", "cursed_smash", "spectral_wail"], passive: "enrage", secondPassive: "boss_resilience",
    resist: { fire: 0.4, water: 0.4, lightning: 0.4, nature: 0.4, umbral: 0.4, light: 0.4, chaos: 0.5, wind: 0.4 },
    aura: { pctMaxHp: 0.05, element: "chaos", name: "Faim cosmique" }, hitCap: 0.06,
    phases: [
      { atHpPct: 0.8, name: "Éveil", announce: "Kraltheth ouvre un œil sur le monde.", set: { atkPct: 0.3 }, heal: 0.05 },
      { atHpPct: 0.55, name: "Dévoration", announce: "Kraltheth commence à dévorer la réalité.", set: { atkPct: 0.5, defShredPct: 0.3, clearShields: true } },
      { atHpPct: 0.3, name: "Néant", announce: "Le néant engloutit toute chose autour de Kraltheth.", set: { atkPct: 0.8, element: "chaos" }, heal: 0.05 },
      { atHpPct: 0.1, name: "Fin des mondes", announce: "Kraltheth efface l'existence elle-même.", set: { atkPct: 1.2, element: "chaos", defShredPct: 0.5 } },
    ],
    xp: 200000, gold: 60000,
    drops: [
      { item: "equip_essence", type: "resource", min: 10, max: 20, chance: 1 },
      { item: "rough_gem", type: "resource", min: 10, max: 20, chance: 1 },
      { item: "epic", type: "egg", min: 2, max: 3, chance: 1 },
    ] },
  worldboss_nyxara: { id: "worldboss_nyxara", name: "Nyxara, l'Éclipse Éternelle", isBoss: true, isWorldBoss: true, level: 100, role: "boss",
    icon: "🌑", image: "assets/enemies/worldboss_nyxara.png", sprite: "assets/sprites/worldboss_nyxara.png",
    stats: { hp: 320000, atk: 2100, def: 200, spd: 40, crit: 32, res: 700, acc: 100 },
    skills: ["spectral_wail", "meteor", "frost_nova", "ember_shield", "cursed_smash", "thunder_call"], passive: "enrage", secondPassive: "soul_siphon",
    resist: { umbral: 0.3, light: 0.3, chaos: 0.4, fire: 0.5, water: 0.5, lightning: 0.5, nature: 0.5, wind: 0.5 },
    aura: { pctMaxHp: 0.06, element: "umbral", name: "Ombre dévorante" }, hitCap: 0.05,
    phases: [
      { atHpPct: 0.8, name: "Pénombre", announce: "Nyxara plonge le monde dans la pénombre.", set: { atkPct: 0.35, element: "umbral" }, heal: 0.06 },
      { atHpPct: 0.5, name: "Éclipse totale", announce: "L'éclipse engloutit toute lumière.", set: { atkPct: 0.6, defShredPct: 0.35, clearShields: true } },
      { atHpPct: 0.2, name: "Nuit absolue", announce: "Il n'y a plus que Nyxara et la nuit éternelle.", set: { atkPct: 1.0, element: "umbral", defShredPct: 0.5 }, heal: 0.06 },
    ],
    xp: 260000, gold: 80000,
    drops: [
      { item: "equip_essence", type: "resource", min: 12, max: 24, chance: 1 },
      { item: "rough_gem", type: "resource", min: 12, max: 24, chance: 1 },
      { item: "epic", type: "egg", min: 2, max: 3, chance: 1 },
    ] },
  worldboss_primordius: { id: "worldboss_primordius", name: "Primordius, le Défaiseur", isBoss: true, isWorldBoss: true, level: 100, role: "boss",
    icon: "♾️", image: "assets/enemies/worldboss_primordius.png", sprite: "assets/sprites/worldboss_primordius.png",
    stats: { hp: 500000, atk: 2600, def: 260, spd: 44, crit: 35, res: 850, acc: 120 },
    skills: ["meteor", "boss_quake", "spectral_wail", "thunder_call", "frost_nova", "ember_shield", "cursed_smash"], passive: "enrage", secondPassive: "boss_resilience",
    resist: { fire: 0.3, water: 0.3, lightning: 0.3, nature: 0.3, umbral: 0.3, light: 0.3, chaos: 0.3, wind: 0.3 },
    aura: { pctMaxHp: 0.08, element: "chaos", name: "Défaisure de toute chose" }, hitCap: 0.04,
    phases: [
      { atHpPct: 0.85, name: "Genèse inversée", announce: "Primordius commence à défaire la création.", set: { atkPct: 0.4 }, heal: 0.05 },
      { atHpPct: 0.6, name: "Effacement", announce: "Primordius efface les lois du monde.", set: { atkPct: 0.7, defShredPct: 0.4, clearShields: true } },
      { atHpPct: 0.35, name: "Entropie pure", announce: "Toute structure s'effondre devant Primordius.", set: { atkPct: 1.1, element: "chaos" }, heal: 0.05 },
      { atHpPct: 0.12, name: "Le Rien", announce: "Primordius devient le Rien dont tout est issu.", set: { atkPct: 1.6, element: "chaos", defShredPct: 0.6 } },
    ],
    xp: 400000, gold: 150000,
    drops: [
      { item: "equip_essence", type: "resource", min: 20, max: 40, chance: 1 },
      { item: "rough_gem", type: "resource", min: 20, max: 40, chance: 1 },
      { item: "epic", type: "egg", min: 3, max: 5, chance: 1 },
    ] },
};

export function getEnemy(id) {
  return ENEMIES[id] || null;
}
