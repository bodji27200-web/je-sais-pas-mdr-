// Arbre de classes (Lot 15) — STRUCTURE complète à 10 rangs, construite PAR-DESSUS
// les 5 voies de base et les 15 spécialisations existantes (aucune n'est supprimée).
//
// Principe d'intégration (zéro refactor du moteur) : un « nœud » de l'arbre est une
// SPÉCIALISATION GÉNÉRALISÉE. Il fournit exactement les mêmes champs de combat que
// les spécialisations actuelles — `classId`, `statMods`, `passive`, `grants`,
// `mastery` — déjà appliqués par getDerivedStats() et buildPlayerCombatant(). On
// ajoute par-dessus des METADONNÉES d'arbre : rang, prérequis, niveau requis,
// Maîtrise requise, coût, Trait d'héritage, forces/faiblesses, armes/armures.
//
// La classe « équipée » reste `state.character.classId` (la VOIE, une des 5) +
// `state.character.specId` (le NŒUD avancé équipé, ou null = nœud de base). Les
// anciennes sauvegardes restent valides : leur specId est un nœud de l'arbre.
//
// Champs d'un nœud :
//   id        identifiant unique (= id de spé pour les 15 existantes)
//   name      nom affiché
//   path      voie de base (warrior|guardian|archer|mage|assassin) — = classId moteur
//   classId   = path (pour la validation getActiveSpec, inchangée)
//   rank      1..10
//   role      rôle de gameplay (texte)
//   tagline   accroche courte
//   desc      description
//   forces    [string]   points forts
//   faiblesses[string]   points faibles
//   levelReq  niveau de personnage requis
//   requires  [nodeId]   prérequis (sémantique OU : au moins UN débloqué suffit)
//   masteryReq{nodeId:level}  Maîtrise requise sur des nœuds (optionnel)
//   cost      coût en or du déblocage
//   statMods  modificateurs permanents (voir character.applyNodeStatMods)
//   passive   effets de combat (fusionnés dans pp — voir systems/combat.js)
//   grants    [skillId]  compétences actives ajoutées
//   mastery   { wtype, ... } bonus si l'arme de prédilection est équipée
//   addWeapons[wtype]    types d'armes supplémentaires autorisés (hybrides)
//   armors    [family]   familles d'armure conseillées (informatif)
//   heritage  traitId    Trait d'héritage débloqué à Maîtrise max
//   hybrid    bool       nœud hybride (deux voies)

import { CLASSES } from "./classes.js";
import { SPECIALIZATIONS } from "./specializations.js";

// --- 10 rangs (paliers réguliers sur 100 niveaux) ---------------------------
export const RANKS = [
  { rank: 1, stars: 1, levelReq: 1, name: "Initié" },
  { rank: 2, stars: 2, levelReq: 8, name: "Aguerri" },
  { rank: 3, stars: 3, levelReq: 16, name: "Spécialiste" },
  { rank: 4, stars: 4, levelReq: 26, name: "Vétéran" },
  { rank: 5, stars: 5, levelReq: 36, name: "Élite" },
  { rank: 6, stars: 6, levelReq: 46, name: "Maître" },
  { rank: 7, stars: 7, levelReq: 58, name: "Grand maître" },
  { rank: 8, stars: 8, levelReq: 70, name: "Champion" },
  { rank: 9, stars: 9, levelReq: 84, name: "Légende" },
  { rank: 10, stars: 10, levelReq: 100, name: "Mythe" },
];

export function rankInfo(rank) {
  return RANKS.find((r) => r.rank === rank) || RANKS[0];
}

// --- Traits d'héritage (mineurs) --------------------------------------------
// Débloqués quand un nœud atteint la Maîtrise maximale. Un SEUL trait externe
// peut être équipé à la fois (voir systems/mastery.js). Bonus volontairement
// FAIBLES : un trait ne transfère jamais la puissance de la classe source.
export const HERITAGE_TRAITS = {
  h_might: { id: "h_might", name: "Écho de force", desc: "Attaque +4 %.", statMods: { atkPct: 0.04 } },
  h_bulwark: { id: "h_bulwark", name: "Écho de rempart", desc: "Réserve de Garde +12 %.", guardMaxPct: 0.12 },
  h_mana: { id: "h_mana", name: "Écho arcanique", desc: "Mana de départ +12 % et Magie +5 %.", statMods: { magPct: 0.05 }, resource: { startPct: 0.12 } },
  h_precision: { id: "h_precision", name: "Écho de précision", desc: "Précision +8.", statMods: { accFlat: 8 } },
  h_evasion: { id: "h_evasion", name: "Écho d'ombre", desc: "Dextérité +6 % et après une esquive, petit bonus.", statMods: { dexPct: 0.06 } },
  h_ward: { id: "h_ward", name: "Écho de protection", desc: "Résistance +6 et soins reçus stables.", statMods: { resFlat: 6 } },
  h_vigor: { id: "h_vigor", name: "Écho de vigueur", desc: "PV max +5 %.", statMods: { hpPct: 0.05 } },
  h_edge: { id: "h_edge", name: "Écho tranchant", desc: "Chance critique +3 %.", statMods: { critFlat: 3 } },
  h_ember: { id: "h_ember", name: "Écho élémentaire", desc: "Léger renfort élémentaire (Magie +4 %).", statMods: { magPct: 0.04 } },
  h_swift: { id: "h_swift", name: "Écho de clairvoyance", desc: "Clairvoyance +5 %.", statMods: { spdPct: 0.05 } },
};

export function getHeritageTrait(id) {
  return HERITAGE_TRAITS[id] || null;
}

// Maîtrise : 5 paliers. Le palier max débloque le Trait d'héritage du nœud.
export const MASTERY_MAX_LEVEL = 5;
// XP (victoires) cumulée requise pour ATTEINDRE chaque palier (index = palier).
export const MASTERY_THRESHOLDS = [0, 4, 11, 21, 35, 54];

// Helper interne : fabrique un nœud avancé.
function node(o) {
  return { classId: o.path, armors: [], requires: [], grants: [], statMods: {}, ...o };
}

// Enrichit une spécialisation existante en NŒUD d'arbre (réutilise statMods/
// passive/grants/mastery tels quels — combat inchangé) + métadonnées d'arbre.
function fromSpec(specId, meta) {
  const sp = SPECIALIZATIONS[specId];
  return {
    id: sp.id, name: sp.name, path: sp.classId, classId: sp.classId,
    tagline: sp.tagline, desc: sp.desc,
    statMods: sp.statMods || {}, passive: sp.passive || {}, grants: sp.grants || [], mastery: sp.mastery || null,
    armors: [], requires: [], forces: [], faiblesses: [], cost: 0,
    ...meta,
  };
}

