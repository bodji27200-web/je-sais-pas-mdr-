// Équipements. Slots : weapon, head, chest, legs, accessory.
// family : cloth | leather | metal | null (armes/accessoires).
// wtype  : type d'arme (armes uniquement) — voir data/classes.js (compatibilité).
// stats  : bonus additifs appliqués aux stats du personnage.
//
// Identité FORTE des familles (par pièce ; bonus de SEUIL 2/4 pièces + passif
// comportemental, voir data/materials.js et core/character.js) :
//  - Tissu : dégâts + critique élevés, AUCUNE défense, peu de PV.
//  - Cuir  : vitesse + critique + survie correcte (équilibré).
//  - Métal : beaucoup de PV et de défense, malus de vitesse, zéro offensif.

export const ARMOR_FAMILIES = {
  cloth: { id: "cloth", name: "Tissu", color: "#7c5cff" },
  leather: { id: "leather", name: "Cuir", color: "#c08a3e" },
  metal: { id: "metal", name: "Métal", color: "#9aa6b2" },
};

export const SLOTS = {
  weapon: "Arme",
  head: "Tête",
  chest: "Torse",
  hands: "Mains",
  legs: "Jambes",
  feet: "Bottes",
  accessory: "Accessoire",
  accessory2: "Accessoire 2", // 2e emplacement, débloqué en battant un boss (Lot 13)
};

// Emplacements partageant un même type d'objet (un accessoire va dans l'un OU
// l'autre des deux emplacements d'accessoire).
export const SLOT_ALIASES = { accessory: ["accessory", "accessory2"] };

