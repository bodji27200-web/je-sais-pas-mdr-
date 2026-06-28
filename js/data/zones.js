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

  // === Contenu endgame (Lot 17) — 5 nouvelles zones de boss ==================
  frostwind_peaks: {
    id: "frostwind_peaks", name: "Pics du Vent Gelé", icon: "🏔️",
    image: "assets/zones/frostwind_peaks.png", arena: "assets/backgrounds/zone4.png",
    recommendedLevel: 16, elements: ["water", "wind"],
    desc: "Des sommets battus par un blizzard éternel où rôdent revenants et gardiens de glace. Le Tyran Boréal y règne.",
    enemies: ["frost_revenant", "glacier_brute", "gale_harpy", "rime_warden", "frost_shaman"],
    boss: "borealis_tyrant", unlock: { prevBoss: "ignar_emberheart" },
    progression: [
      { enemy: "frost_revenant", level: 16, prevKills: 0, clearKills: 3 },
      { enemy: "glacier_brute", level: 17, prevKills: 3, clearKills: 3 },
      { enemy: "gale_harpy", level: 18, prevKills: 3, clearKills: 3 },
      { enemy: "rime_warden", level: 20, prevKills: 3, clearKills: 3 },
      { enemy: "frost_shaman", level: 21, prevKills: 3, clearKills: 3 },
    ],
    bossUnlock: { level: 22, prevKills: 3 },
  },
  verdant_abyss: {
    id: "verdant_abyss", name: "Abysse Verdoyant", icon: "🌿",
    image: "assets/zones/verdant_abyss.png", arena: "assets/backgrounds/zone5.png",
    recommendedLevel: 23, elements: ["nature", "umbral"],
    desc: "Une jungle souterraine pourrissante où la vie et la mort se confondent. Silgaïa, la Mère-Racine, y a pris racine.",
    enemies: ["spore_horror", "thornback_maw", "gloom_stalker", "bog_leviathan", "blight_priest"],
    boss: "rootmother_silgaia", unlock: { prevBoss: "borealis_tyrant" },
    progression: [
      { enemy: "spore_horror", level: 23, prevKills: 0, clearKills: 3 },
      { enemy: "thornback_maw", level: 24, prevKills: 3, clearKills: 3 },
      { enemy: "gloom_stalker", level: 25, prevKills: 3, clearKills: 3 },
      { enemy: "bog_leviathan", level: 27, prevKills: 3, clearKills: 3 },
      { enemy: "blight_priest", level: 29, prevKills: 3, clearKills: 3 },
    ],
    bossUnlock: { level: 30, prevKills: 3 },
  },
  stormspire_heights: {
    id: "stormspire_heights", name: "Hauteurs de Foudrépointe", icon: "🌩️",
    image: "assets/zones/stormspire_heights.png", arena: "assets/backgrounds/zone6.png",
    recommendedLevel: 31, elements: ["lightning", "wind"],
    desc: "Des aiguilles de roche où la foudre ne s'éteint jamais. L'Archonte Voltaïque canalise l'orage primordial.",
    enemies: ["storm_revenant", "voltaic_golem", "thunderbird", "arc_warlock", "tempest_knight"],
    boss: "voltaic_archon", unlock: { prevBoss: "rootmother_silgaia" },
    progression: [
      { enemy: "storm_revenant", level: 31, prevKills: 0, clearKills: 3 },
      { enemy: "voltaic_golem", level: 33, prevKills: 3, clearKills: 3 },
      { enemy: "thunderbird", level: 35, prevKills: 3, clearKills: 3 },
      { enemy: "arc_warlock", level: 38, prevKills: 3, clearKills: 3 },
      { enemy: "tempest_knight", level: 42, prevKills: 3, clearKills: 3 },
    ],
    bossUnlock: { level: 45, prevKills: 3 },
  },
  obsidian_necropolis: {
    id: "obsidian_necropolis", name: "Nécropole d'Obsidienne", icon: "🏛️",
    image: "assets/zones/obsidian_necropolis.png", arena: "assets/backgrounds/zone7.png",
    recommendedLevel: 46, elements: ["umbral", "light"],
    desc: "Une cité des morts taillée dans le verre volcanique. Morthane, le Roi-Liche, y commande une légion éternelle.",
    enemies: ["bone_legionnaire", "wraith_inquisitor", "obsidian_colossus", "soul_harvester", "doom_herald"],
    boss: "lich_king_morthane", unlock: { prevBoss: "voltaic_archon" },
    progression: [
      { enemy: "bone_legionnaire", level: 46, prevKills: 0, clearKills: 3 },
      { enemy: "wraith_inquisitor", level: 49, prevKills: 3, clearKills: 3 },
      { enemy: "obsidian_colossus", level: 52, prevKills: 3, clearKills: 3 },
      { enemy: "soul_harvester", level: 56, prevKills: 3, clearKills: 3 },
      { enemy: "doom_herald", level: 60, prevKills: 3, clearKills: 3 },
    ],
    bossUnlock: { level: 65, prevKills: 3 },
  },
  celestial_rift: {
    id: "celestial_rift", name: "Faille Céleste", icon: "🌠",
    image: "assets/zones/celestial_rift.png", arena: "assets/backgrounds/zone8.png",
    recommendedLevel: 68, elements: ["light", "chaos"],
    desc: "Une déchirure du ciel où l'ordre et le chaos s'affrontent. Le Séraphon Astral juge tout ce qui ose approcher.",
    enemies: ["astral_sentinel", "chaos_spawn", "seraphic_judicator", "voidmaw_horror", "fallen_archseraph"],
    boss: "astral_seraphon", unlock: { prevBoss: "lich_king_morthane" },
    progression: [
      { enemy: "astral_sentinel", level: 68, prevKills: 0, clearKills: 3 },
      { enemy: "chaos_spawn", level: 72, prevKills: 3, clearKills: 3 },
      { enemy: "seraphic_judicator", level: 78, prevKills: 3, clearKills: 3 },
      { enemy: "voidmaw_horror", level: 85, prevKills: 3, clearKills: 3 },
      { enemy: "fallen_archseraph", level: 92, prevKills: 3, clearKills: 3 },
    ],
    bossUnlock: { level: 100, prevKills: 3 },
  },

  // === World bosses (Lot 17) — murs de prestige quasi-imbattables (exprès) ====
  void_throne: {
    id: "void_throne", name: "Trône du Néant", icon: "♾️",
    image: "assets/zones/void_throne.png", arena: "assets/backgrounds/zonevoid.png",
    recommendedLevel: 100, elements: ["chaos", "umbral"], isWorldZone: true,
    desc: "Au-delà du monde, trois entités primordiales attendent. Nul n'est censé les vaincre — seulement leur survivre, et raconter.",
    enemies: ["worldboss_kraltheth", "worldboss_nyxara"],
    boss: "worldboss_primordius", unlock: { prevBoss: "astral_seraphon" },
    progression: [
      { enemy: "worldboss_kraltheth", level: 100, prevKills: 0, clearKills: 1 },
      { enemy: "worldboss_nyxara", level: 100, prevKills: 0, clearKills: 1 },
    ],
    bossUnlock: { level: 100, prevKills: 0 },
  },
};

export function getZone(id) {
  return ZONES[id] || null;
}

export function allZones() {
  return Object.values(ZONES);
}
