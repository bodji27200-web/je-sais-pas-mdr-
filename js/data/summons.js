// Invocations (classes Invocateur / Nécromancien / Maître des pactes). Contrairement
// aux familiers, ce sont de VRAIES unités de combat : elles ont des PV, peuvent
// être ciblées, subir des dégâts, recevoir buffs et altérations, et MOURIR. Elles
// occupent un emplacement d'invocation (nombre strictement limité par la classe).
//
// Leurs statistiques sont DÉRIVÉES de celles du héros au moment de l'invocation
// (fractions ci-dessous) : elles restent pertinentes à tout niveau sans table de
// progression dédiée. C'est l'invocateur qui porte la puissance — voir les
// statMods réduits (Attaque/Magie) des nœuds correspondants dans data/classTree.js.
//
// Champs :
//   element  élément de ses attaques
//   role     "offensif" | "protecteur" | "debuff" — pilote son IA et l'aggro ennemie
//   ttl      manches de présence (null = PERMANENTE, jusqu'à destruction)
//   stats    fractions appliquées aux stats du héros :
//              hpPct atkPct defPct spdPct critPct magPct  (défauts raisonnables)
//   power    puissance de l'attaque de l'invocation (× son Attaque effective)
//   onHit    (optionnel) effet posé sur l'ennemi touché, lancé toutes `every` manches
//   taunt    (protecteur) attire fortement les attaques ennemies

export const SUMMONS = {
  sm_arcane_wisp: {
    id: "sm_arcane_wisp", name: "Feu follet arcanique", element: "chaos", role: "offensif",
    ttl: 4, taunt: false, power: 1,
    stats: { hpPct: 0.22, atkPct: 0.5, defPct: 0.4, spdPct: 1.05, critPct: 1, magPct: 0.7 },
    sprite: "assets/summons/arcane_wisp.png", image: "assets/summons/arcane_wisp.png",
    desc: "Une lueur arcanique fugace qui harcèle l'ennemi avant de se dissiper.",
  },
  sm_bone_thrall: {
    id: "sm_bone_thrall", name: "Serviteur d'os", element: "umbral", role: "debuff",
    ttl: 5, taunt: false, power: 0.9,
    onHit: { type: "atk_debuff", amount: 0.18, turns: 2, every: 2 },
    stats: { hpPct: 0.35, atkPct: 0.55, defPct: 0.7, spdPct: 0.85, critPct: 0.8, magPct: 0.4 },
    sprite: "assets/summons/bone_thrall.png", image: "assets/summons/bone_thrall.png",
    desc: "Un pantin d'ossements qui frappe et affaiblit l'ennemi.",
  },
  sm_skeleton: {
    id: "sm_skeleton", name: "Squelette", element: "umbral", role: "protecteur",
    ttl: null, taunt: true, power: 0.85,
    stats: { hpPct: 0.45, atkPct: 0.42, defPct: 0.9, spdPct: 0.8, critPct: 0.6, magPct: 0.2 },
    sprite: "assets/summons/skeleton.png", image: "assets/summons/skeleton.png",
    desc: "Un guerrier squelettique permanent qui s'interpose et encaisse pour son maître.",
  },
};

export function getSummon(id) {
  return SUMMONS[id] || null;
}

export function allSummons() {
  return Object.values(SUMMONS);
}

// Plafonds d'emplacements recommandés (instr.) : 1 débutant, 2 avancé, 3 endgame.
// Le nombre EFFECTIF vient du nœud équipé (summoner.max). Cette borne dure protège
// le moteur contre toute donnée aberrante.
export const SUMMON_SLOTS_HARD_CAP = 3;