// --- Nœuds de base (rang 1) -------------------------------------------------
// Référencent les 5 classes de base. specId = null quand l'un d'eux est « équipé »
// (retour au profil de base). Présents pour l'affichage et le graphe de l'arbre.
const BASE_NODES = {};
for (const c of Object.values(CLASSES)) {
  BASE_NODES[c.id] = node({
    id: c.id, name: c.name, path: c.id, rank: 1, role: "Fondation",
    tagline: c.tagline, desc: c.desc,
    forces: [], faiblesses: [], levelReq: 1, requires: [], cost: 0,
    statMods: {}, passive: {}, grants: [], base: true,
    weapons: c.weapons,
  });
}

// ===========================================================================
// VOIE GUERRIER
// ===========================================================================
const WARRIOR = {
  warrior_fighter: node({
    id: "warrior_fighter", name: "Combattant", path: "warrior", rank: 2, role: "DPS physique",
    tagline: "L'art de la frappe répétée.", desc: "Apprend à enchaîner ses coups et à bâtir sa Rage plus vite.",
    forces: ["Dégâts constants", "Génération de Rage"], faiblesses: ["Pas de burst"],
    levelReq: 8, requires: ["warrior"], cost: 200,
    statMods: { atkPct: 0.06 }, passive: {}, grants: ["tw_combat_combo"], heritage: "h_might",
    mastery: { wtype: "sword", atkPct: 0.06 },
  }),
  warrior_weapon_master: node({
    id: "warrior_weapon_master", name: "Maître d'armes", path: "warrior", rank: 3, role: "DPS technique",
    tagline: "Toutes les armes lui obéissent.", desc: "Maîtrise les armes lourdes et place des coups précis et puissants.",
    forces: ["Polyvalence d'armes", "Bon crit"], faiblesses: ["Fragile sans armure"],
    levelReq: 16, requires: ["warrior_fighter"], cost: 600,
    statMods: { atkPct: 0.08, critFlat: 4 }, passive: { skillPowerPct: 0.06 }, grants: ["tw_arms_mastery"], heritage: "h_edge",
    mastery: { wtype: "greatsword", atkPct: 0.08 },
  }),
  warrior_berserker: fromSpec("warrior_berserker", {
    rank: 4, role: "DPS risque", levelReq: 26, requires: ["warrior_weapon_master"], cost: 1200,
    masteryReq: { warrior_weapon_master: 2 }, heritage: "h_might",
    forces: ["Énorme attaque à bas PV", "Pression offensive"],
    faiblesses: ["Défense sacrifiée", "Aucun vol de vie suffisant pour annuler le risque"],
  }),
  warrior_juggernaut: fromSpec("warrior_juggernaut", {
    rank: 4, role: "Bruiser", levelReq: 26, requires: ["warrior_weapon_master"], cost: 1200,
    masteryReq: { warrior_weapon_master: 2 }, heritage: "h_vigor",
    forces: ["Survie élevée", "Vol de vie"], faiblesses: ["Dégâts moyens", "Clairvoyance faible"],
  }),
  warrior_duelist: node({
    id: "warrior_duelist", name: "Duelliste", path: "warrior", rank: 4, role: "Cible unique / contre",
    tagline: "Un contre, une ouverture.", desc: "Privilégie la cible unique, les ripostes et la Précision.",
    forces: ["Contres", "Précision élevée"], faiblesses: ["Faible en multi-frappe brute"],
    levelReq: 26, requires: ["warrior_weapon_master"], cost: 1200, masteryReq: { warrior_weapon_master: 2 },
    statMods: { atkPct: 0.06, accFlat: 10, dexPct: 0.05 }, passive: { vsDebuff: { bonus: 0.18 } },
    grants: ["tw_duelist_riposte"], heritage: "h_precision", mastery: { wtype: "sword", critFlat: 6 },
  }),
  warrior_guardbreaker: node({
    id: "warrior_guardbreaker", name: "Brise-garde", path: "warrior", rank: 5, role: "Anti-Garde",
    tagline: "Aucune garde ne tient.", desc: "Spécialisé dans la destruction des réserves de Garde et des boucliers.",
    forces: ["Détruit la Garde", "Expose les défenses"], faiblesses: ["Moins efficace sans cible défensive"],
    levelReq: 36, requires: ["warrior_berserker", "warrior_juggernaut", "warrior_duelist"], cost: 2000,
    masteryReq: { warrior_weapon_master: 3 },
    statMods: { atkPct: 0.08 }, passive: { vsDebuff: { bonus: 0.2 } }, grants: ["tw_guardbreak"], heritage: "h_might",
    mastery: { wtype: "mace", atkPct: 0.1 },
  }),
  warrior_warlord: fromSpec("warrior_warlord", {
    rank: 6, role: "DPS commandant", levelReq: 46, requires: ["warrior_guardbreaker"], cost: 3200,
    masteryReq: { warrior_guardbreaker: 2 }, heritage: "h_might",
    forces: ["Amplifie ses compétences", "Polyvalent"], faiblesses: ["Pas de spécialité extrême"],
  }),
  warrior_blood_reaver: node({
    id: "warrior_blood_reaver", name: "Ravageur sanguin", path: "warrior", rank: 7, role: "DPS bas-PV",
    tagline: "Le sang appelle le sang.", desc: "Puissance décuplée à bas PV, sans vol de vie suffisant pour annuler le risque.",
    forces: ["Burst à bas PV", "Crit élevé"], faiblesses: ["Très risqué", "Survie minimale"],
    levelReq: 58, requires: ["warrior_warlord"], cost: 4800, masteryReq: { warrior_warlord: 3 },
    statMods: { atkPct: 0.12, defPct: -0.06, critFlat: 5 }, passive: { lowHpAtk: { threshold: 0.5, bonus: 0.45 }, lifestealPct: 0.06 },
    grants: ["tw_blood_rampage"], heritage: "h_edge", mastery: { wtype: "greatsword", atkPct: 0.12 },
  }),
  warrior_rune_blade: node({
    id: "warrior_rune_blade", name: "Lame runique", path: "warrior", rank: 7, role: "Hybride Guerrier–Mage",
    tagline: "L'acier qui chante l'arcane.", desc: "Mêle frappe physique et runes élémentaires. Hybride : moins de PV qu'un pur guerrier.",
    forces: ["Dégâts mixtes", "Brûlure"], faiblesses: ["Mana limité", "Ni meilleur DPS ni meilleur tank"],
    levelReq: 58, requires: ["warrior_warlord"], cost: 4800, masteryReq: { mage: 2, warrior_warlord: 2 },
    hybrid: true, addWeapons: ["wand"],
    statMods: { atkPct: 0.06, magPct: 0.12, hpPct: -0.05 }, passive: { skillPowerPct: 0.1 },
    grants: ["tw_runeblade_arc"], heritage: "h_ember", mastery: { wtype: "sword", atkPct: 0.08 },
  }),
  warrior_steel_scourge: node({
    id: "warrior_steel_scourge", name: "Fléau d'acier", path: "warrior", rank: 8, role: "DPS brise-armure",
    tagline: "Il fend l'acier comme du bois.", desc: "Brise les armures et expose durablement les défenses ennemies.",
    forces: ["Réduction d'armure", "Dégâts soutenus"], faiblesses: ["Mise en place nécessaire"],
    levelReq: 70, requires: ["warrior_blood_reaver", "warrior_rune_blade"], cost: 6400,
    masteryReq: { warrior_warlord: 3 },
    statMods: { atkPct: 0.1, critFlat: 4 }, passive: { vsDebuff: { bonus: 0.25 } }, grants: ["tw_steel_sunder"], heritage: "h_might",
    mastery: { wtype: "greatsword", atkPct: 0.1 },
  }),
  warrior_war_avatar: node({
    id: "warrior_war_avatar", name: "Avatar de guerre", path: "warrior", rank: 9, role: "DPS déchaînement",
    tagline: "La guerre incarnée.", desc: "Déchaîne des rafales de frappes ininterrompues.",
    forces: ["Multi-frappes massives", "Pression continue"], faiblesses: ["Coûteux en Rage"],
    levelReq: 84, requires: ["warrior_steel_scourge"], cost: 9000, masteryReq: { warrior_steel_scourge: 3 },
    statMods: { atkPct: 0.12, critFlat: 4, critDmgFlat: 15 }, passive: { skillPowerPct: 0.1 }, grants: ["tw_war_avatar_storm"], heritage: "h_edge",
    mastery: { wtype: "greatsword", atkPct: 0.12 },
  }),
  warrior_carnage_sovereign: node({
    id: "warrior_carnage_sovereign", name: "Souverain du carnage", path: "warrior", rank: 10, role: "Capstone DPS",
    tagline: "Le trône bâti sur les ruines.", desc: "L'apogée de la voie Guerrier : un burst capable de briser n'importe quelle ligne.",
    forces: ["Burst ultime", "Exécution"], faiblesses: ["Survie toujours secondaire"],
    levelReq: 100, requires: ["warrior_war_avatar"], cost: 14000, masteryReq: { warrior_war_avatar: 4 },
    statMods: { atkPct: 0.18, critFlat: 6, critDmgFlat: 25 }, passive: { execute: { threshold: 0.35, bonus: 0.4 }, lowHpAtk: { threshold: 0.4, bonus: 0.3 } },
    grants: ["tw_carnage_reap"], heritage: "h_might", mastery: { wtype: "greatsword", atkPct: 0.14 },
  }),
};

