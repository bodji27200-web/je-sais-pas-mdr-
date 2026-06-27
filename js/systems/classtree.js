// Arbre de classes — SYSTÈMES (Lot 15) : Maîtrise, déblocage, équipement de nœud,
// changement de classe, Traits d'héritage, bibliothèque de compétences.
//
// Aucune dépendance circulaire avec le moteur : ce module lit/écrit l'état et
// s'appuie sur les données (data/classTree.js) + character.js pour la validation
// d'équipement. Le combat (systems/combat.js) appelle gainMasteryOnWin() et
// buildPlayerCombatant() lit la bibliothèque (loadout).

import {
  CLASS_NODES, getNode, getHeritageTrait, nodesForPath,
  MASTERY_MAX_LEVEL, MASTERY_THRESHOLDS,
} from "../data/classTree.js";
import { CLASSES, getClass } from "../data/classes.js";
import { getSkill } from "../data/skills.js";
import { getEquipment } from "../data/equipment.js";
import { canWieldWeapon, clampHp } from "../core/character.js";
import { addEquipmentInstance } from "../core/state.js";

// --- Normalisation défensive (anciennes saves chargées en mémoire) -----------
export function ensureTreeFields(state) {
  const ch = state.character;
  if (!ch) return;
  if (!Array.isArray(ch.unlockedNodes)) ch.unlockedNodes = [];
  if (ch.classId && !ch.unlockedNodes.includes(ch.classId)) ch.unlockedNodes.push(ch.classId);
  if (ch.specId && !ch.unlockedNodes.includes(ch.specId)) ch.unlockedNodes.push(ch.specId);
  if (!ch.mastery || typeof ch.mastery !== "object") ch.mastery = {};
  if (!Array.isArray(ch.ownedHeritage)) ch.ownedHeritage = [];
  if (ch.heritageTrait === undefined) ch.heritageTrait = null;
  if (!ch.library || typeof ch.library !== "object") ch.library = { learned: [], equipped: [] };
  if (!Array.isArray(ch.library.learned)) ch.library.learned = [];
  if (!Array.isArray(ch.library.equipped)) ch.library.equipped = [];
}

// =====================================================================
// MAÎTRISE
// =====================================================================

// Nœud actuellement « équipé » au sens Maîtrise : la classe avancée si choisie,
// sinon le nœud de base de la voie.
export function equippedNodeId(state) {
  return state.character.specId || state.character.classId;
}

export function masteryLevelFromXp(xp) {
  let lvl = 0;
  for (let i = 1; i < MASTERY_THRESHOLDS.length; i++) if (xp >= MASTERY_THRESHOLDS[i]) lvl = i;
  return Math.min(MASTERY_MAX_LEVEL, lvl);
}

export function masteryOf(state, nodeId) {
  ensureTreeFields(state);
  const m = state.character.mastery[nodeId];
  const xp = m ? m.xp || 0 : 0;
  return { xp, level: masteryLevelFromXp(xp) };
}

// Détail pour l'UI : palier, XP dans le palier, XP pour le suivant, récompense.
export function masteryProgress(state, nodeId) {
  const { xp, level } = masteryOf(state, nodeId);
  const maxed = level >= MASTERY_MAX_LEVEL;
  const cur = MASTERY_THRESHOLDS[level] || 0;
  const next = maxed ? cur : MASTERY_THRESHOLDS[level + 1];
  const node = getNode(nodeId);
  return {
    level, xp, maxed,
    into: xp - cur,
    need: maxed ? 0 : next - cur,
    nextLevel: maxed ? level : level + 1,
    heritage: node && node.heritage ? getHeritageTrait(node.heritage) : null,
  };
}

// Gain de Maîtrise après un combat GAGNÉ avec la classe équipée (instr. mastery).
// La Maîtrise n'augmente QUE pour le nœud équipé (jamais pour une autre classe).
// Renvoie { id, level, leveledUp, heritageUnlocked }.
export function gainMasteryOnWin(state, amount = 1) {
  ensureTreeFields(state);
  const id = equippedNodeId(state);
  const m = state.character.mastery[id] || (state.character.mastery[id] = { level: 0, xp: 0 });
  const before = masteryLevelFromXp(m.xp);
  m.xp += amount;
  m.level = masteryLevelFromXp(m.xp);
  let heritageUnlocked = null;
  if (m.level >= MASTERY_MAX_LEVEL) {
    const node = getNode(id);
    if (node && node.heritage && !state.character.ownedHeritage.includes(node.heritage)) {
      state.character.ownedHeritage.push(node.heritage);
      heritageUnlocked = node.heritage;
    }
  }
  return { id, level: m.level, leveledUp: m.level > before, heritageUnlocked };
}

