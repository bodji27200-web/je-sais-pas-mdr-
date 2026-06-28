// Invocations (Lot 16) — VRAIES créatures posées sur le terrain par les classes
// invocateur / nécromancien (compétences `summon` dans data/skills.js). Comme les
// familiers, ce sont des combattants SANS PV (ni tués ni ciblés) qui agissent
// chaque tour via leur propre IA. Leur nombre est STRICTEMENT limité (summoner.max
// du nœud). Certaines sont temporaires (ttl en tours), d'autres permanentes
// (squelettes : durent tout le combat — « jusqu'à destruction »).
//
// Champs : name, element, role, skills (ids de data/famskills.js), ttl (tours ;
//   Infinity = permanent), atkBase/atkPerLevel/atkPerMag (mise à l'échelle).

export const SUMMONS = {
  sm_arcane_wisp: {
    id: "sm_arcane_wisp", name: "Feu follet arcanique", element: "lightning", role: "attaquant",
    sprite: "assets/familiars/sm_arcane_wisp.svg",
    skills: ["fam_static_jolt", "fam_pebble_strike"],
    ttl: 4, atkBase: 6, atkPerLevel: 0.5, atkPerMag: 0.4, spd: 11, crit: 6,
    desc: "Esprit arcanique temporaire (4 tours) qui foudroie l'ennemi.",
  },
  sm_bone_thrall: {
    id: "sm_bone_thrall", name: "Serviteur d'os", element: "umbral", role: "saboteur",
    sprite: "assets/familiars/sm_bone_thrall.svg",
    skills: ["fam_rend", "fam_pebble_strike"],
    ttl: 4, atkBase: 7, atkPerLevel: 0.5, atkPerMag: 0.35, spd: 9, crit: 5,
    desc: "Serviteur d'os temporaire (4 tours) qui frappe et affaiblit l'ennemi.",
  },
  sm_skeleton: {
    id: "sm_skeleton", name: "Squelette", element: "umbral", role: "attaquant",
    sprite: "assets/familiars/sm_skeleton.svg",
    skills: ["fam_pebble_strike", "fam_rend"],
    ttl: Infinity, atkBase: 6, atkPerLevel: 0.45, atkPerMag: 0.3, spd: 9, crit: 5,
    desc: "Squelette PERMANENT (jusqu'à la fin du combat) levé par la nécromancie.",
  },
};

export function getSummon(id) {
  return SUMMONS[id] || null;
}