// ===========================================================================
// VOIE GARDIEN
// ===========================================================================
const GUARDIAN = {
  guardian_sentinel: fromSpec("guardian_sentinel", {
    rank: 2, role: "Contrôleur défensif", levelReq: 8, requires: ["guardian"], cost: 200,
    heritage: "h_bulwark", forces: ["Contrôle", "Punition des affaiblis"], faiblesses: ["Dégâts modérés"],
  }),
  guardian_rampart_knight: node({
    id: "guardian_rampart_knight", name: "Chevalier du rempart", path: "guardian", rank: 3, role: "Tank",
    tagline: "La première ligne.", desc: "Renforce ses boucliers et bouscule l'ennemi pour le maintenir à distance.",
    forces: ["Boucliers", "Soutien défensif"], faiblesses: ["Lent"],
    levelReq: 16, requires: ["guardian_sentinel"], cost: 600,
    statMods: { defPct: 0.12, hpPct: 0.06 }, passive: {}, grants: ["tg_rampart_aegis", "tg_rampart_smash"], heritage: "h_bulwark",
    mastery: { wtype: "shield", defPct: 0.1 },
  }),
  guardian_bulwark: fromSpec("guardian_bulwark", {
    rank: 4, role: "Mur (Bastion)", levelReq: 26, requires: ["guardian_rampart_knight"], cost: 1200,
    masteryReq: { guardian_rampart_knight: 2 }, heritage: "h_bulwark",
    forces: ["Absorption extrême", "Régénération"], faiblesses: ["Clairvoyance faible", "Dégâts faibles"],
    statMods: { defPct: 0.2, hpPct: 0.1, spdPct: -0.08 }, // Bastion : forte absorption, Clairvoyance faible
    grants: ["fortress", "tg_bastion_wall"],
  }),
  guardian_rune_paladin: node({
    id: "guardian_rune_paladin", name: "Paladin runique", path: "guardian", rank: 4, role: "Hybride Gardien–Mage",
    tagline: "Le bouclier et la lumière.", desc: "Utilise Lumière, Garde et soins limités. Hybride : ni pur tank ni pur soigneur.",
    forces: ["Soins limités", "Dégâts de Lumière"], faiblesses: ["Mana restreint", "Soins plafonnés"],
    levelReq: 26, requires: ["guardian_rampart_knight"], cost: 1200, masteryReq: { mage: 2, guardian_rampart_knight: 2 },
    hybrid: true, addWeapons: ["wand"],
    statMods: { defPct: 0.1, magPct: 0.1, resPct: 0.05 }, passive: { hpRegenPct: 0.025 }, grants: ["tg_rune_paladin_smite"], heritage: "h_mana",
    mastery: { wtype: "mace", atkPct: 0.08 },
  }),
  guardian_templar: fromSpec("guardian_templar", {
    rank: 6, role: "Tank offensif", levelReq: 46, requires: ["guardian_royal_protector"], cost: 3200,
    masteryReq: { guardian_royal_protector: 2 }, heritage: "h_might",
    forces: ["Vol de vie", "Riposte"], faiblesses: ["Moins de pure absorption"],
  }),
  guardian_royal_protector: node({
    id: "guardian_royal_protector", name: "Protecteur royal", path: "guardian", rank: 5, role: "Tank-soutien",
    tagline: "Le garant de la couronne.", desc: "Restaure et entretient sa Garde, protégeant la ligne durablement.",
    forces: ["Restauration de Garde", "Endurance"], faiblesses: ["Offense limitée"],
    levelReq: 36, requires: ["guardian_bulwark", "guardian_rune_paladin"], cost: 2000,
    masteryReq: { guardian_rampart_knight: 3 },
    statMods: { defPct: 0.16, hpPct: 0.08 }, passive: { hpRegenPct: 0.02 }, grants: ["tg_royal_protector"], heritage: "h_bulwark",
    mastery: { wtype: "shield", defPct: 0.12 },
  }),
  guardian_steel_colossus: node({
    id: "guardian_steel_colossus", name: "Colosse d'acier", path: "guardian", rank: 6, role: "Tank lourd",
    tagline: "Une montagne en marche.", desc: "Écrase et ralentit, immense réserve de PV et de Garde.",
    forces: ["PV colossaux", "Contrôle"], faiblesses: ["Très lent"],
    levelReq: 46, requires: ["guardian_royal_protector"], cost: 3200, masteryReq: { guardian_royal_protector: 2 },
    statMods: { defPct: 0.18, hpPct: 0.14, spdPct: -0.06 }, passive: {}, grants: ["tg_steel_colossus_quake"], heritage: "h_vigor",
    mastery: { wtype: "mace", atkPct: 0.08 },
  }),
  guardian_sacred_aegis: node({
    id: "guardian_sacred_aegis", name: "Égide sacrée", path: "guardian", rank: 7, role: "Tank-soigneur",
    tagline: "La lumière protège.", desc: "Combine boucliers, Garde et soins limités pour tenir tout siège.",
    forces: ["Soins + boucliers", "Survie extrême"], faiblesses: ["Dégâts faibles", "Soins plafonnés"],
    levelReq: 58, requires: ["guardian_steel_colossus"], cost: 4800, masteryReq: { guardian_royal_protector: 3 },
    statMods: { defPct: 0.16, resPct: 0.1, hpPct: 0.08 }, passive: { hpRegenPct: 0.025 }, grants: ["tg_sacred_aegis"], heritage: "h_ward",
    mastery: { wtype: "shield", defPct: 0.12 },
  }),
  guardian_living_fortress: node({
    id: "guardian_living_fortress", name: "Forteresse vivante", path: "guardian", rank: 7, role: "Tank offensif (conversion)",
    tagline: "La défense devient lame.", desc: "Convertit une part RÉELLE de sa Garde en dégâts : le mur qui frappe.",
    forces: ["Conversion Garde→dégâts", "Solidité"], faiblesses: ["Dépend de la réserve de Garde"],
    levelReq: 58, requires: ["guardian_steel_colossus"], cost: 4800, masteryReq: { guardian_royal_protector: 3 },
    statMods: { defPct: 0.16, atkPct: 0.06, hpPct: 0.06 }, passive: {}, grants: ["tg_living_fortress_convert"], heritage: "h_bulwark",
    mastery: { wtype: "mace", atkPct: 0.1 },
  }),
  guardian_rampart_titan: node({
    id: "guardian_rampart_titan", name: "Titan du rempart", path: "guardian", rank: 8, role: "Tank ultime",
    tagline: "L'inébranlable.", desc: "Garde quasi inviolable sur la durée.",
    forces: ["Absorption maximale", "Restauration"], faiblesses: ["Offense très faible"],
    levelReq: 70, requires: ["guardian_sacred_aegis", "guardian_living_fortress"], cost: 6400,
    masteryReq: { guardian_royal_protector: 3 },
    statMods: { defPct: 0.22, hpPct: 0.12, spdPct: -0.05 }, passive: { hpRegenPct: 0.02 }, grants: ["tg_titan_bulwark"], heritage: "h_bulwark",
    mastery: { wtype: "shield", defPct: 0.14 },
  }),
  guardian_primordial: node({
    id: "guardian_primordial", name: "Gardien primordial", path: "guardian", rank: 9, role: "Tank-bruiser",
    tagline: "Né avant les murs.", desc: "Restaure sa Garde en frappant et en convertit une part en force.",
    forces: ["Auto-suffisant", "Hybride def/off"], faiblesses: ["Ni meilleur tank ni meilleur DPS"],
    levelReq: 84, requires: ["guardian_rampart_titan"], cost: 9000, masteryReq: { guardian_rampart_titan: 3 },
    statMods: { defPct: 0.18, atkPct: 0.08, hpPct: 0.1 }, passive: { hpRegenPct: 0.02 }, grants: ["tg_primordial_guard"], heritage: "h_bulwark",
    mastery: { wtype: "mace", atkPct: 0.1 },
  }),
  guardian_bastion_king: node({
    id: "guardian_bastion_king", name: "Roi-bastion", path: "guardian", rank: 10, role: "Capstone tank",
    tagline: "Le royaume tient sur ses épaules.", desc: "L'apogée du Gardien : un mur capable de renverser le siège en convertissant sa Garde.",
    forces: ["Conversion massive", "Survie + pression"], faiblesses: ["Toujours pas un assassin"],
    levelReq: 100, requires: ["guardian_primordial"], cost: 14000, masteryReq: { guardian_primordial: 4 },
    statMods: { defPct: 0.22, atkPct: 0.1, hpPct: 0.12 }, passive: { hpRegenPct: 0.02 }, grants: ["tg_bastion_king_decree"], heritage: "h_bulwark",
    mastery: { wtype: "shield", defPct: 0.14 },
  }),
};