// =====================================================================
// DÉBLOCAGE DE NŒUD
// =====================================================================

export function nodeUnlocked(state, id) {
  ensureTreeFields(state);
  const node = getNode(id);
  if (!node) return false;
  if (node.base) return true; // les 5 voies de base sont toujours accessibles (changement libre)
  return state.character.unlockedNodes.includes(id);
}

// Vérifie toutes les conditions de déblocage. Renvoie { ok, reasons:[], cost }.
export function canUnlockNode(state, id) {
  ensureTreeFields(state);
  const node = getNode(id);
  const ch = state.character;
  if (!node) return { ok: false, reasons: ["Classe inconnue."], cost: 0 };
  if (node.base) return { ok: false, reasons: ["Voie de base (toujours accessible)."], cost: 0 };
  if (nodeUnlocked(state, id)) return { ok: false, reasons: ["Déjà débloquée."], cost: 0 };

  const reasons = [];
  if (node.path !== ch.classId) reasons.push(`Voie ${getClass(node.path)?.name || node.path} requise (change de voie d'abord)`);
  if (ch.level < node.levelReq) reasons.push(`Niveau ${node.levelReq} requis`);
  // Prérequis (sémantique OU : au moins UN nœud parent débloqué).
  if ((node.requires || []).length && !node.requires.some((r) => nodeUnlocked(state, r))) {
    const names = node.requires.map((r) => getNode(r)?.name || r).join(" ou ");
    reasons.push(`Classe prérequise : ${names}`);
  }
  // Maîtrise requise (clé = id de nœud ; les clés de voie = nœud de base).
  for (const k of Object.keys(node.masteryReq || {})) {
    const need = node.masteryReq[k];
    if (masteryOf(state, k).level < need) {
      const nm = getNode(k)?.name || getClass(k)?.name || k;
      reasons.push(`Maîtrise ${need} de « ${nm} » requise`);
    }
  }
  if ((state.gold || 0) < (node.cost || 0)) reasons.push(`${node.cost} or requis`);
  return { ok: reasons.length === 0, reasons, cost: node.cost || 0 };
}

// Débloque un nœud (paie le coût). Renvoie { ok, error, name }.
export function unlockNode(state, id) {
  const chk = canUnlockNode(state, id);
  if (!chk.ok) return { ok: false, error: chk.reasons[0] || "Conditions non remplies." };
  const node = getNode(id);
  if (node.cost) state.gold -= node.cost;
  state.character.unlockedNodes.push(id);
  return { ok: true, name: node.name };
}

// =====================================================================
// CHANGEMENT DE CLASSE / ÉQUIPEMENT DE NŒUD
// =====================================================================

// Renvoie à l'inventaire les armes que la NOUVELLE configuration ne peut manier.
// Ne détruit jamais un objet (instr. 296-298).
function returnIncompatibleWeapons(state) {
  for (const slot of ["weapon", "offhand"]) {
    const inst = state.character.equipment[slot];
    if (!inst) continue;
    const tpl = getEquipment(inst.baseId);
    if (tpl && !canWieldWeapon(state, tpl)) {
      state.character.equipment[slot] = null;
      addEquipmentInstance(inst);
    }
  }
}

// Déséquipe proprement les compétences de bibliothèque devenues injouables après
// changement de classe (elles RESTENT apprises — jamais détruites, instr. 304).
function pruneLibraryEquipped(state) {
  const ch = state.character;
  const allowed = new Set(naturalSkillsForPath(ch.classId));
  ch.library.equipped = (ch.library.equipped || []).filter((id) => {
    const sk = getSkill(id);
    if (!sk) return false;
    // On garde celles jouables : compétences de la voie naturelle OU déjà apprises
    // (les hors-voie restent jouables mais pénalisées — voir buildPlayerCombatant).
    return ch.library.learned.includes(id) || allowed.has(id);
  });
}

// Équipe un nœud (= « changement de classe »). Les nœuds de base changent la VOIE
// (classId), les nœuds avancés changent la classe avancée (specId). Interdit en
// combat. Valide l'équipement et la bibliothèque. Renvoie { ok, error, name }.
export function equipClassNode(state, id, opts = {}) {
  ensureTreeFields(state);
  if (opts.inCombat) return { ok: false, error: "Impossible de changer de classe en plein combat." };
  const node = getNode(id);
  if (!node) return { ok: false, error: "Classe inconnue." };
  const ch = state.character;

  if (node.base) {
    if (ch.classId === id && !ch.specId) return { ok: false, error: "Voie déjà équipée." };
    ch.classId = id;
    ch.specId = null;
    if (!ch.unlockedNodes.includes(id)) ch.unlockedNodes.push(id);
  } else {
    if (node.path !== ch.classId) return { ok: false, error: "Cette classe appartient à une autre voie (équipe d'abord la voie)." };
    if (!nodeUnlocked(state, id)) return { ok: false, error: "Classe verrouillée." };
    if (ch.specId === id) return { ok: false, error: "Classe déjà équipée." };
    ch.specId = id;
  }

  learnNodeSkills(state, id); // les compétences actives de la classe deviennent apprises
  returnIncompatibleWeapons(state);
  pruneLibraryEquipped(state);
  clampHp(state);
  return { ok: true, name: node.name };
}

