// Définition des classes de combat.
// Data-driven : pour ajouter une classe, on ajoute une entrée ici.
// `locked: true` => visible dans l'écran de création mais pas encore jouable.

export const CLASSES = {
  warrior: {
    id: "warrior",
    name: "Guerrier",
    locked: false,
    image: "assets/classes/warrior.png",
    tagline: "Dégâts physiques et survie.",
    desc:
      "Un combattant robuste qui encaisse autant qu'il frappe. " +
      "Polyvalent, il peut s'orienter vers le tissu pour cogner fort, " +
      "ou le métal pour devenir un mur.",
    // Statistiques de base au niveau 1.
    baseStats: { hp: 120, atk: 14, def: 8, spd: 10, crit: 5 },
    // Gain de stats par niveau de personnage.
    growth: { hp: 18, atk: 3, def: 2, spd: 1, crit: 0.3 },
    // 2 compétences actives + 1 passive (l'attaque de base est commune à tous).
    skills: ["heavy_strike", "war_cry"],
    passive: "endurance",
  },

  // --- Classes à venir (verrouillées dans le mini-prototype) ---
  guardian: {
    id: "guardian",
    name: "Gardien",
    locked: true,
    image: "assets/classes/guardian.png",
    tagline: "Défense, provocation, boucliers.",
    desc: "Le rempart du groupe. Bientôt jouable.",
    baseStats: { hp: 160, atk: 9, def: 14, spd: 7, crit: 3 },
    growth: { hp: 26, atk: 2, def: 3, spd: 0.5, crit: 0.1 },
    skills: [],
    passive: null,
  },
  archer: {
    id: "archer",
    name: "Archer",
    locked: true,
    image: "assets/classes/archer.png",
    tagline: "Vitesse, critique, attaques multiples.",
    desc: "Frappe vite et souvent. Bientôt jouable.",
    baseStats: { hp: 95, atk: 16, def: 5, spd: 16, crit: 12 },
    growth: { hp: 13, atk: 3, def: 1, spd: 2, crit: 0.6 },
    skills: [],
    passive: null,
  },
  mage: {
    id: "mage",
    name: "Mage",
    locked: true,
    image: "assets/classes/mage.png",
    tagline: "Gros dégâts élémentaires, fragile.",
    desc: "Une puissance dévastatrice mais une coquille de verre. Bientôt jouable.",
    baseStats: { hp: 80, atk: 20, def: 3, spd: 11, crit: 8 },
    growth: { hp: 11, atk: 4, def: 0.5, spd: 1, crit: 0.4 },
    skills: [],
    passive: null,
  },
  assassin: {
    id: "assassin",
    name: "Assassin",
    locked: true,
    image: "assets/classes/assassin.png",
    tagline: "Esquive, poison, exécution.",
    desc: "Frappe dans l'ombre et achève les affaiblis. Bientôt jouable.",
    baseStats: { hp: 90, atk: 17, def: 4, spd: 18, crit: 14 },
    growth: { hp: 12, atk: 3, def: 1, spd: 2, crit: 0.7 },
    skills: [],
    passive: null,
  },
};

export function getClass(id) {
  return CLASSES[id] || null;
}

export function playableClasses() {
  return Object.values(CLASSES).filter((c) => !c.locked);
}