// ===========================================================================
// VOIE ARCHER
// ===========================================================================
const ARCHER = {
  archer_scout: node({
    id: "archer_scout", name: "Éclaireur", path: "archer", rank: 2, role: "Marqueur",
    tagline: "Rien ne lui échappe.", desc: "Repère et marque ses cibles (expose) pour préparer les tirs lourds.",
    forces: ["Marques", "Précision"], faiblesses: ["Dégâts directs modestes"],
    levelReq: 8, requires: ["archer"], cost: 200,
    statMods: { accFlat: 10, critFlat: 3 }, passive: {}, grants: ["ta_scout_mark"], heritage: "h_precision",
    mastery: { wtype: "bow", critFlat: 4 },
  }),
  archer_marksman: fromSpec("archer_marksman", {
    rank: 3, role: "Tireur d'élite", levelReq: 16, requires: ["archer_scout"], cost: 600,
    heritage: "h_edge", forces: ["Critiques massifs", "Exécution"], faiblesses: ["Recharges longues"],
  }),
  archer_trapper: fromSpec("archer_trapper", {
    rank: 4, role: "Traqueur (poison/marques)", levelReq: 26, requires: ["archer_marksman"], cost: 1200,
    masteryReq: { archer_marksman: 2 }, heritage: "h_precision",
    forces: ["Applique et consomme des Marques", "Poison"], faiblesses: ["Build de mise en place"],
  }),
  archer_beastmaster: node({
    id: "archer_beastmaster", name: "Maître-bêtes", path: "archer", rank: 4, role: "Archer + familier",
    tagline: "Deux chasseurs valent mieux qu'un.", desc: "Renforce son familier au prix de dégâts personnels un peu plus faibles.",
    forces: ["Familier renforcé", "Synergie"], faiblesses: ["Dégâts personnels réduits"],
    levelReq: 26, requires: ["archer_marksman"], cost: 1200, masteryReq: { archer_marksman: 2 },
    statMods: { atkPct: -0.05, accFlat: 8 }, passive: {}, grants: ["ta_beastmaster_call"], heritage: "h_precision",
    familiarBoost: { atkPct: 0.25, starBonus: 1 }, mastery: { wtype: "bow", critFlat: 4 },
  }),
  archer_rune_hunter: node({
    id: "archer_rune_hunter", name: "Chasseur runique", path: "archer", rank: 5, role: "Archer élémentaire",
    tagline: "Des flèches qui chantent l'orage.", desc: "Utilise des flèches élémentaires (Foudre, Charge) et exploite les réactions.",
    forces: ["Flèches élémentaires", "Charge"], faiblesses: ["Dépend des réactions"],
    levelReq: 36, requires: ["archer_trapper", "archer_beastmaster"], cost: 2000, masteryReq: { archer_marksman: 3 },
    statMods: { magPct: 0.1, accFlat: 8 }, passive: { skillPowerPct: 0.08 }, grants: ["ta_rune_hunter_shot"], heritage: "h_ember",
    mastery: { wtype: "bow", critFlat: 5 },
  }),
  archer_ranger: fromSpec("archer_ranger", {
    rank: 6, role: "Œil-tempête (rafales)", levelReq: 46, requires: ["archer_rune_hunter"], cost: 3200,
    masteryReq: { archer_rune_hunter: 2 }, heritage: "h_swift",
    forces: ["Rafales de flèches", "Clairvoyance"], faiblesses: ["Faible par flèche"],
    grants: ["arrow_volley", "ta_stormeye_volley"],
  }),
  archer_falconer: node({
    id: "archer_falconer", name: "Fauconnier", path: "archer", rank: 7, role: "Tacticien familier",
    tagline: "Le ciel est son arme.", desc: "Fait du familier un partenaire tactique (contrôle, ralentissement).",
    forces: ["Contrôle via familier", "Polyvalence"], faiblesses: ["Dégâts bruts moyens"],
    levelReq: 58, requires: ["archer_ranger"], cost: 4800, masteryReq: { archer_rune_hunter: 3 },
    statMods: { accFlat: 10, dexPct: 0.05 }, passive: {}, grants: ["ta_falconer_dive"], heritage: "h_precision",
    familiarBoost: { atkPct: 0.15, starBonus: 1 }, mastery: { wtype: "bow", critFlat: 5 },
  }),
  archer_spectral_arbalist: node({
    id: "archer_spectral_arbalist", name: "Arbalétrier spectral", path: "archer", rank: 7, role: "Anti-Garde à distance",
    tagline: "Aucun bouclier ne le ralentit.", desc: "Inflige de lourds dégâts à la Garde et expose les défenses.",
    forces: ["Lourds dégâts de Garde", "Perce les boucliers"], faiblesses: ["Cadence plus lente"],
    levelReq: 58, requires: ["archer_ranger"], cost: 4800, masteryReq: { archer_rune_hunter: 3 },
    statMods: { atkPct: 0.1, accFlat: 8 }, passive: { vsDebuff: { bonus: 0.2 } }, grants: ["ta_spectral_bolt"], heritage: "h_might",
    mastery: { wtype: "crossbow", atkPct: 0.12 },
  }),
  archer_celestial_predator: node({
    id: "archer_celestial_predator", name: "Prédateur céleste", path: "archer", rank: 8, role: "DPS crit",
    tagline: "La foudre des cieux.", desc: "Critiques foudroyants sur cibles repérées.",
    forces: ["Crit extrême", "Burst"], faiblesses: ["Dépend des Marques"],
    levelReq: 70, requires: ["archer_falconer", "archer_spectral_arbalist"], cost: 6400, masteryReq: { archer_rune_hunter: 3 },
    statMods: { critFlat: 6, critDmgFlat: 20, accFlat: 6 }, passive: { execute: { threshold: 0.35, bonus: 0.35 } }, grants: ["ta_celestial_shot"], heritage: "h_edge",
    mastery: { wtype: "longbow", atkPct: 0.12 },
  }),
  archer_hunt_lord: node({
    id: "archer_hunt_lord", name: "Seigneur de la chasse", path: "archer", rank: 9, role: "DPS soutenu",
    tagline: "La traque sans fin.", desc: "Déluges de flèches et marques en chaîne.",
    forces: ["Pression continue", "Multi-cibles conceptuel"], faiblesses: ["Coûteux en Concentration"],
    levelReq: 84, requires: ["archer_celestial_predator"], cost: 9000, masteryReq: { archer_celestial_predator: 3 },
    statMods: { atkPct: 0.1, critFlat: 4, accFlat: 8 }, passive: { skillPowerPct: 0.1 }, grants: ["ta_hunt_lord_rain"], heritage: "h_swift",
    mastery: { wtype: "longbow", atkPct: 0.12 },
  }),
  archer_world_eye: node({
    id: "archer_world_eye", name: "Œil du monde", path: "archer", rank: 10, role: "Capstone précision",
    tagline: "Il voit la faille avant qu'elle existe.", desc: "L'apogée de l'Archer : un tir qui ne manque jamais sa faille.",
    forces: ["Tir absolu", "Exécution + exposition"], faiblesses: ["Fragile au corps-à-corps"],
    levelReq: 100, requires: ["archer_hunt_lord"], cost: 14000, masteryReq: { archer_hunt_lord: 4 },
    statMods: { critFlat: 8, critDmgFlat: 25, accFlat: 14 }, passive: { execute: { threshold: 0.4, bonus: 0.4 } }, grants: ["ta_world_eye_pierce"], heritage: "h_precision",
    mastery: { wtype: "longbow", atkPct: 0.14 },
  }),
};

