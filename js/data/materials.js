// Identité des matériaux d'armure : bonus de SEUIL (2 / 4 pièces) et un passif
// COMPORTEMENTAL par matériau (un comportement, pas un simple multiplicateur).
//
// Conçu pour des builds HYBRIDES viables : 2 pièces d'un matériau suffisent à
// activer son premier bonus. On peut donc mixer 2 Tissu + 2 Métal et cumuler
// les deux bonus « 2 pièces » (aucun set complet de 5 pièces n'est imposé).
//
// statMods (appliqués dans getDerivedStats) :
//   atkPct, defPct, hpPct, spdPct, critFlat
// behavior (appliqué dans systems/combat.js) — un id de comportement :
//   "concentration" (Tissu)  : après 2 compétences différentes, la prochaine
//                              compétence inflige +25 % de dégâts.
//   "souplesse" (Cuir)       : ~14 % de chances d'esquiver une attaque ; après
//                              une esquive, +8 % de critique pendant 2 tours.
//   "stabilite" (Métal)      : la 1re attaque subie du combat est réduite de 40 %.

export const MATERIALS = {
  cloth: {
    id: "cloth",
    name: "Tissu",
    color: "#7c5cff",
    identity: "Magie, critique, montée en puissance des compétences.",
    bonus2: { statMods: { atkPct: 0.06, critFlat: 2 }, label: "2 pièces : +6 % ATK · +2 % crit" },
    bonus4: {
      statMods: { atkPct: 0.06, critFlat: 2 },
      behavior: "concentration",
      label: "4 pièces : +6 % ATK · Concentration (compétence suivante renforcée après 2 compétences différentes)",
    },
  },
  leather: {
    id: "leather",
    name: "Cuir",
    color: "#c08a3e",
    identity: "Mobilité, précision, esquive contrôlée.",
    bonus2: { statMods: { spdPct: 0.05, critFlat: 3 }, label: "2 pièces : +5 % VIT · +3 % crit" },
    bonus4: {
      statMods: { spdPct: 0.04, critFlat: 3 },
      behavior: "souplesse",
      label: "4 pièces : +4 % VIT · Souplesse (esquive ; +crit après une esquive)",
    },
  },
  metal: {
    id: "metal",
    name: "Métal",
    color: "#9aa6b2",
    identity: "Armure, stabilité, résistance aux gros coups.",
    bonus2: { statMods: { defPct: 0.08, hpPct: 0.05 }, label: "2 pièces : +8 % DEF · +5 % PV" },
    bonus4: {
      statMods: { defPct: 0.06, hpPct: 0.05 },
      behavior: "stabilite",
      label: "4 pièces : +6 % DEF · Stabilité (1re attaque subie réduite de 40 %)",
    },
  },
};

export function getMaterial(id) {
  return MATERIALS[id] || null;
}

// Paramètres numériques des comportements (tunables, lus par le combat).
export const MATERIAL_BEHAVIOR = {
  concentration: { skillsNeeded: 2, bonus: 0.25 },
  souplesse: { evasionPct: 14, critBuff: 8, critTurns: 2 },
  stabilite: { reduce: 0.4 },
};
