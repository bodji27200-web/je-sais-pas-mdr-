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
    passive: { maxHpPct: 0.1, hpRegenPct: 0.028 },
    desc: "PV max +10 % et régénère ~3 % des PV chaque tour.",
  },

  // ===================== GARDIEN =====================
  shield_bash: {
    id: "shield_bash", name: "Coup de bouclier", type: "active", power: 1.1, cooldown: 2,
    target: "enemy", anim: "heavy", onHit: [{ type: "atk_debuff", amount: 0.25, turns: 2 }],
    desc: "Dégâts (110 %) et réduit l'attaque ennemie de 25 % pendant 2 tours.",
  },
  taunt_guard: {
    id: "taunt_guard", name: "Provocation", type: "active", power: 0, cooldown: 3,
    target: "self", anim: "buff",
    self: [{ type: "guard", reduce: 0.5, turns: 1 }, { type: "def_buff", amount: 0.4, turns: 2 }],
    desc: "Réduit de 50 % la prochaine attaque reçue et augmente ta défense de 40 % pendant 2 tours. (Récup. 3)",
  },
  living_armor: {
    id: "living_armor", name: "Armure vivante", type: "passive",
    passive: { defPct: 0.18, maxHpPct: 0.05, lifestealPct: 0.18 },
    desc: "Défense +18 %, PV max +5 % et soigne 18 % des dégâts infligés (vol de vie).",
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

  // ===================== SPÉCIALISATIONS =====================
  // -- Guerrier --
  bulwark: {
    id: "bulwark", name: "Rempart", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff",
    self: [{ type: "def_buff", amount: 0.45, turns: 2 }, { type: "shield", pctMaxHp: 0.25, turns: 2 }],
    desc: "Défense +45 % et bouclier (25 % des PV max) pendant 2 tours. (Récup. 4)",
  },
  reckless_swing: {
    id: "reckless_swing", name: "Coup téméraire", type: "active", power: 2.2, cooldown: 3,
    target: "enemy", anim: "heavy", critBonus: 25,
    desc: "Une frappe sauvage (220 %) avec +25 % de critique. (Récup. 3)",
  },
  rallying_strike: {
    id: "rallying_strike", name: "Frappe de ralliement", type: "active", power: 1.3, cooldown: 3,
    target: "enemy", anim: "heavy", self: [{ type: "atk_buff", amount: 0.25, turns: 3 }],
    desc: "Frappe (130 %) et galvanise : attaque +25 % pendant 3 tours.",
  },

  // -- Gardien --
  fortress: {
    id: "fortress", name: "Forteresse", type: "active", power: 0, cooldown: 5,
    target: "self", anim: "buff",
    self: [{ type: "def_buff", amount: 0.6, turns: 3 }, { type: "guard", reduce: 0.5, turns: 1 }, { type: "shield", pctMaxHp: 0.3, turns: 3 }],
    desc: "Défense +60 %, prochaine attaque -50 %, bouclier (30 % PV) sur 3 tours. (Récup. 5)",
  },
  consecrate: {
    id: "consecrate", name: "Consécration", type: "active", power: 1.4, cooldown: 3,
    target: "enemy", anim: "heavy", self: [{ type: "heal", pctMaxHp: 0.18 }],
    desc: "Frappe sacrée (140 %) et te soigne de 18 % des PV max.",
  },
  pin_down: {
    id: "pin_down", name: "Clouer au sol", type: "active", power: 1.2, cooldown: 3,
    target: "enemy", anim: "heavy",
    onHit: [{ type: "slow", amount: 0.3, turns: 2 }, { type: "atk_debuff", amount: 0.2, turns: 2 }],
    desc: "Empale (120 %), ralentit (-30 % VIT) et affaiblit (-20 % ATK).",
  },

  // -- Archer --
  aimed_shot: {
    id: "aimed_shot", name: "Tir ajusté", type: "active", power: 2.0, cooldown: 3,
    target: "enemy", anim: "ranged", critBonus: 50,
    desc: "Un tir mortel (200 %) avec +50 % de chances de critique. (Récup. 3)",
  },
  arrow_volley: {
    id: "arrow_volley", name: "Volée de flèches", type: "active", power: 0.6, hits: 3, cooldown: 2,
    target: "enemy", anim: "ranged",
    desc: "Trois flèches infligeant chacune 60 % des dégâts.",
  },
  venom_shot: {
    id: "venom_shot", name: "Tir empoisonné", type: "active", power: 1.1, cooldown: 2,
    target: "enemy", anim: "ranged",
    onHit: [{ type: "poison", pctAtk: 0.5, turns: 3 }, { type: "slow", amount: 0.25, turns: 2 }],
    desc: "Flèche toxique (110 %), poison (50 % ATK/tour) et ralentissement.",
  },

  // -- Mage --
  fireball: {
    id: "fireball", name: "Boule de feu", type: "active", power: 1.9, cooldown: 2,
    target: "enemy", anim: "magic", onHit: [{ type: "bleed", pctAtk: 0.4, turns: 3 }],
    desc: "Explosion ardente (190 %) qui embrase la cible (40 % ATK/tour).",
  },
  frost_nova: {
    id: "frost_nova", name: "Nova de givre", type: "active", power: 1.3, cooldown: 3,
    target: "enemy", anim: "magic",
    onHit: [{ type: "slow", amount: 0.35, turns: 2 }, { type: "atk_debuff", amount: 0.2, turns: 2 }],
    desc: "Vague glaciale (130 %) qui ralentit (-35 % VIT) et affaiblit (-20 % ATK).",
  },
  mana_shield: {
    id: "mana_shield", name: "Bouclier de mana", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff",
    self: [{ type: "shield", pctMaxHp: 0.4, turns: 3 }, { type: "heal", pctMaxHp: 0.12 }],
    desc: "Bouclier (40 % PV) sur 3 tours et soin immédiat de 12 % des PV. (Récup. 4)",
  },

  // -- Assassin --
  assassinate: {
    id: "assassinate", name: "Assassinat", type: "active", power: 2.1, cooldown: 3,
    target: "enemy", anim: "light", critBonus: 45,
    desc: "Frappe à la jugulaire (210 %) avec +45 % de critique. (Récup. 3)",
  },
  toxic_strike: {
    id: "toxic_strike", name: "Frappe toxique", type: "active", power: 1.1, cooldown: 2,
    target: "enemy", anim: "light", onHit: [{ type: "poison", pctAtk: 0.6, turns: 3 }],
    desc: "Lame enduite (110 %) puis poison violent (60 % ATK/tour, 3 tours).",
  },
  flurry: {
    id: "flurry", name: "Déluge de lames", type: "active", power: 0.6, hits: 3, cooldown: 2,
    target: "enemy", anim: "light", critBonus: 10,
    desc: "Trois frappes rapides (60 % chacune) avec +10 % de critique.",
  },

  // ===================== ENNEMIS =====================
  // -- Skirmisher (loup) : rapide, saigne ses proies.
  feral_bite: {
    id: "feral_bite", name: "Morsure féroce", type: "active", power: 1.4, cooldown: 3,
    target: "enemy", anim: "light", desc: "Une morsure sauvage (140 %).",
  },
  rending_claws: {
    id: "rending_claws", name: "Griffes lacérantes", type: "active", power: 1.0, cooldown: 2,
    target: "enemy", anim: "light", onHit: [{ type: "bleed", pctAtk: 0.4, turns: 3 }],
    desc: "Lacère la cible (100 %) et provoque un saignement.",
  },

  // -- Brute (gobelin) : frappe fort, jette des projectiles, enrage.
  goblin_smash: {
    id: "goblin_smash", name: "Coup de gourdin", type: "active", power: 1.6, cooldown: 2,
    target: "enemy", anim: "heavy", desc: "Un coup brutal (160 %).",
  },
  goblin_throw: {
    id: "goblin_throw", name: "Hache lancée", type: "active", power: 1.2, cooldown: 2,
    target: "enemy", anim: "ranged", onHit: [{ type: "atk_debuff", amount: 0.2, turns: 2 }],
    desc: "Lance une hache (120 %) et entaille le bras adverse (ATK -20 %).",
  },

  // -- Bruiser (sanglier) : charge dévastatrice, encorne et ralentit, régénère.
  boar_charge: {
    id: "boar_charge", name: "Charge", type: "active", power: 1.9, cooldown: 3,
    target: "enemy", anim: "heavy", desc: "Une charge qui renverse tout (190 %).",
  },
  boar_gore: {
    id: "boar_gore", name: "Encornage", type: "active", power: 1.0, cooldown: 2,
    target: "enemy", anim: "heavy", onHit: [{ type: "slow", amount: 0.3, turns: 2 }],
    desc: "Encorne (100 %) et ralentit la cible de 30 %.",
  },

  // -- Skirmisher (bandit) : poison et esquive.
  bandit_shiv: {
    id: "bandit_shiv", name: "Coup de surin", type: "active", power: 1.1, cooldown: 2,
    target: "enemy", anim: "light", onHit: [{ type: "poison", pctAtk: 0.4, turns: 3 }],
    desc: "Une lame empoisonnée (110 %) puis poison.",
  },
  smoke_step: {
    id: "smoke_step", name: "Pas de fumée", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff",
    self: [{ type: "guard", reduce: 0.6, turns: 1 }, { type: "spd_buff", amount: 0.25, turns: 2 }],
    desc: "Esquive la prochaine attaque (-60 %) et gagne en vitesse.",
  },

  // -- Boss : panoplie complète (burst, buff, défense, enrage).
  boss_cleave: {
    id: "boss_cleave", name: "Fendoir du chef", type: "active", power: 2.0, cooldown: 3,
    target: "enemy", anim: "heavy", desc: "Une frappe dévastatrice (200 %).",
  },
  boss_roar: {
    id: "boss_roar", name: "Rugissement", type: "active", power: 0, cooldown: 5,
    target: "self", anim: "buff", self: [{ type: "atk_buff", amount: 0.4, turns: 3 }],
    desc: "Le chef hurle : attaque +40 % pendant 3 tours.",
  },
  boss_quake: {
    id: "boss_quake", name: "Choc sismique", type: "active", power: 2.4, cooldown: 4,
    target: "enemy", anim: "heavy", onHit: [{ type: "slow", amount: 0.25, turns: 2 }],
    desc: "Martèle le sol (240 %) et déstabilise l'adversaire (VIT -25 %).",
  },
  boss_guard: {
    id: "boss_guard", name: "Garde du chef", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff",
    self: [{ type: "def_buff", amount: 0.5, turns: 2 }, { type: "guard", reduce: 0.4, turns: 1 }],
    desc: "Se met en garde : défense +50 % et prochaine attaque réduite de 40 %.",
  },

  // --- Passives ennemies (effets dynamiques en combat) ---
  enrage: {
    id: "enrage", name: "Furie", type: "passive",
    passive: { lowHpAtk: { threshold: 0.35, bonus: 0.5 } },
    desc: "Sous 35 % de PV, attaque +50 %.",
  },
  regeneration: {
    id: "regeneration", name: "Régénération", type: "passive",
    passive: { hpRegenPct: 0.05 },
    desc: "Régénère 5 % de ses PV max chaque tour.",
  },
};

export function getSkill(id) {
  return SKILLS[id] || null;
}
