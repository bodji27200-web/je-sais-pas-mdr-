// Compétences (joueur et ennemis).
// type: "active" => utilisable en combat ; "passive" => effet permanent.
// power: multiplicateur appliqué à l'ATK pour les dégâts (0 = pas de dégâts directs).
// cooldown: nombre de tours avant réutilisation.
// effect: effets annexes (buff, poison, soin...).
// anim: type d'animation visuelle (data-driven). Valeurs gérées par l'UI :
//   "dash"  -> petit déplacement vers la cible + impact + retour
//   "heavy" -> impact plus fort, secousse accentuée
//   "buff"  -> aura/pulsation autour du lanceur, sans déplacement
// (un type inconnu retombe proprement sur "dash" côté UI).

export const SKILLS = {
  // --- Commun ---
  basic_attack: {
    id: "basic_attack",
    name: "Attaque",
    type: "active",
    power: 1.0,
    cooldown: 0,
    target: "enemy",
    anim: "dash",
    desc: "Une attaque simple infligeant 100 % de tes dégâts.",
  },

  // --- Guerrier ---
  heavy_strike: {
    id: "heavy_strike",
    name: "Frappe lourde",
    type: "active",
    power: 1.7,
    cooldown: 2,
    target: "enemy",
    anim: "heavy",
    desc: "Une frappe puissante infligeant 170 % de tes dégâts. (Récup. 2 tours)",
  },
  war_cry: {
    id: "war_cry",
    name: "Cri de guerre",
    type: "active",
    power: 0,
    cooldown: 4,
    target: "self",
    anim: "buff",
    effect: { type: "atk_buff", amount: 0.3, turns: 3 },
    desc: "Augmente ton attaque de 30 % pendant 3 tours. (Récup. 4 tours)",
  },
  endurance: {
    id: "endurance",
    name: "Endurance",
    type: "passive",
    desc: "Augmente tes PV max de 10 % et régénère 4 % de tes PV chaque tour.",
    passive: { maxHpPct: 0.1, hpRegenPct: 0.04 },
  },

  // --- Ennemis ---
  feral_bite: {
    id: "feral_bite",
    name: "Morsure féroce",
    type: "active",
    power: 1.4,
    cooldown: 3,
    target: "enemy",
    anim: "dash",
    desc: "Une morsure sauvage infligeant 140 % des dégâts.",
  },
  goblin_smash: {
    id: "goblin_smash",
    name: "Coup de gourdin",
    type: "active",
    power: 1.6,
    cooldown: 2,
    target: "enemy",
    anim: "heavy",
    desc: "Un coup brutal infligeant 160 % des dégâts.",
  },
  boss_cleave: {
    id: "boss_cleave",
    name: "Fendoir du chef",
    type: "active",
    power: 2.0,
    cooldown: 3,
    target: "enemy",
    anim: "heavy",
    desc: "Une frappe dévastatrice infligeant 200 % des dégâts.",
  },
  boss_roar: {
    id: "boss_roar",
    name: "Rugissement",
    type: "active",
    power: 0,
    cooldown: 5,
    target: "self",
    anim: "buff",
    effect: { type: "atk_buff", amount: 0.4, turns: 3 },
    desc: "Le chef hurle et augmente son attaque de 40 % pendant 3 tours.",
  },
};

export function getSkill(id) {
  return SKILLS[id] || null;
}