// =====================================================================
// TRAITS D'HÉRITAGE
// =====================================================================

export function ownedHeritageTraits(state) {
  ensureTreeFields(state);
  return state.character.ownedHeritage.map((id) => getHeritageTrait(id)).filter(Boolean);
}

// Équipe (ou retire par bascule) un Trait d'héritage externe. Un seul à la fois.
export function equipHeritage(state, id) {
  ensureTreeFields(state);
  if (id && !state.character.ownedHeritage.includes(id)) return { ok: false, error: "Trait d'héritage non débloqué." };
  state.character.heritageTrait = state.character.heritageTrait === id ? null : id;
  clampHp(state);
  return { ok: true, equipped: state.character.heritageTrait };
}

// =====================================================================
// BIBLIOTHÈQUE DE COMPÉTENCES
// =====================================================================

// Nombre d'emplacements de compétences emportées, croissant avec le niveau.
export function librarySlots(level) {
  if (level >= 100) return 8;
  if (level >= 80) return 7;
  if (level >= 60) return 6;
  if (level >= 40) return 5;
  if (level >= 20) return 4;
  return 3;
}

// Compétences « naturelles » d'une voie : compétences de base de la classe +
// toutes les compétences accordées par les nœuds de cette voie. Sert à détecter
// les compétences HORS-VOIE (pénalisées) et à filtrer la bibliothèque.
export function naturalSkillsForPath(path) {
  const out = new Set(getClass(path)?.skills || []);
  for (const n of nodesForPath(path)) for (const g of n.grants || []) out.add(g);
  return [...out];
}

// Apprend les compétences actives accordées par un nœud (persistent au changement
// de classe). Idempotent.
export function learnNodeSkills(state, nodeId) {
  ensureTreeFields(state);
  const node = getNode(nodeId);
  if (!node) return;
  const cls = getClass(node.path);
  const toLearn = [...(cls?.skills || []), ...(node.grants || [])];
  for (const id of toLearn) {
    const sk = getSkill(id);
    if (sk && sk.type === "active" && !state.character.library.learned.includes(id)) {
      state.character.library.learned.push(id);
    }
  }
}

// Ajoute/retire une compétence apprise à la sélection emportée (loadout), dans la
// limite des emplacements. Renvoie { ok, error, equipped }.
export function toggleLibrarySkill(state, id) {
  ensureTreeFields(state);
  const ch = state.character;
  if (!ch.library.learned.includes(id)) return { ok: false, error: "Compétence non apprise." };
  const eq = ch.library.equipped;
  const i = eq.indexOf(id);
  if (i >= 0) {
    eq.splice(i, 1);
    return { ok: true, equipped: false };
  }
  if (eq.length >= librarySlots(ch.level)) return { ok: false, error: `Limite atteinte (${librarySlots(ch.level)} emplacements).` };
  eq.push(id);
  return { ok: true, equipped: true };
}

// Une compétence est-elle HORS-VOIE pour la classe courante (efficacité réduite) ?
export function isOffPathSkill(state, id) {
  const sk = getSkill(id);
  if (!sk || id === "basic_attack" || id === "defend") return false;
  return !naturalSkillsForPath(state.character.classId).includes(id);
}

// Compétences actives effectivement emportées au combat. Si la sélection est vide
// (nouveau joueur / ancienne save), on retombe sur le kit naturel (voie + nœud) :
// comportement INCHANGÉ et rétrocompatible.
export function combatActiveSkills(state) {
  ensureTreeFields(state);
  const ch = state.character;
  if (ch.library.equipped && ch.library.equipped.length) {
    return [...ch.library.equipped];
  }
  const cls = getClass(ch.classId);
  const node = ch.specId ? getNode(ch.specId) : null;
  return [...(cls?.skills || []), ...((node && node.grants) || [])];
}

// Pénalité d'efficacité des compétences hors-voie (puissance réduite). Affichée
// dans l'UI ; appliquée par le moteur (player.offPath).
export const OFF_PATH_POWER_MULT = 0.85;