// ===========================================================================
// VOIE MAGE
// ===========================================================================
const MAGE = {
  mage_arcanist: fromSpec("mage_arcanist", {
    rank: 2, role: "Mage de survie", levelReq: 8, requires: ["mage"], cost: 200,
    heritage: "h_mana", forces: ["Boucliers", "Régénération"], faiblesses: ["Dégâts moindres"],
  }),
  mage_rune_sorcerer: node({
    id: "mage_rune_sorcerer", name: "Sorcier runique", path: "mage", rank: 3, role: "Sorts directs / altérations",
    tagline: "Le verbe qui défait.", desc: "Privilégie les sorts directs et les altérations (Marque, malus).",
    forces: ["Altérations", "Sorts directs"], faiblesses: ["Très fragile"],
    levelReq: 16, requires: ["mage_arcanist"], cost: 600,
    statMods: { magPct: 0.12 }, passive: { skillPowerPct: 0.1 }, grants: ["tm_rune_sorcerer_hex"], heritage: "h_mana",
    mastery: { wtype: "staff", atkPct: 0.08 },
  }),
  mage_pyromancer: fromSpec("mage_pyromancer", {
    rank: 4, role: "Élémentaliste (Feu)", levelReq: 26, requires: ["mage_rune_sorcerer"], cost: 1200,
    masteryReq: { mage_rune_sorcerer: 2 }, heritage: "h_ember",
    forces: ["Brûlures dévastatrices", "Burst"], faiblesses: ["Fragilité physique"],
  }),
  mage_frost: fromSpec("mage_frost", {
    rank: 4, role: "Élémentaliste (Givre)", levelReq: 26, requires: ["mage_rune_sorcerer"], cost: 1200,
    masteryReq: { mage_rune_sorcerer: 2 }, heritage: "h_ember",
    forces: ["Contrôle", "Vulnérabilité Foudre"], faiblesses: ["Dégâts directs moyens"],
  }),
  mage_summoner: node({
    id: "mage_summoner", name: "Invocateur", path: "mage", rank: 4, role: "Invocateur",
    tagline: "Il n'est jamais seul.", desc: "Invoque de vraies créatures temporaires sur le terrain (nombre strictement limité). Moins de stats offensives propres, un peu plus de PV.",
    forces: ["Créatures invoquées", "Plus de PV qu'un mage pur"], faiblesses: ["Attaque personnelle réduite", "Limite d'invocations"],
    levelReq: 26, requires: ["mage_rune_sorcerer"], cost: 1200, masteryReq: { mage_rune_sorcerer: 2 },
    statMods: { atkPct: -0.12, magPct: -0.05, hpPct: 0.12 }, passive: {}, grants: ["summon_arcane_wisp", "tm_elementalist_bolt"], heritage: "h_mana",
    summoner: { ids: ["sm_arcane_wisp"], max: 1 }, mastery: { wtype: "staff", atkPct: 0.06 },
  }),
  mage_weaver: node({
    id: "mage_weaver", name: "Tisseur des éléments", path: "mage", rank: 5, role: "Réactions élémentaires",
    tagline: "Chaque élément en appelle un autre.", desc: "Crée des réactions élémentaires (Trempé→Foudre…) pour amplifier les dégâts.",
    forces: ["Réactions", "Polyvalence élémentaire"], faiblesses: ["Demande de la mise en place"],
    levelReq: 36, requires: ["mage_pyromancer", "mage_frost", "mage_summoner"], cost: 2000, masteryReq: { mage_rune_sorcerer: 3 },
    statMods: { magPct: 0.14 }, passive: { skillPowerPct: 0.1 }, grants: ["tm_weaver_reaction"], heritage: "h_ember",
    mastery: { wtype: "orb", critFlat: 5 },
  }),
  mage_spellblade: node({
    id: "mage_spellblade", name: "Mage-lame", path: "mage", rank: 6, role: "Hybride Mage–Guerrier",
    tagline: "La magie au fil de la lame.", desc: "Mêle sorts et corps-à-corps. Hybride : plus résistant qu'un mage pur, moins puissant en sorts.",
    forces: ["Survie améliorée", "Dégâts mixtes"], faiblesses: ["Sorts moins puissants", "Mana limité"],
    levelReq: 46, requires: ["mage_weaver"], cost: 3200, masteryReq: { mage_weaver: 2, warrior: 2 },
    hybrid: true, addWeapons: ["sword"],
    statMods: { magPct: 0.08, atkPct: 0.1, hpPct: 0.12, defPct: 0.1 }, passive: { lifestealPct: 0.06 }, grants: ["tm_spellblade_slash"], heritage: "h_vigor",
    mastery: { wtype: "sword", atkPct: 0.08 },
  }),
  mage_archon: node({
    id: "mage_archon", name: "Archonte élémentaire", path: "mage", rank: 7, role: "Maître des éléments",
    tagline: "Il commande aux éléments.", desc: "Change intelligemment d'élément pour exploiter chaque faiblesse.",
    forces: ["Adaptabilité élémentaire", "Réactions Foudre"], faiblesses: ["Gestion de Mana exigeante"],
    levelReq: 58, requires: ["mage_spellblade"], cost: 4800, masteryReq: { mage_weaver: 3 },
    statMods: { magPct: 0.18 }, passive: { skillPowerPct: 0.12 }, grants: ["tm_archon_shift", "tm_weaver_reaction"], heritage: "h_ember",
    mastery: { wtype: "orb", critFlat: 6 },
  }),
  mage_pactmaster: node({
    id: "mage_pactmaster", name: "Maître des pactes", path: "mage", rank: 7, role: "Invocateur sacrificiel",
    tagline: "Tout pacte a son prix.", desc: "Renforce et sacrifie ses invocations pour des bonus de puissance.",
    forces: ["Invocations renforcées", "Burst sacrificiel"], faiblesses: ["Dépend des invocations"],
    levelReq: 58, requires: ["mage_spellblade"], cost: 4800, masteryReq: { mage_weaver: 3 },
    statMods: { magPct: 0.12, hpPct: 0.08 }, passive: { skillPowerPct: 0.1 }, grants: ["summon_bone_thrall", "tm_pactmaster_sacrifice"], heritage: "h_mana",
    summoner: { ids: ["sm_bone_thrall"], max: 2 }, mastery: { wtype: "staff", atkPct: 0.08 },
  }),
  mage_apostate: node({
    id: "mage_apostate", name: "Apostat arcanique", path: "mage", rank: 8, role: "DPS à faible Mana",
    tagline: "Plus la coupe est vide, plus la soif brûle.", desc: "Devient plus puissant à faible Mana — mais ce bonus crée un vrai risque (sorts indisponibles).",
    forces: ["Énorme puissance à bas Mana", "Burst"], faiblesses: ["Risque de panne de Mana", "Très fragile"],
    levelReq: 70, requires: ["mage_archon", "mage_pactmaster"], cost: 6400, masteryReq: { mage_weaver: 3 },
    statMods: { magPct: 0.2, hpPct: -0.05 }, passive: { lowResourceAtk: { threshold: 0.4, bonus: 0.5 } }, grants: ["tm_apostate_surge"], heritage: "h_mana",
    resource: { maxPct: -0.15 }, mastery: { wtype: "orb", critFlat: 6 },
  }),
  mage_arcane_sovereign: node({
    id: "mage_arcane_sovereign", name: "Souverain des arcanes", path: "mage", rank: 9, role: "Capstone nuke",
    tagline: "L'arcane lui obéit.", desc: "Sorts cataclysmiques qui déstabilisent toute défense.",
    forces: ["Nuke ultime", "Instabilité"], faiblesses: ["Coûteux en Mana"],
    levelReq: 84, requires: ["mage_apostate"], cost: 9000, masteryReq: { mage_apostate: 3 },
    statMods: { magPct: 0.24 }, passive: { skillPowerPct: 0.14 }, grants: ["tm_arcane_sovereign_nova"], heritage: "h_mana",
    mastery: { wtype: "orb", critFlat: 7 },
  }),
  mage_void_oracle: node({
    id: "mage_void_oracle", name: "Oracle du Néant", path: "mage", rank: 10, role: "Capstone Umbral",
    tagline: "Il lit la fin de toute chose.", desc: "L'apogée du Mage : un gouffre d'Umbral qui marque et anéantit.",
    forces: ["Dégâts d'Umbral massifs", "Coupe la régénération"], faiblesses: ["Coquille de verre"],
    levelReq: 100, requires: ["mage_arcane_sovereign"], cost: 14000, masteryReq: { mage_arcane_sovereign: 4 },
    statMods: { magPct: 0.26, critFlat: 4 }, passive: { skillPowerPct: 0.14, execute: { threshold: 0.35, bonus: 0.4 } }, grants: ["tm_void_oracle_collapse"], heritage: "h_mana",
    mastery: { wtype: "orb", critFlat: 7 },
  }),
};

