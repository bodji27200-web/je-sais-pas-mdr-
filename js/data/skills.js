// Compétences (joueur et ennemis) — data-driven.
//
// Champs d'une compétence active :
//   power     : multiplicateur de dégâts (0 = pas de dégâts directs)
//   hits      : nombre de frappes (multi-hit ; défaut 1)
//   cooldown  : tours de recharge
//   critBonus : bonus de crit (%) pour CETTE frappe uniquement
//   target    : "enemy" | "self"
//   anim      : catégorie d'animation (générique, gérée par l'UI)
//   self      : effets appliqués au lanceur   [{ type, ... }]
//   onHit     : effets appliqués à la cible touchée [{ type, ... }]
//
// Effets gérés par le moteur (systems/combat.js) :
//   atk_buff {amount,turns}      attaque ×(1+amount)
//   def_buff {amount,turns}      défense ×(1+amount)
//   atk_debuff {amount,turns}    attaque de la cible ×(1-amount)
//   slow {amount,turns}          vitesse de la cible ×(1-amount)
//   guard {reduce,turns}         réduit la prochaine attaque reçue de `reduce`
//   shield {pctMaxHp,turns}      bouclier absorbant des dégâts
//   heal {pctMaxHp}              soin immédiat
//   poison {pctAtk,turns}        dégâts sur la durée (basés sur l'ATK du lanceur)
//   bleed {pctAtk,turns}         idem, catégorie distincte (cumulable)
//
// Champs d'une passive (`passive: {...}`) :
//   maxHpPct, hpRegenPct, defPct, critFlat, spdPct, atkPct,
//   skillPowerPct (boost des compétences hors attaque de base),
//   execute {threshold,bonus}  (dégâts ×(1+bonus) si cible sous `threshold` PV),
//   lowHpAtk {threshold,bonus} (ATK ×(1+bonus) sous `threshold` PV du lanceur),
//   vsDebuff {bonus}           (dégâts ×(1+bonus) si la cible a un malus/DoT)

