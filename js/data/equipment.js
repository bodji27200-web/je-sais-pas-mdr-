// Équipements. Slots : weapon, head, chest, legs, accessory.
// family : cloth | leather | metal | null (armes/accessoires).
// stats : bonus additifs appliqués aux stats du personnage.
//
// Identité des familles d'armure (pour de vrais choix de build) :
//  - tissu  : offensif (atk/crit), très peu de défense.
//  - cuir   : équilibré (vitesse/crit + défense correcte).
//  - métal  : tanky (PV/défense élevés), pénalise la vitesse.

export const ARMOR_FAMILIES = {
  cloth: { id: "cloth", name: "Tissu", color: "#7c5cff" },
  leather: { id: "leather", name: "Cuir", color: "#c08a3e" },
  metal: { id: "metal", name: "Métal", color: "#9aa6b2" },
};

export const SLOTS = {
  weapon: "Arme",
  head: "Tête",
  chest: "Torse",
  legs: "Jambes",
  accessory: "Accessoire",
};

export const EQUIPMENT = {
  // --- Armes ---
  copper_sword: {
    id: "copper_sword",
    name: "Épée de cuivre",
    slot: "weapon",
    family: null,
    levelReq: 1,
    icon: "🗡️",
    image: "assets/equipment/copper_sword.png",
    stats: { atk: 6 },
    desc: "Une lame d'initiation, mais qui tranche déjà mieux que les poings.",
  },
  iron_sword: {
    id: "iron_sword",
    name: "Épée de fer",
    slot: "weapon",
    family: null,
    levelReq: 4,
    icon: "⚔️",
    image: "assets/equipment/iron_sword.png",
    stats: { atk: 12 },
    desc: "Une arme fiable et bien équilibrée.",
  },
  iron_greatsword: {
    id: "iron_greatsword",
    name: "Grande épée de fer",
    slot: "weapon",
    family: null,
    levelReq: 6,
    icon: "⚔️",
    image: "assets/equipment/iron_greatsword.png",
    stats: { atk: 20, spd: -3 },
    desc: "Lourde et dévastatrice, au prix de la vitesse.",
  },

  // --- Tissu (offensif) ---
  cloth_hood: {
    id: "cloth_hood",
    name: "Capuche de tissu",
    slot: "head",
    family: "cloth",
    levelReq: 1,
    icon: "🎩",
    image: "assets/equipment/cloth_hood.png",
    stats: { atk: 3, crit: 2, hp: 5 },
    desc: "Légère et propice à l'agressivité.",
  },
  cloth_robe: {
    id: "cloth_robe",
    name: "Robe de tissu",
    slot: "chest",
    family: "cloth",
    levelReq: 2,
    icon: "🥼",
    image: "assets/equipment/cloth_robe.png",
    stats: { atk: 7, crit: 3, hp: 10, def: 1 },
    desc: "Maximise les dégâts, n'offre presque aucune protection.",
  },

  // --- Cuir (équilibré) ---
  leather_cap: {
    id: "leather_cap",
    name: "Casque de cuir",
    slot: "head",
    family: "leather",
    levelReq: 1,
    icon: "🪖",
    image: "assets/equipment/leather_cap.png",
    stats: { def: 3, spd: 1, hp: 8 },
    desc: "Un bon compromis entre mobilité et protection.",
  },
  leather_armor: {
    id: "leather_armor",
    name: "Armure de cuir",
    slot: "chest",
    family: "leather",
    levelReq: 2,
    icon: "🦺",
    image: "assets/equipment/leather_armor.png",
    stats: { def: 6, hp: 28, spd: 1, crit: 2 },
    desc: "L'armure polyvalente par excellence.",
  },
  leather_boots: {
    id: "leather_boots",
    name: "Bottes de cuir",
    slot: "legs",
    family: "leather",
    levelReq: 1,
    icon: "🥾",
    image: "assets/equipment/leather_boots.png",
    stats: { def: 2, spd: 3 },
    desc: "Souples et rapides.",
  },

  // --- Métal (tanky) ---
  iron_helm: {
    id: "iron_helm",
    name: "Heaume de fer",
    slot: "head",
    family: "metal",
    levelReq: 3,
    icon: "⛑️",
    image: "assets/equipment/iron_helm.png",
    stats: { def: 6, hp: 22, spd: -1 },
    desc: "Une protection sérieuse pour le crâne.",
  },
  iron_plate: {
    id: "iron_plate",
    name: "Plastron de fer",
    slot: "chest",
    family: "metal",
    levelReq: 4,
    icon: "🛡️",
    image: "assets/equipment/iron_plate.png",
    stats: { def: 13, hp: 60, spd: -2 },
    desc: "Un véritable mur d'acier.",
  },
  iron_greaves: {
    id: "iron_greaves",
    name: "Jambières de fer",
    slot: "legs",
    family: "metal",
    levelReq: 3,
    icon: "🦿",
    image: "assets/equipment/iron_greaves.png",
    stats: { def: 7, hp: 32, spd: -1 },
    desc: "Lourdes mais inébranlables.",
  },

  // --- Accessoire ---
  gem_amulet: {
    id: "gem_amulet",
    name: "Amulette sertie",
    slot: "accessory",
    family: null,
    levelReq: 5,
    icon: "📿",
    image: "assets/equipment/gem_amulet.png",
    stats: { atk: 4, crit: 8 },
    desc: "Une gemme taillée qui aiguise les coups critiques.",
  },
};

export function getEquipment(id) {
  return EQUIPMENT[id] || null;
}
