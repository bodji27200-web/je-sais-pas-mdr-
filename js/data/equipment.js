// Équipements. Slots : weapon, head, chest, legs, accessory.
// family : cloth | leather | metal | null (armes/accessoires).
// wtype  : type d'arme (armes uniquement) — voir data/classes.js (compatibilité).
// stats  : bonus additifs appliqués aux stats du personnage.
//
// Identité FORTE des familles (par pièce ; un set 3 pièces ajoute un bonus,
// voir core/character.js SET_BONUS) :
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
  legs: "Jambes",
  accessory: "Accessoire",
};

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
  leather_boots: {
    id: "leather_boots", name: "Bottes de cuir", slot: "legs", family: "leather",
    levelReq: 1, icon: "🥾", image: "assets/equipment/leather_boots.png",
    stats: { def: 2, spd: 4, crit: 1 }, desc: "Souples et rapides.",
  },

  // --- Métal (tanky : PV / défense, malus de vitesse) ---
  iron_helm: {
    id: "iron_helm", name: "Heaume de fer", slot: "head", family: "metal",
    levelReq: 3, icon: "⛑️", image: "assets/equipment/iron_helm.png",
    stats: { def: 8, hp: 28, spd: -1 }, desc: "Une protection sérieuse pour le crâne.",
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

  // --- Accessoire ---
  gem_amulet: {
    id: "gem_amulet", name: "Amulette sertie", slot: "accessory", family: null,
    levelReq: 5, icon: "📿", image: "assets/equipment/gem_amulet.png",
    stats: { atk: 4, crit: 8 }, desc: "Une gemme taillée qui aiguise les coups critiques.",
  },
};

export function getEquipment(id) {
  return EQUIPMENT[id] || null;
}