export const SKILLS = {
  // --- Commun ---
  basic_attack: {
    id: "basic_attack", name: "Attaque", type: "active", power: 1.0, cooldown: 0,
    target: "enemy", anim: "light", desc: "Une attaque simple infligeant 100 % de tes dégâts.",
  },

  // ===================== GUERRIER =====================
  heavy_strike: {
    id: "heavy_strike", name: "Frappe lourde", type: "active", power: 1.7, cooldown: 2,
    target: "enemy", anim: "heavy",
    desc: "Frappe puissante infligeant 170 % des dégâts. (Récup. 2)",
  },
  war_cry: {
    id: "war_cry", name: "Cri de guerre", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff", self: [{ type: "atk_buff", amount: 0.3, turns: 3 }],
    desc: "Augmente ton attaque de 30 % pendant 3 tours. (Récup. 4)",
  },
  endurance: {
    id: "endurance", name: "Endurance", type: "passive",
    passive: { maxHpPct: 0.1, hpRegenPct: 0.04 },
    desc: "PV max +10 % et régénère 4 % des PV chaque tour.",
  },

  // ===================== GARDIEN =====================
  shield_bash: {
    id: "shield_bash", name: "Coup de bouclier", type: "active", power: 0.8, cooldown: 2,
    target: "enemy", anim: "heavy", onHit: [{ type: "atk_debuff", amount: 0.25, turns: 2 }],
    desc: "Dégâts faibles (80 %) et réduit l'attaque ennemie de 25 % pendant 2 tours.",
  },
  taunt_guard: {
    id: "taunt_guard", name: "Provocation", type: "active", power: 0, cooldown: 3,
    target: "self", anim: "buff",
    self: [{ type: "guard", reduce: 0.5, turns: 1 }, { type: "def_buff", amount: 0.4, turns: 2 }],
    desc: "Réduit de 50 % la prochaine attaque reçue et augmente ta défense de 40 % pendant 2 tours. (Récup. 3)",
  },
  living_armor: {
    id: "living_armor", name: "Armure vivante", type: "passive",
    passive: { defPct: 0.18, maxHpPct: 0.05 },
    desc: "Défense +18 % et PV max +5 %.",
  },

  // ===================== ARCHER =====================
  precise_shot: {
    id: "precise_shot", name: "Tir précis", type: "active", power: 1.5, cooldown: 2,
    target: "enemy", anim: "ranged", critBonus: 35,
    desc: "Tir puissant (150 %) avec +35 % de chances de critique sur ce coup.",
  },
  double_shot: {
    id: "double_shot", name: "Double flèche", type: "active", power: 0.7, hits: 2, cooldown: 1,
    target: "enemy", anim: "ranged",
    desc: "Deux flèches infligeant chacune 70 % des dégâts.",
  },
  hunter_eye: {
    id: "hunter_eye", name: "Œil du chasseur", type: "passive",
    passive: { critFlat: 6, spdPct: 0.1 },
    desc: "Critique +6 % et vitesse +10 %.",
  },

  // ===================== MAGE =====================
  arcane_bolt: {
    id: "arcane_bolt", name: "Projectile arcanique", type: "active", power: 1.7, cooldown: 1,
    target: "enemy", anim: "magic",
    desc: "Projectile magique infligeant 170 % des dégâts.",
  },
  arcane_barrier: {
    id: "arcane_barrier", name: "Barrière arcanique", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff", self: [{ type: "shield", pctMaxHp: 0.5, turns: 3 }],
    desc: "Crée un bouclier absorbant jusqu'à 50 % de tes PV max pendant 3 tours. (Récup. 4)",
  },
  arcane_influx: {
    id: "arcane_influx", name: "Afflux magique", type: "passive",
    passive: { skillPowerPct: 0.25 },
    desc: "Dégâts des compétences (hors attaque de base) +25 %.",
  },

  // ===================== ASSASSIN =====================
  shadow_strike: {
    id: "shadow_strike", name: "Frappe de l'ombre", type: "active", power: 1.3, cooldown: 1,
    target: "enemy", anim: "light", critBonus: 30,
    desc: "Frappe rapide (130 %) avec +30 % de chances de critique.",
  },
  poison_blade: {
    id: "poison_blade", name: "Lame empoisonnée", type: "active", power: 1.0, cooldown: 2,
    target: "enemy", anim: "light", onHit: [{ type: "poison", pctAtk: 0.45, turns: 3 }],
    desc: "Dégâts immédiats (100 %) puis poison (45 % de l'ATK / tour, 3 tours).",
  },
  opportunist: {
    id: "opportunist", name: "Opportuniste", type: "passive",
    passive: { execute: { threshold: 0.4, bonus: 0.6 } },
    desc: "Inflige +60 % de dégâts aux cibles sous 40 % de leurs PV.",
  },

  // ===================== ENNEMIS =====================
  feral_bite: {
    id: "feral_bite", name: "Morsure féroce", type: "active", power: 1.4, cooldown: 3,
    target: "enemy", anim: "light", desc: "Une morsure sauvage (140 %).",
  },
  goblin_smash: {
    id: "goblin_smash", name: "Coup de gourdin", type: "active", power: 1.6, cooldown: 2,
    target: "enemy", anim: "heavy", desc: "Un coup brutal (160 %).",
  },
  boss_cleave: {
    id: "boss_cleave", name: "Fendoir du chef", type: "active", power: 2.0, cooldown: 3,
    target: "enemy", anim: "heavy", desc: "Une frappe dévastatrice (200 %).",
  },
  boss_roar: {
    id: "boss_roar", name: "Rugissement", type: "active", power: 0, cooldown: 5,
    target: "self", anim: "buff", self: [{ type: "atk_buff", amount: 0.4, turns: 3 }],
    desc: "Le chef hurle : attaque +40 % pendant 3 tours.",
  },
};

export function getSkill(id) {
  return SKILLS[id] || null;
}
