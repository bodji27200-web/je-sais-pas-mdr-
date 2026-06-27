// Compétences de familiers (familier ÉQUIPÉ, autonome). Le familier n'a PAS de
// PV et n'est jamais ciblé : il choisit et lance ces compétences chaque manche
// via le résolveur `allyAct` (voir systems/combat.js). Elles restent volontairement
// MODESTES — un familier épaule le héros, il ne gagne jamais le combat à sa place.
//
// Champs :
//   kind     "attack" | "heal" | "guard" | "cleanse" | "dispel" | "resource"
//            | "empower" | "shield"
//   element  élément des dégâts (attack) — sinon neutre
//   cooldown manches de recharge (évite tout spam / toute boucle)
//   power    (attack) fraction de l'Attaque du familier appliquée à l'ennemi
//   pctMaxHp (heal/shield) part des PV max du héros — PLAFONNÉE par le moteur
//   guardPct (guard) part de la réserve de Garde du héros restaurée
//   resPct   (resource) part de la ressource de classe rendue au héros
//   amount   (empower) ampleur du buff ; turns sa durée
//
// L'IA du familier (postures agressif / équilibré / soutien / prudent) lit ces
// champs et l'état du combat (PV/Mana/Garde/altérations du héros, buffs ennemis,
// résistances, recharges, rôle) pour décider — voir scoreFamSkill dans le moteur.

export const FAM_SKILLS = {
  // --- Offensif --------------------------------------------------------------
  fam_strike: {
    id: "fam_strike", name: "Assaut", kind: "attack", cooldown: 0, power: 0.85,
    desc: "Une frappe rapide sur l'ennemi.",
  },
  fam_ember_bolt: {
    id: "fam_ember_bolt", name: "Trait de braise", kind: "attack", element: "fire", cooldown: 2, power: 1.1,
    desc: "Un projectile de Feu qui exploite les vulnérabilités élémentaires.",
  },
  fam_spark_bolt: {
    id: "fam_spark_bolt", name: "Éclat d'orage", kind: "attack", element: "lightning", cooldown: 2, power: 1.1,
    desc: "Une décharge de Foudre sur l'ennemi.",
  },
  fam_umbral_lash: {
    id: "fam_umbral_lash", name: "Fouet umbral", kind: "attack", element: "umbral", cooldown: 2, power: 1.05,
    desc: "Un fouet d'ombre qui ronge l'ennemi.",
  },
  fam_chaos_burst: {
    id: "fam_chaos_burst", name: "Salve de chaos", kind: "attack", element: "chaos", cooldown: 3, power: 1.3,
    desc: "Une salve instable et puissante de Chaos.",
  },

  // --- Soutien (soin / ressource) -------------------------------------------
  fam_mend: {
    id: "fam_mend", name: "Réconfort", kind: "heal", cooldown: 3, pctMaxHp: 0.05,
    desc: "Rend une petite part des PV du héros (plafonnée).",
  },
  fam_channel: {
    id: "fam_channel", name: "Canalisation", kind: "resource", cooldown: 3, resPct: 0.18,
    desc: "Restitue une part de la ressource de classe du héros (Mana, Rage…).",
  },
  fam_empower: {
    id: "fam_empower", name: "Exaltation", kind: "empower", cooldown: 4, amount: 0.12, turns: 3,
    desc: "Renforce l'Attaque du héros pendant quelques manches.",
  },

  // --- Protection (garde / bouclier) ----------------------------------------
  fam_ward: {
    id: "fam_ward", name: "Égide", kind: "shield", cooldown: 4, pctMaxHp: 0.08,
    desc: "Pose un bouclier sur le héros.",
  },
  fam_bulwark: {
    id: "fam_bulwark", name: "Rempart", kind: "guard", cooldown: 3, guardPct: 0.3,
    desc: "Restaure une part de la réserve de Garde du héros.",
  },

  // --- Spécialistes (purification / anti-buff) ------------------------------
  fam_purify: {
    id: "fam_purify", name: "Purification", kind: "cleanse", cooldown: 3,
    desc: "Dissipe une altération (poison, saignement, état élémentaire) du héros.",
  },
  fam_disrupt: {
    id: "fam_disrupt", name: "Dissipation", kind: "dispel", cooldown: 3,
    desc: "Dissipe un renforcement (buff) de l'ennemi.",
  },
};

export function getFamSkill(id) {
  return FAM_SKILLS[id] || null;
}

// Kit de compétences par défaut d'un familier, dérivé de son rôle + élément si le
// familier ne déclare pas explicitement `skills`. Garantit que CHAQUE familier
// agit réellement, sans imposer de réécrire toutes les données existantes.
export function defaultFamSkills(fam) {
  const el = fam.element;
  const eleAtk = el === "fire" ? "fam_ember_bolt"
    : el === "lightning" ? "fam_spark_bolt"
    : el === "umbral" ? "fam_umbral_lash"
    : el === "chaos" ? "fam_chaos_burst"
    : null;
  switch (fam.role) {
    case "offensif":
      return eleAtk ? ["fam_strike", eleAtk, "fam_disrupt"] : ["fam_strike", "fam_empower"];
    case "protecteur":
      return ["fam_bulwark", "fam_ward", "fam_strike"];
    case "soutien":
      return ["fam_mend", "fam_channel", "fam_purify"];
    case "rapide":
      return eleAtk ? ["fam_strike", eleAtk, "fam_empower"] : ["fam_strike", "fam_empower"];
    default:
      return ["fam_strike"];
  }
}

// Posture d'IA par défaut selon le rôle (modifiable par le joueur, voir
// systems/familiars.js). Quatre postures simples : agressif, équilibré, soutien,
// prudent.
export const FAM_POSTURES = ["agressif", "equilibre", "soutien", "prudent"];
export const FAM_POSTURE_LABELS = {
  agressif: "Agressif", equilibre: "Équilibré", soutien: "Soutien", prudent: "Prudent",
};
export function defaultPosture(fam) {
  switch (fam.role) {
    case "offensif": return "agressif";
    case "protecteur": return "prudent";
    case "soutien": return "soutien";
    case "rapide": return "equilibre";
    default: return "equilibre";
  }
}
