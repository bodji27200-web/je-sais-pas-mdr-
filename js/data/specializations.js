// Spécialisations : 3 voies par classe, débloquées au niveau 10.
// Data-driven : ajouter une voie = une entrée ici (+ ses compétences dans skills.js).
//
// Champs :
//   classId      : classe propriétaire
//   name/tagline/desc : présentation
//   statMods     : modificateurs PERMANENTS (appliqués dans getDerivedStats)
//                  { atkPct, defPct, hpPct, spdPct, critFlat }  (tous optionnels)
//   passive      : effets DYNAMIQUES en combat, fusionnés à la passive de classe
//                  (mêmes champs que les passives : lowHpAtk, execute, vsDebuff,
//                   lifestealPct, hpRegenPct, skillPowerPct...)
//   grants       : compétences actives ajoutées au kit (voir data/skills.js)
//   mastery      : maîtrise d'arme — bonus si l'arme de prédilection est équipée
//                  { wtype, atkPct?, critFlat?, defPct? }

export const SPECIALIZATIONS = {
  // ===================== GUERRIER =====================
  warrior_juggernaut: {
    id: "warrior_juggernaut", classId: "warrior", name: "Juggernaut", tagline: "Tank inarrêtable.",
    desc: "Encaisse tout et se soigne en frappant. La voie de la résistance pure.",
    statMods: { defPct: 0.15, hpPct: 0.12 },
    passive: { lifestealPct: 0.1 },
    grants: ["bulwark"],
    mastery: { wtype: "mace", atkPct: 0.1 },
  },
  warrior_berserker: {
    id: "warrior_berserker", classId: "warrior", name: "Berserker", tagline: "Plus il saigne, plus il frappe.",
    desc: "Sacrifie sa garde pour une puissance brute, décuplée à faibles PV.",
    statMods: { atkPct: 0.12, defPct: -0.05 },
    passive: { lowHpAtk: { threshold: 0.5, bonus: 0.4 } },
    grants: ["reckless_swing"],
    mastery: { wtype: "greatsword", atkPct: 0.12 },
  },
  warrior_warlord: {
    id: "warrior_warlord", classId: "warrior", name: "Seigneur de guerre", tagline: "Frappe et commande.",
    desc: "Polyvalent : renforce ses coups et amplifie ses compétences.",
    statMods: { atkPct: 0.06, hpPct: 0.06 },
    passive: { skillPowerPct: 0.12 },
    grants: ["rallying_strike"],
    mastery: { wtype: "sword", critFlat: 5 },
  },

  // ===================== GARDIEN =====================
  guardian_bulwark: {
    id: "guardian_bulwark", classId: "guardian", name: "Rempart", tagline: "Le mur infranchissable.",
    desc: "Défense et régénération extrêmes : il gagne en survivant à tout.",
    statMods: { defPct: 0.2, hpPct: 0.1 },
    passive: { hpRegenPct: 0.06 },
    grants: ["fortress"],
    mastery: { wtype: "shield", defPct: 0.12 },
  },
  guardian_templar: {
    id: "guardian_templar", classId: "guardian", name: "Templier", tagline: "La foi qui soigne et punit.",
    desc: "Convertit ses dégâts en soins. Un tank offensif qui rend coup pour coup.",
    statMods: { atkPct: 0.16, defPct: 0.05 },
    passive: { lifestealPct: 0.2 },
    grants: ["consecrate"],
    mastery: { wtype: "mace", atkPct: 0.12 },
  },
  guardian_sentinel: {
    id: "guardian_sentinel", classId: "guardian", name: "Sentinelle", tagline: "Maîtrise du champ de bataille.",
    desc: "Cloue l'ennemi sur place et frappe plus fort les cibles affaiblies.",
    statMods: { defPct: 0.1, hpPct: 0.06 },
    passive: { vsDebuff: { bonus: 0.2 } },
    grants: ["pin_down"],
    mastery: { wtype: "spear", critFlat: 4 },
  },

  // ===================== ARCHER =====================
  archer_marksman: {
    id: "archer_marksman", classId: "archer", name: "Tireur d'élite", tagline: "Un tir, une exécution.",
    desc: "Critiques massifs et exécution des cibles à faibles PV.",
    statMods: { critFlat: 6, atkPct: 0.06 },
    passive: { execute: { threshold: 0.3, bonus: 0.4 } },
    grants: ["aimed_shot"],
    mastery: { wtype: "longbow", atkPct: 0.12 },
  },
  archer_ranger: {
    id: "archer_ranger", classId: "archer", name: "Rôdeur", tagline: "Vitesse et déluge de flèches.",
    desc: "Tire vite et souvent, en multipliant les frappes.",
    statMods: { spdPct: 0.08, atkPct: 0.05 },
    passive: { skillPowerPct: 0.06 },
    grants: ["arrow_volley"],
    mastery: { wtype: "bow", critFlat: 4 },
  },
  archer_trapper: {
    id: "archer_trapper", classId: "archer", name: "Trappeur", tagline: "Poison et entraves.",
    desc: "Affaiblit ses proies et les achève quand elles sont diminuées.",
    statMods: { atkPct: 0.06, critFlat: 3 },
    passive: { vsDebuff: { bonus: 0.2 } },
    grants: ["venom_shot"],
    mastery: { wtype: "crossbow", atkPct: 0.1 },
  },

  // ===================== MAGE =====================
  mage_pyromancer: {
    id: "mage_pyromancer", classId: "mage", name: "Pyromancien", tagline: "Brûle tout sur son passage.",
    desc: "Sorts dévastateurs qui enflamment durablement.",
    statMods: { atkPct: 0.1 },
    passive: { skillPowerPct: 0.15 },
    grants: ["fireball"],
    mastery: { wtype: "staff", atkPct: 0.1 },
  },
  mage_frost: {
    id: "mage_frost", classId: "mage", name: "Givrenoir", tagline: "Le froid qui paralyse.",
    desc: "Ralentit et affaiblit, puis pulvérise les cibles handicapées.",
    statMods: { atkPct: 0.06, critFlat: 3 },
    passive: { vsDebuff: { bonus: 0.3 } },
    grants: ["frost_nova"],
    mastery: { wtype: "orb", critFlat: 5 },
  },
  mage_arcanist: {
    id: "mage_arcanist", classId: "mage", name: "Arcaniste", tagline: "La survie par la magie.",
    desc: "Boucliers et régénération : un mage qui tient enfin la distance.",
    statMods: { atkPct: 0.06, hpPct: 0.08 },
    passive: { hpRegenPct: 0.04, skillPowerPct: 0.08 },
    grants: ["mana_shield"],
    mastery: { wtype: "wand", atkPct: 0.08 },
  },

  // ===================== ASSASSIN =====================
  assassin_shadowblade: {
    id: "assassin_shadowblade", classId: "assassin", name: "Lame de l'ombre", tagline: "Frappe et disparaît.",
    desc: "Critiques foudroyants et exécutions sur cibles affaiblies.",
    statMods: { critFlat: 6, atkPct: 0.06 },
    passive: { execute: { threshold: 0.45, bonus: 0.5 } },
    grants: ["assassinate"],
    mastery: { wtype: "dagger", atkPct: 0.1 },
  },
  assassin_venom: {
    id: "assassin_venom", classId: "assassin", name: "Empoisonneur", tagline: "La mort à petit feu.",
    desc: "Poisons puissants et bonus contre les cibles diminuées.",
    statMods: { atkPct: 0.08 },
    passive: { vsDebuff: { bonus: 0.3 } },
    grants: ["toxic_strike"],
    mastery: { wtype: "short_blade", atkPct: 0.1 },
  },
  assassin_duelist: {
    id: "assassin_duelist", classId: "assassin", name: "Duelliste", tagline: "Danse de lames.",
    desc: "Vitesse extrême, frappes multiples et vol de vie.",
    statMods: { spdPct: 0.12, critFlat: 3 },
    passive: { lifestealPct: 0.12 },
    grants: ["flurry"],
    mastery: { wtype: "dual_daggers", critFlat: 5 },
  },
};

export function getSpec(id) {
  return SPECIALIZATIONS[id] || null;
}

// Les 3 voies d'une classe.
export function specsForClass(classId) {
  return Object.values(SPECIALIZATIONS).filter((s) => s.classId === classId);
}

// Niveau requis pour débloquer la spécialisation.
export const SPEC_UNLOCK_LEVEL = 10;

// Coût (en or) du n-ième changement de voie (le 1er choix est gratuit).
// 0 changement payé -> 500, puis ×3 à chaque fois.
export function respecCost(timesChanged) {
  return 500 * Math.pow(3, timesChanged || 0);
}
