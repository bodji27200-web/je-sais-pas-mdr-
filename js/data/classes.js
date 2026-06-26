// Définition des classes de combat — data-driven.
// Pour ajouter une classe : une entrée ici (+ ses compétences dans skills.js).
//
// weapons : types d'armes compatibles (voir data/equipment.js, champ `wtype`).
//           Les maîtrises (bonus) viennent des spécialisations.

export const CLASSES = {
  warrior: {
    id: "warrior",
    name: "Guerrier",
    locked: false,
    image: "assets/classes/warrior.png",
    sprite: "assets/sprites/warrior.png",
    tagline: "Combattant physique polyvalent.",
    desc:
      "Bons PV, attaque et défense correctes, vitesse moyenne. Polyvalent : " +
      "il encaisse autant qu'il frappe et s'adapte à toutes les armures.",
    baseStats: { hp: 120, atk: 14, def: 8, spd: 10, crit: 5 },
    growth: { hp: 18, atk: 3, def: 2, spd: 1, crit: 0.3 },
    skills: ["heavy_strike", "war_cry"],
    passive: "endurance",
    weapons: ["sword", "greatsword", "mace"],
  },

  guardian: {
    id: "guardian",
    name: "Gardien",
    locked: false,
    image: "assets/classes/guardian.png",
    sprite: "assets/sprites/guardian.png",
    tagline: "Défense, provocation, boucliers.",
    desc:
      "Meilleure défense de base et beaucoup de PV, mais attaque et vitesse " +
      "faibles. Spécialisé dans la réduction des dégâts et la provocation.",
    baseStats: { hp: 165, atk: 12, def: 15, spd: 7, crit: 3 },
    growth: { hp: 27, atk: 2.6, def: 3.2, spd: 0.5, crit: 0.1 },
    skills: ["shield_bash", "taunt_guard"],
    passive: "living_armor",
    weapons: ["sword", "mace", "spear", "shield"],
  },

  archer: {
    id: "archer",
    name: "Archer",
    locked: false,
    image: "assets/classes/archer.png",
    sprite: "assets/sprites/archer.png",
    tagline: "Vitesse, critique, attaques multiples.",
    desc:
      "Vitesse élevée et bonnes chances de critique, dégâts réguliers à " +
      "distance, mais défense faible. Frappe vite et souvent.",
    baseStats: { hp: 98, atk: 15, def: 5, spd: 16, crit: 12 },
    growth: { hp: 13, atk: 3, def: 1, spd: 2, crit: 0.6 },
    skills: ["precise_shot", "double_shot"],
    passive: "hunter_eye",
    weapons: ["bow", "longbow", "crossbow"],
  },

  mage: {
    id: "mage",
    name: "Mage",
    locked: false,
    image: "assets/classes/mage.png",
    sprite: "assets/sprites/mage.png",
    tagline: "Très forte attaque, très fragile.",
    desc:
      "Attaque magique dévastatrice et compétences puissantes, mais peu de PV " +
      "et de défense. Une coquille de verre au potentiel offensif énorme.",
    baseStats: { hp: 82, atk: 21, def: 3, spd: 11, crit: 8 },
    growth: { hp: 11, atk: 4.2, def: 0.6, spd: 1, crit: 0.4 },
    skills: ["arcane_bolt", "arcane_barrier"],
    passive: "arcane_influx",
    weapons: ["staff", "wand", "orb"],
  },

  assassin: {
    id: "assassin",
    name: "Assassin",
    locked: false,
    image: "assets/classes/assassin.png",
    sprite: "assets/sprites/assassin.png",
    tagline: "Vitesse, critique, poison, exécution.",
    desc:
      "La meilleure vitesse et de fortes chances de critique. Très dangereux " +
      "contre les ennemis affaiblis, mais fragile et dépendant du bon build.",
    baseStats: { hp: 92, atk: 17, def: 4, spd: 18, crit: 14 },
    growth: { hp: 12, atk: 3.2, def: 1, spd: 2, crit: 0.7 },
    skills: ["shadow_strike", "poison_blade"],
    passive: "opportunist",
    weapons: ["dagger", "dual_daggers", "short_blade"],
  },
};

export function getClass(id) {
  return CLASSES[id] || null;
}

export function playableClasses() {
  return Object.values(CLASSES).filter((c) => !c.locked);
}