export const EQUIPMENT = {
  // --- Armes ---
  copper_sword: {
    id: "copper_sword", name: "Épée de cuivre", slot: "weapon", family: null, wtype: "sword",
    levelReq: 1, icon: "🗡️", image: "assets/equipment/copper_sword.png",
    stats: { atk: 6 }, desc: "Une lame d'initiation, mais qui tranche déjà mieux que les poings.",
  },
  iron_sword: {
    id: "iron_sword", name: "Épée de fer", slot: "weapon", family: null, wtype: "sword",
    levelReq: 4, icon: "⚔️", image: "assets/equipment/iron_sword.png",
    stats: { atk: 12 }, desc: "Une arme fiable et bien équilibrée.",
  },
  iron_greatsword: {
    id: "iron_greatsword", name: "Grande épée de fer", slot: "weapon", family: null, wtype: "greatsword",
    levelReq: 6, icon: "⚔️", image: "assets/equipment/iron_greatsword.png",
    stats: { atk: 22, spd: -3 }, desc: "Lourde et dévastatrice, au prix de la vitesse.",
  },
  iron_mace: {
    id: "iron_mace", name: "Masse de fer", slot: "weapon", family: null, wtype: "mace",
    levelReq: 4, icon: "🔨", image: "assets/equipment/iron_mace.png",
    stats: { atk: 11, def: 2 }, desc: "Un coup contondant qui ébranle même les armures.",
  },

  // --- Armes du Gardien (lance, bouclier) ---
  oak_spear: {
    id: "oak_spear", name: "Lance de chêne", slot: "weapon", family: null, wtype: "spear",
    levelReq: 2, icon: "🔱", image: "assets/equipment/oak_spear.png",
    stats: { atk: 9, spd: 1 }, desc: "Allonge et précision : on frappe avant d'être touché.",
  },
  iron_spear: {
    id: "iron_spear", name: "Lance de fer", slot: "weapon", family: null, wtype: "spear",
    levelReq: 5, icon: "🔱", image: "assets/equipment/iron_spear.png",
    stats: { atk: 16, spd: 1 }, desc: "Une pointe d'acier au bout d'une longue hampe.",
  },
  iron_buckler: {
    id: "iron_buckler", name: "Bouclier de fer", slot: "weapon", family: null, wtype: "shield",
    levelReq: 3, icon: "🛡️", image: "assets/equipment/iron_buckler.png",
    stats: { atk: 3, def: 8, hp: 20 }, desc: "Plus une protection qu'une arme : pour qui veut tenir la ligne.",
  },

  // --- Armes de l'Archer (arc, arbalète) ---
  short_bow: {
    id: "short_bow", name: "Arc court", slot: "weapon", family: null, wtype: "bow",
    levelReq: 1, icon: "🏹", image: "assets/equipment/short_bow.png",
    stats: { atk: 5, spd: 2, crit: 2 }, desc: "Léger et nerveux, parfait pour harceler à distance.",
  },
  oak_longbow: {
    id: "oak_longbow", name: "Arc long de chêne", slot: "weapon", family: null, wtype: "longbow",
    levelReq: 4, icon: "🏹", image: "assets/equipment/oak_longbow.png",
    stats: { atk: 14, crit: 4, spd: -1 }, desc: "Plus lent à bander, mais chaque flèche fait mal.",
  },
  ancient_longbow: {
    id: "ancient_longbow", name: "Arc long ancestral", slot: "weapon", family: null, wtype: "longbow",
    levelReq: 8, icon: "🏹", image: "assets/equipment/ancient_longbow.png",
    stats: { atk: 21, crit: 6, spd: -1 }, desc: "Taillé dans un bois millénaire : portée et puissance accrues.",
  },
  light_crossbow: {
    id: "light_crossbow", name: "Arbalète légère", slot: "weapon", family: null, wtype: "crossbow",
    levelReq: 5, icon: "🎯", image: "assets/equipment/light_crossbow.png",
    stats: { atk: 16, crit: 3 }, desc: "Un carreau qui transperce les défenses.",
  },

  // --- Armes du Mage (baguette, bâton, orbe) ---
  apprentice_wand: {
    id: "apprentice_wand", name: "Baguette d'apprenti", slot: "weapon", family: null, wtype: "wand",
    levelReq: 1, icon: "🪄", image: "assets/equipment/apprentice_wand.png",
    stats: { atk: 6, crit: 2 }, desc: "Canalise une étincelle d'arcane. Tout commence ici.",
  },
  oak_staff: {
    id: "oak_staff", name: "Bâton de chêne", slot: "weapon", family: null, wtype: "staff",
    levelReq: 4, icon: "🪈", image: "assets/equipment/oak_staff.png",
    stats: { atk: 16, crit: 3 }, desc: "Un foyer arcanique stable, idéal pour les sorts puissants.",
  },
  arcane_orb: {
    id: "arcane_orb", name: "Orbe arcanique", slot: "weapon", family: null, wtype: "orb",
    levelReq: 5, icon: "🔮", image: "assets/equipment/arcane_orb.png",
    stats: { atk: 14, crit: 6 }, desc: "Une sphère qui amplifie le moindre éclat de magie.",
  },
  ancient_staff: {
    id: "ancient_staff", name: "Bâton ancestral", slot: "weapon", family: null, wtype: "staff",
    levelReq: 8, icon: "🪈", image: "assets/equipment/ancient_staff.png",
    stats: { atk: 23, crit: 5 }, desc: "Un foyer arcanique gravé dans un bois ancien : magie décuplée.",
  },

  // --- Armes de l'Assassin (dague, lames jumelles) ---
  rusty_dagger: {
    id: "rusty_dagger", name: "Dague usée", slot: "weapon", family: null, wtype: "dagger",
    levelReq: 1, icon: "🗡️", image: "assets/equipment/rusty_dagger.png",
    stats: { atk: 5, spd: 3, crit: 3 }, desc: "Courte, rapide, faite pour viser les points faibles.",
  },
  short_blade: {
    id: "short_blade", name: "Lame courte", slot: "weapon", family: null, wtype: "short_blade",
    levelReq: 3, icon: "🔪", image: "assets/equipment/short_blade.png",
    stats: { atk: 10, spd: 2, crit: 4 }, desc: "Équilibrée entre allonge et discrétion.",
  },
  twin_daggers: {
    id: "twin_daggers", name: "Dagues jumelles", slot: "weapon", family: null, wtype: "dual_daggers",
    levelReq: 4, icon: "⚔️", image: "assets/equipment/twin_daggers.png",
    stats: { atk: 12, spd: 3, crit: 5 }, desc: "Deux lames qui dansent : vitesse et critiques en pagaille.",
  },

  // --- Tissu (offensif, fragile) ---
  cloth_hood: {
    id: "cloth_hood", name: "Capuche de tissu", slot: "head", family: "cloth",
    levelReq: 1, icon: "🎩", image: "assets/equipment/cloth_hood.png",
    stats: { atk: 4, crit: 3 }, desc: "Légère et propice à l'agressivité. Aucune protection.",
  },
  cloth_robe: {
    id: "cloth_robe", name: "Robe de tissu", slot: "chest", family: "cloth",
    levelReq: 2, icon: "🥼", image: "assets/equipment/cloth_robe.png",
    stats: { atk: 9, crit: 4, hp: 6 }, desc: "Maximise les dégâts, n'offre presque aucune protection.",
  },
  cloth_leggings: {
    id: "cloth_leggings", name: "Braies de tissu", slot: "legs", family: "cloth",
    levelReq: 2, icon: "👖", image: "assets/equipment/cloth_leggings.png",
    stats: { atk: 5, crit: 3 }, desc: "Permet d'achever une tenue de tissu complète, offensive à l'extrême.",
  },
  cloth_gloves: {
    id: "cloth_gloves", name: "Gants de tissu", slot: "hands", family: "cloth",
    levelReq: 1, icon: "🧤", image: "assets/equipment/cloth_gloves.png",
    stats: { atk: 4, crit: 2 }, desc: "Des gants fins qui canalisent l'arcane sans entraver les gestes.",
  },
  cloth_sandals: {
    id: "cloth_sandals", name: "Sandales de tissu", slot: "feet", family: "cloth",
    levelReq: 1, icon: "🥿", image: "assets/equipment/cloth_sandals.png",
    stats: { atk: 3, crit: 3 }, desc: "Légères au point de se faire oublier. Aucune protection.",
  },

  // --- Cuir (équilibré : vitesse / crit / survie correcte) ---
  leather_cap: {
    id: "leather_cap", name: "Casque de cuir", slot: "head", family: "leather",
    levelReq: 1, icon: "🪖", image: "assets/equipment/leather_cap.png",
    stats: { def: 3, spd: 2, crit: 2, hp: 6 }, desc: "Un bon compromis entre mobilité et protection.",
  },
  leather_armor: {
    id: "leather_armor", name: "Armure de cuir", slot: "chest", family: "leather",
    levelReq: 2, icon: "🦺", image: "assets/equipment/leather_armor.png",
    stats: { def: 6, hp: 24, spd: 2, crit: 3 }, desc: "L'armure polyvalente par excellence.",
  },
  leather_leggings: {
    id: "leather_leggings", name: "Jambières de cuir", slot: "legs", family: "leather",
    levelReq: 2, icon: "👖", image: "assets/equipment/leather_leggings.png",
    stats: { def: 4, hp: 16, spd: 2, crit: 1 }, desc: "Souples et résistantes : le bon compromis pour les jambes.",
  },
  leather_gloves: {
    id: "leather_gloves", name: "Gants de cuir", slot: "hands", family: "leather",
    levelReq: 1, icon: "🧤", image: "assets/equipment/leather_gloves.png",
    stats: { def: 2, spd: 2, crit: 2 }, desc: "Une bonne prise et des doigts agiles.",
  },
  leather_boots: {
    id: "leather_boots", name: "Bottes de cuir", slot: "feet", family: "leather",
    levelReq: 1, icon: "🥾", image: "assets/equipment/leather_boots.png",
    stats: { def: 2, spd: 4, crit: 1 }, desc: "Souples et rapides.",
  },

  // --- Métal (tanky : PV / défense, malus de vitesse) ---
  iron_helm: {
    id: "iron_helm", name: "Heaume de fer", slot: "head", family: "metal",
    levelReq: 3, icon: "⛑️", image: "assets/equipment/iron_helm.png",
    stats: { def: 8, hp: 28, spd: -1 }, desc: "Une protection sérieuse pour le crâne.",
  },
  reinforced_helm: {
    id: "reinforced_helm", name: "Heaume renforcé", slot: "head", family: "metal",
    levelReq: 7, icon: "⛑️", image: "assets/equipment/reinforced_helm.png",
    stats: { def: 12, hp: 42, spd: -1 }, desc: "Acier trempé au charbon : une protection de premier ordre.",
  },
  iron_plate: {
    id: "iron_plate", name: "Plastron de fer", slot: "chest", family: "metal",
    levelReq: 4, icon: "🛡️", image: "assets/equipment/iron_plate.png",
    stats: { def: 16, hp: 70, spd: -2 }, desc: "Un véritable mur d'acier.",
  },
  iron_greaves: {
    id: "iron_greaves", name: "Jambières de fer", slot: "legs", family: "metal",
    levelReq: 3, icon: "🦿", image: "assets/equipment/iron_greaves.png",
    stats: { def: 9, hp: 38, spd: -1 }, desc: "Lourdes mais inébranlables.",
  },
  iron_gauntlets: {
    id: "iron_gauntlets", name: "Gantelets de fer", slot: "hands", family: "metal",
    levelReq: 3, icon: "🧤", image: "assets/equipment/iron_gauntlets.png",
    stats: { def: 6, hp: 18, spd: -1 }, desc: "Des poings d'acier qui ne lâchent jamais prise.",
  },
  iron_sabatons: {
    id: "iron_sabatons", name: "Solerets de fer", slot: "feet", family: "metal",
    levelReq: 3, icon: "🥾", image: "assets/equipment/iron_sabatons.png",
    stats: { def: 6, hp: 24, spd: -2 }, desc: "Lourds mais inébranlables : on ne te déplace pas.",
  },

  // --- Accessoire ---
  gem_amulet: {
    id: "gem_amulet", name: "Amulette sertie", slot: "accessory", family: null,
    levelReq: 5, icon: "📿", image: "assets/equipment/gem_amulet.png",
    stats: { atk: 4, crit: 8 }, desc: "Une gemme taillée qui aiguise les coups critiques.",
  },
  silver_amulet: {
    id: "silver_amulet", name: "Amulette d'argent", slot: "accessory", family: null,
    levelReq: 9, icon: "📿", image: "assets/equipment/silver_amulet.png",
    stats: { atk: 6, crit: 10, hp: 14 }, desc: "Un travail d'orfèvre : critiques affûtés et vitalité renforcée.",
  },
  // Accessoires variés (orientations de build différentes ; les affixes ajoutent
  // éléments/résistances/passifs). Universels (toutes classes).
  copper_ring: {
    id: "copper_ring", name: "Anneau de cuivre", slot: "accessory", family: null,
    levelReq: 2, icon: "💍", image: "assets/equipment/copper_ring.png",
    stats: { atk: 3, hp: 8 }, desc: "Un anneau simple : un peu de force, un peu de vigueur.",
  },
  warding_charm: {
    id: "warding_charm", name: "Charme protecteur", slot: "accessory", family: null,
    levelReq: 4, icon: "🧿", image: "assets/equipment/warding_charm.png",
    stats: { def: 5, hp: 18 }, desc: "Un talisman défensif : encaisse mieux les coups.",
  },
  swift_band: {
    id: "swift_band", name: "Bracelet véloce", slot: "accessory", family: null,
    levelReq: 4, icon: "💨", image: "assets/equipment/swift_band.png",
    stats: { spd: 3, crit: 6 }, desc: "Un bracelet léger qui accélère le geste.",
  },
  vital_pendant: {
    id: "vital_pendant", name: "Pendentif vital", slot: "accessory", family: null,
    levelReq: 7, icon: "❤", image: "assets/equipment/vital_pendant.png",
    stats: { hp: 34, def: 3 }, desc: "Un cœur de gemme qui fait battre plus fort la vie.",
  },
  arcane_seal: {
    id: "arcane_seal", name: "Sceau arcanique", slot: "accessory", family: null,
    levelReq: 8, icon: "🔯", image: "assets/equipment/arcane_seal.png",
    stats: { atk: 9, crit: 5 }, desc: "Un sceau gravé qui amplifie la puissance des coups.",
  },
};

export function getEquipment(id) {
  return EQUIPMENT[id] || null;
}