// ===========================================================================
// VOIE ASSASSIN
// ===========================================================================
const ASSASSIN = {
  assassin_rogue: node({
    id: "assassin_rogue", name: "Roublard", path: "assassin", rank: 2, role: "DPS furtif",
    tagline: "Vite et de biais.", desc: "Apprend les coups sournois et les frappes critiques d'ouverture.",
    forces: ["Crit d'ouverture", "Mobilité"], faiblesses: ["Très fragile"],
    levelReq: 8, requires: ["assassin"], cost: 200,
    statMods: { critFlat: 4, dexPct: 0.05 }, passive: {}, grants: ["ts_rogue_backstab"], heritage: "h_edge",
    mastery: { wtype: "dagger", atkPct: 0.06 },
  }),
  assassin_shadowblade: fromSpec("assassin_shadowblade", {
    rank: 3, role: "Ombrelame", levelReq: 16, requires: ["assassin_rogue"], cost: 600,
    heritage: "h_edge", forces: ["Critiques foudroyants", "Exécution"], faiblesses: ["Survie faible"],
    grants: ["assassinate", "ts_shadowblade_flurry"],
  }),
  assassin_venom: fromSpec("assassin_venom", {
    rank: 4, role: "Venimeux", levelReq: 26, requires: ["assassin_shadowblade"], cost: 1200,
    masteryReq: { assassin_shadowblade: 2 }, heritage: "h_evasion",
    forces: ["Plusieurs poisons faibles", "Bonus sur cible affaiblie"], faiblesses: ["Dégâts différés"],
    grants: ["toxic_strike", "ts_venom_multi"],
  }),
  assassin_duelist: fromSpec("assassin_duelist", {
    rank: 4, role: "Duelliste nocturne", levelReq: 26, requires: ["assassin_shadowblade"], cost: 1200,
    masteryReq: { assassin_shadowblade: 2 }, heritage: "h_evasion",
    forces: ["Contres", "Clairvoyance extrême"], faiblesses: ["Build de timing"],
    grants: ["flurry", "ts_night_duelist"],
  }),
  assassin_saboteur: node({
    id: "assassin_saboteur", name: "Saboteur", path: "assassin", rank: 5, role: "Anti-défense",
    tagline: "Il défait avant de frapper.", desc: "Attaque la Garde et réduit temporairement Défense ou Résistance (expose).",
    forces: ["Réduction de défense/résist", "Anti-Garde"], faiblesses: ["Dégâts bruts moyens"],
    levelReq: 36, requires: ["assassin_venom", "assassin_duelist"], cost: 2000, masteryReq: { assassin_shadowblade: 3 },
    statMods: { atkPct: 0.08, accFlat: 8 }, passive: { vsDebuff: { bonus: 0.22 } }, grants: ["ts_saboteur_cut"], heritage: "h_precision",
    mastery: { wtype: "short_blade", atkPct: 0.1 },
  }),
  assassin_veilwalker: node({
    id: "assassin_veilwalker", name: "Passe-voile", path: "assassin", rank: 6, role: "Esquive / mobilité",
    tagline: "Entre deux ombres.", desc: "Esquive accrue et frappes insaisissables, sans jamais dépasser le plafond global d'esquive.",
    forces: ["Esquive élevée", "Clairvoyance"], faiblesses: ["Fond comme neige sous la pression"],
    levelReq: 46, requires: ["assassin_saboteur"], cost: 3200, masteryReq: { assassin_saboteur: 2 },
    statMods: { dexPct: 0.12, spdPct: 0.08, critFlat: 3 }, passive: {}, grants: ["ts_void_dancer_step"], heritage: "h_evasion",
    mastery: { wtype: "dual_daggers", critFlat: 5 },
  }),
  assassin_soul_reaper: node({
    id: "assassin_soul_reaper", name: "Moissonneur d'âmes", path: "assassin", rank: 7, role: "Exécuteur Umbral",
    tagline: "Il récolte les fins.", desc: "Marque les âmes (Umbral) et exécute les cibles affaiblies.",
    forces: ["Exécution", "Coupe la régénération"], faiblesses: ["Fragile", "Mise en place de Marque"],
    levelReq: 58, requires: ["assassin_veilwalker"], cost: 4800, masteryReq: { assassin_saboteur: 3 },
    statMods: { critFlat: 5, critDmgFlat: 15, atkPct: 0.06 }, passive: { execute: { threshold: 0.45, bonus: 0.5 } }, grants: ["ts_soul_reaper"], heritage: "h_edge",
    mastery: { wtype: "short_blade", atkPct: 0.1 },
  }),
  assassin_void_dancer: node({
    id: "assassin_void_dancer", name: "Danseur du vide", path: "assassin", rank: 7, role: "Esquive offensive",
    tagline: "La danse qui tue.", desc: "Gagne temporairement de l'esquive (sans dépasser le plafond global) tout en frappant vite.",
    forces: ["Esquive temporaire", "Vitesse d'action"], faiblesses: ["Pas un tank, jamais"],
    levelReq: 58, requires: ["assassin_veilwalker"], cost: 4800, masteryReq: { assassin_saboteur: 3 },
    statMods: { dexPct: 0.14, spdPct: 0.1, critFlat: 4 }, passive: { lifestealPct: 0.06 }, grants: ["ts_void_dancer_step", "flurry"], heritage: "h_evasion",
    mastery: { wtype: "dual_daggers", critFlat: 6 },
  }),
  assassin_spectral_stalker: node({
    id: "assassin_spectral_stalker", name: "Traqueur spectral", path: "assassin", rank: 8, role: "DPS embuscade",
    tagline: "L'ombre qui suit l'ombre.", desc: "Embuscades critiques sur cibles marquées.",
    forces: ["Burst crit", "Furtivité"], faiblesses: ["Survie minimale"],
    levelReq: 70, requires: ["assassin_soul_reaper", "assassin_void_dancer"], cost: 6400, masteryReq: { assassin_saboteur: 3 },
    statMods: { critFlat: 6, critDmgFlat: 20, dexPct: 0.06 }, passive: { vsDebuff: { bonus: 0.2 } }, grants: ["ts_spectral_stalker"], heritage: "h_edge",
    mastery: { wtype: "dagger", atkPct: 0.12 },
  }),
  assassin_nightwalker: node({
    id: "assassin_nightwalker", name: "Marche-nuit", path: "assassin", rank: 9, role: "DPS bas-PV",
    tagline: "Plus la nuit est noire…", desc: "Gagne en puissance à faibles PV, sans jamais devenir immortel.",
    forces: ["Puissance à bas PV", "Esquive"], faiblesses: ["Risque permanent", "Aucune immortalité"],
    levelReq: 84, requires: ["assassin_spectral_stalker"], cost: 9000, masteryReq: { assassin_spectral_stalker: 3 },
    statMods: { critFlat: 5, dexPct: 0.08, atkPct: 0.08 }, passive: { lowHpAtk: { threshold: 0.5, bonus: 0.4 } }, grants: ["ts_nightwalker_rampage"], heritage: "h_evasion",
    mastery: { wtype: "dual_daggers", critFlat: 6 },
  }),
  assassin_threshold_lord: node({
    id: "assassin_threshold_lord", name: "Seigneur du seuil", path: "assassin", rank: 10, role: "Capstone exécution",
    tagline: "Entre la vie et la mort, il choisit.", desc: "L'apogée de l'Assassin : une exécution qu'aucune cible affaiblie ne survit.",
    forces: ["Exécution ultime", "Crit + esquive"], faiblesses: ["Toujours fragile"],
    levelReq: 100, requires: ["assassin_nightwalker"], cost: 14000, masteryReq: { assassin_nightwalker: 4 },
    statMods: { critFlat: 8, critDmgFlat: 25, dexPct: 0.08 }, passive: { execute: { threshold: 0.45, bonus: 0.55 } }, grants: ["ts_threshold_execute"], heritage: "h_edge",
    mastery: { wtype: "dual_daggers", critFlat: 7 },
  }),
};

