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
    baseStats: { hp: 120, atk: 14, def: 8, spd: 10, crit: 5, mag: 6, res: 8, dex: 6, acc: 10, critDmg: 60 },
    growth: { hp: 18, atk: 3, def: 2, spd: 1, crit: 0.3, mag: 0.6, res: 0.9, dex: 0.5, acc: 0.7, critDmg: 0 },
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
    baseStats: { hp: 165, atk: 12, def: 15, spd: 7, crit: 3, mag: 6, res: 14, dex: 4, acc: 8, critDmg: 60 },
    growth: { hp: 27, atk: 2.6, def: 3.2, spd: 0.5, crit: 0.1, mag: 0.6, res: 1.6, dex: 0.35, acc: 0.6, critDmg: 0 },
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
    tagline: "Clairvoyance, critique, attaques multiples.",
    desc:
      "Clairvoyance élevée et bonnes chances de critique, dégâts réguliers à " +
      "distance, mais défense faible. Frappe vite et souvent.",
    baseStats: { hp: 98, atk: 15, def: 5, spd: 16, crit: 12, mag: 6, res: 5, dex: 12, acc: 18, critDmg: 60 },
    growth: { hp: 13, atk: 3, def: 1, spd: 2, crit: 0.6, mag: 0.5, res: 0.6, dex: 1.0, acc: 1.3, critDmg: 0 },
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
    baseStats: { hp: 82, atk: 21, def: 3, spd: 11, crit: 8, mag: 20, res: 5, dex: 7, acc: 12, critDmg: 60 },
    growth: { hp: 11, atk: 4.2, def: 0.6, spd: 1, crit: 0.4, mag: 3.4, res: 0.6, dex: 0.6, acc: 0.9, critDmg: 0 },
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
    tagline: "Clairvoyance, critique, poison, exécution.",
    desc:
      "La meilleure Clairvoyance et de fortes chances de critique. Très dangereux " +
      "contre les ennemis affaiblis, mais fragile et dépendant du bon build.",
    baseStats: { hp: 92, atk: 17, def: 4, spd: 18, crit: 14, mag: 6, res: 4, dex: 15, acc: 14, critDmg: 60 },
    growth: { hp: 12, atk: 3.2, def: 1, spd: 2, crit: 0.7, mag: 0.5, res: 0.5, dex: 1.25, acc: 1.0, critDmg: 0 },
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
