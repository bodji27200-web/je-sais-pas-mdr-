// Compétences de FAMILIERS / INVOCATIONS (Lot 16). Un familier-combattant et une
// invocation choisissent une de ces compétences chaque tour via leur PROPRE IA
// (voir systems/familiars.js -> chooseFamiliarSkill, et le résolveur d'alliés dans
// systems/combat.js -> allyAct).
//
// Schéma souple (tous les champs sont optionnels, combinables) :
//   power       multiplicateur de dégâts à l'ennemi (0/absent = pas d'attaque)
//   element     élément de l'attaque (réactions, résistances)
//   state       état élémentaire appliqué à l'ennemi si l'attaque touche
//   enemyDebuff { type:"slow"|"atk_debuff", amount, turns }  malus posé sur l'ennemi
//   antibuff    true -> retire UN buff positif de l'ennemi (anti-buff)
//   heroGuard   pctMax  -> restaure de la Garde au héros (jamais des PV)
//   heroMana    fraction de la réserve max -> restaure la ressource du héros
//   heroBuff    { type:"atk_buff"|"crit_buff"|"spd_buff"|"def_buff", amount, turns }
//   heroHeal    pctMaxHp -> faible soin du héros (PLAFONNÉ globalement, voir combat)
//   cleanse     true -> retire UNE altération (DoT/malus) du héros (purification)
//   soulfrag    n -> génère n Fragment(s) d'âme (soutien d'invocation)
//   cooldown    tours de recharge propres au familier (défaut 0)
//   ai          indice de priorité de base pour l'IA du familier
//
// Les VALEURS sont volontairement modérées : un familier épaule, il ne gagne pas
// le combat à la place du joueur.

export const FAM_SKILLS = {
  // --- Attaques ---
  fam_pebble_strike: { id: "fam_pebble_strike", name: "Coup de caillou", power: 0.55, ai: 1, desc: "Petite frappe physique." },
  fam_ember_bolt: { id: "fam_ember_bolt", name: "Trait de braise", power: 0.7, element: "fire", state: "burn", cooldown: 1, ai: 2, desc: "Braise de Feu qui peut embraser." },
  fam_water_jet: { id: "fam_water_jet", name: "Jet d'eau", power: 0.5, element: "water", state: "wet", ai: 2, desc: "Asperge l'ennemi (Trempé)." },
  fam_static_jolt: { id: "fam_static_jolt", name: "Décharge", power: 0.5, element: "lightning", enemyDebuff: { type: "slow", amount: 0.15, turns: 2 }, ai: 2, desc: "Foudre légère qui ralentit." },
  fam_storm_bolt: { id: "fam_storm_bolt", name: "Éclair", power: 0.85, element: "lightning", state: "charge", cooldown: 1, ai: 3, desc: "Foudre (exploite Trempé) qui charge." },
  fam_gust: { id: "fam_gust", name: "Rafale", power: 0.5, element: "wind", state: "unbalance", ai: 2, desc: "Bourrasque qui déséquilibre." },
  fam_rend: { id: "fam_rend", name: "Lacération", power: 0.6, enemyDebuff: { type: "atk_debuff", amount: 0.12, turns: 2 }, ai: 2, desc: "Entaille et affaiblit l'attaque." },
  fam_frost_bite: { id: "fam_frost_bite", name: "Morsure de givre", power: 0.6, element: "water", enemyDebuff: { type: "slow", amount: 0.25, turns: 2 }, cooldown: 1, ai: 3, desc: "Givre qui ralentit fortement." },
  fam_solar_maul: { id: "fam_solar_maul", name: "Pilon solaire", power: 1.0, element: "fire", state: "burn", cooldown: 2, ai: 4, desc: "Frappe lourde de Feu." },
  fam_chaos_burst: { id: "fam_chaos_burst", name: "Éclat de chaos", power: 1.0, element: "chaos", state: "unstable", cooldown: 2, ai: 4, desc: "Déflagration de Chaos déstabilisante." },
  fam_void_lance: { id: "fam_void_lance", name: "Lance du Vide", power: 0.95, element: "umbral", state: "soulmark", cooldown: 1, ai: 4, desc: "Lance d'Umbral qui marque." },

  // --- Marques / sabotage ---
  fam_expose_mark: { id: "fam_expose_mark", name: "Faille repérée", power: 0.3, state: "expose", cooldown: 1, ai: 3, desc: "Marque l'ennemi (expose les défenses)." },
  fam_grave_chill: { id: "fam_grave_chill", name: "Froid de la tombe", power: 0.4, element: "umbral", state: "soulmark", cooldown: 2, ai: 3, desc: "Coupe la régénération de l'ennemi (réduit ses soins)." },
  fam_weaken: { id: "fam_weaken", name: "Affaiblissement", enemyDebuff: { type: "atk_debuff", amount: 0.2, turns: 2 }, cooldown: 2, ai: 3, desc: "Réduit l'attaque ennemie." },
  fam_disrupt: { id: "fam_disrupt", name: "Dissipation", antibuff: true, power: 0.3, cooldown: 2, ai: 3, desc: "Retire un renfort positif de l'ennemi (anti-buff)." },

  // --- Soutien du héros ---
  fam_guard_mend: { id: "fam_guard_mend", name: "Consolidation", heroGuard: 0.18, cooldown: 1, ai: 2, desc: "Restaure la réserve de Garde du maître." },
  fam_mana_font: { id: "fam_mana_font", name: "Source de mana", heroMana: 0.12, cooldown: 1, ai: 2, desc: "Stabilise la ressource du maître." },
  fam_haste_song: { id: "fam_haste_song", name: "Chant rapide", heroBuff: { type: "spd_buff", amount: 0.12, turns: 2 }, cooldown: 2, ai: 2, desc: "Presse le pas du maître (Clairvoyance)." },
  fam_rally: { id: "fam_rally", name: "Ralliement", heroBuff: { type: "atk_buff", amount: 0.12, turns: 2 }, cooldown: 2, ai: 2, desc: "Galvanise l'attaque du maître." },
  fam_cleanse: { id: "fam_cleanse", name: "Purification", cleanse: true, cooldown: 2, ai: 1, desc: "Retire une altération du maître." },
  fam_mend: { id: "fam_mend", name: "Baume", heroHeal: 0.03, cooldown: 2, ai: 1, desc: "Faible soin du maître (plafonné)." },
  fam_bramble_ward: { id: "fam_bramble_ward", name: "Ronces protectrices", heroBuff: { type: "def_buff", amount: 0.2, turns: 2 }, cooldown: 2, ai: 2, desc: "Réduit le prochain gros impact subi par le maître." },
  fam_ward_aegis: { id: "fam_ward_aegis", name: "Égide", heroBuff: { type: "def_buff", amount: 0.18, turns: 2 }, cleanse: true, cooldown: 3, ai: 2, desc: "Protège des altérations et purifie." },

  // --- Soutien d'invocation ---
  fam_soul_offering: { id: "fam_soul_offering", name: "Offrande d'âme", power: 0.4, element: "umbral", soulfrag: 1, cooldown: 1, ai: 3, desc: "Génère un Fragment d'âme (renforce les invocations)." },
};

export function getFamSkill(id) {
  return FAM_SKILLS[id] || null;
}