// ===========================================================================
// BRANCHE NÉCROMANCIEN (hybride Mage + Assassin) — accessible par Maîtrise
// ===========================================================================
const NECROMANCER = {
  necromancer: node({
    id: "necromancer", name: "Nécromancien", path: "mage", rank: 6, role: "Invocateur Umbral",
    tagline: "Les morts ne se reposent pas.", desc: "Utilise Umbral et les Fragments d'âme pour lever des squelettes PERMANENTS (jusqu'à destruction), en nombre strictement limité.",
    forces: ["Squelettes permanents", "Marque funéraire"], faiblesses: ["Limite stricte d'invocations", "Fragile"],
    levelReq: 46, requires: ["mage_rune_sorcerer", "assassin_shadowblade"], cost: 3600,
    masteryReq: { mage: 2, assassin: 2 }, hybrid: true,
    statMods: { atkPct: -0.08, magPct: 0.1, hpPct: 0.08 }, passive: { skillPowerPct: 0.08 },
    grants: ["summon_skeleton", "tn_necro_bolt", "tn_soul_fragment"], heritage: "h_mana",
    summoner: { ids: ["sm_skeleton"], max: 2, permanent: true }, mastery: { wtype: "staff", atkPct: 0.06 },
  }),
  lich: node({
    id: "lich", name: "Liche", path: "mage", rank: 9, role: "Capstone nécromancien",
    tagline: "La mort faite souveraine.", desc: "L'apogée de la nécromancie : davantage de squelettes et un Umbral dévastateur.",
    forces: ["Armée de squelettes", "Umbral massif"], faiblesses: ["Limite d'invocations stricte", "Très fragile"],
    levelReq: 84, requires: ["necromancer"], cost: 9600, masteryReq: { necromancer: 3 }, hybrid: true,
    statMods: { magPct: 0.18, hpPct: 0.06, critFlat: 3 }, passive: { skillPowerPct: 0.12, execute: { threshold: 0.35, bonus: 0.35 } },
    grants: ["summon_skeleton", "tn_necro_bolt", "tm_void_oracle_collapse"], heritage: "h_mana",
    summoner: { ids: ["sm_skeleton"], max: 3, permanent: true }, mastery: { wtype: "orb", critFlat: 6 },
  }),
};

// --- Registre unifié --------------------------------------------------------
export const CLASS_NODES = {
  ...BASE_NODES,
  ...WARRIOR,
  ...GUARDIAN,
  ...ARCHER,
  ...MAGE,
  ...ASSASSIN,
  ...NECROMANCER,
};

export function getNode(id) {
  return CLASS_NODES[id] || null;
}

// Tous les nœuds d'une voie (base = path), triés par rang.
export function nodesForPath(path) {
  return Object.values(CLASS_NODES)
    .filter((n) => n.path === path)
    .sort((a, b) => a.rank - b.rank);
}

// Nœuds d'un rang donné (toutes voies).
export function nodesAtRank(rank) {
  return Object.values(CLASS_NODES).filter((n) => n.rank === rank);
}

// Le nœud est-il un nœud de base (rang 1) ?
export function isBaseNode(id) {
  const n = getNode(id);
  return !!(n && n.base);
}

// Nombre total de classes fonctionnelles de l'arbre.
export function totalClassCount() {
  return Object.keys(CLASS_NODES).length;
}
