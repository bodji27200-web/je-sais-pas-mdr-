// Ressources de classe — data-driven (Lot 8).
//
// Chaque classe possède une petite mécanique de rythme propre qui empêche le
// spam des compétences les plus fortes : une compétence puissante demande une
// préparation (accumuler la ressource) en plus de sa recharge. L'attaque de
// base reste utile car elle GÉNÈRE la ressource.
//
// La ressource est TRANSITOIRE au combat : elle vit dans l'objet `combat` et
// n'est jamais persistée. Aucune migration de sauvegarde n'est donc requise.
//
// Le moteur (systems/combat.js) lit ces règles de façon GÉNÉRIQUE :
//   start          valeur en début de combat
//   max            plafond
//   regenPerTurn   régénération passive à chaque entretien (upkeep)
//   onBasicAttack  gain en utilisant l'attaque de base
//   onDealDamage   gain en infligeant des dégâts avec une compétence (1×/action)
//   onTakeDamage   gain en subissant des dégâts
//   onCrit         gain en plaçant un coup critique
//   onGuardAbsorb  gain quand une garde/bouclier absorbe une attaque
//   onDefensiveSkill gain en utilisant une compétence de soutien (sur soi)
//
// Tous les champs sont optionnels (absents = 0). Les ennemis n'ont PAS de
// ressource : leurs compétences n'ont pas de coût, le système reste donc
// rétrocompatible (rien à changer côté ennemi/IA).

export const CLASS_RESOURCES = {
  warrior: {
    id: "rage",
    name: "Rage",
    color: "#e8533a",
    icon: "🔥",
    start: 25, // un peu d'adrénaline d'ouverture (équilibrage Lot 9)
    max: 100,
    regenPerTurn: 0,
    onBasicAttack: 18, // frapper construit la Rage
    onDealDamage: 6,
    onTakeDamage: 12, // encaisser nourrit aussi la Rage
    desc:
      "La Rage monte en frappant et en encaissant des coups. Tes compétences " +
      "les plus lourdes la consomment : pas de spam, il faut la préparer.",
  },
  guardian: {
    id: "guard",
    name: "Garde",
    color: "#5a9bd4",
    icon: "🛡️",
    start: 20,
    max: 100,
    regenPerTurn: 0,
    onBasicAttack: 10,
    onTakeDamage: 8,
    onGuardAbsorb: 30, // bloquer une attaque génère beaucoup de Garde
    onDefensiveSkill: 22, // se mettre en garde alimente la ressource
    desc:
      "La Garde se construit en te défendant et en bloquant les attaques. " +
      "Dépense-la dans tes ripostes et tes frappes protectrices.",
  },
  archer: {
    id: "focus",
    name: "Concentration",
    color: "#7ed957",
    icon: "🎯",
    start: 30,
    max: 100,
    regenPerTurn: 0,
    onBasicAttack: 22, // viser construit la Concentration
    onDealDamage: 4,
    onCrit: 8,
    desc:
      "La Concentration s'accumule en alternant tirs simples et préparation. " +
      "Les gros tirs conditionnels la consomment d'un coup.",
  },
  mage: {
    id: "mana",
    name: "Mana",
    color: "#5b8def",
    icon: "🔷",
    start: 100,
    max: 100,
    regenPerTurn: 14, // le mana se régénère seul
    onBasicAttack: 10,
    desc:
      "Le Mana se régénère chaque tour. Tous tes sorts le consomment : gère " +
      "ta réserve, l'attaque de base la recharge un peu.",
  },
  assassin: {
    id: "shadow",
    name: "Ombre",
    color: "#9b6dc9",
    icon: "🌙",
    start: 35, // entre dans l'ombre avec une charge initiale (équilibrage Lot 9)
    max: 100,
    regenPerTurn: 0,
    onBasicAttack: 16,
    onDealDamage: 5,
    onCrit: 12, // les critiques nourrissent l'Ombre
    desc:
      "L'Ombre se charge en frappant et en plaçant des critiques. Elle " +
      "alimente tes exécutions et tes poisons les plus violents.",
  },
};

export function getClassResource(classId) {
  return CLASS_RESOURCES[classId] || null;
}
