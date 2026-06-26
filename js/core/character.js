// Logique du personnage : stats dérivées, équipement, PV, XP.

import { getClass } from "../data/classes.js";
import { getEquipment } from "../data/equipment.js";
import { getSkill } from "../data/skills.js";
import { getSpec, SPEC_UNLOCK_LEVEL, respecCost } from "../data/specializations.js";
import {
  addEquipmentInstance,
  removeEquipmentInstance,
  findEquipmentInstance,
} from "./state.js";
import { effectiveStats } from "./items.js";
import { applyXp, charXpToNext } from "./progression.js";

// Régénération hors combat : fraction des PV max récupérée par seconde.
export const OUT_OF_COMBAT_REGEN_PER_SEC = 0.03;

const STAT_KEYS = ["hp", "atk", "def", "spd", "crit"];

// Slots d'armure pris en compte pour les bonus de famille (set 3 pièces).
const ARMOR_SLOTS = ["head", "chest", "legs"];

// Bonus de set 3 pièces par famille (identité forte des armures).
// Modifiable ici (data-driven d'esprit : un seul endroit).
export const SET_BONUS = {
  cloth: { atkMult: 0.12, crit: 3, label: "+12 % ATK · +3 % crit" },
  leather: { spdMult: 0.1, crit: 5, label: "+10 % VIT · +5 % crit" },
  metal: { hpMult: 0.12, defMult: 0.12, label: "+12 % PV · +12 % DEF" },
};

// Compte les familles d'armure équipées (slots tête/torse/jambes).
export function familyCounts(state) {
  const c = { cloth: 0, leather: 0, metal: 0 };
  for (const slot of ARMOR_SLOTS) {
    const inst = state.character.equipment[slot];
    if (!inst) continue;
    const tpl = getEquipment(inst.baseId);
    if (tpl && tpl.family && c[tpl.family] !== undefined) c[tpl.family] += 1;
  }
  return c;
}

// Famille de set actif (>= 3 pièces), ou null.
export function activeSet(state) {
  const c = familyCounts(state);
  for (const fam of Object.keys(c)) if (c[fam] >= 3) return fam;
  return null;
}

// Calcule les stats finales : base + croissance + équipement + set + passive.
export function getDerivedStats(state) {
  const ch = state.character;
  const cls = getClass(ch.classId);
  const stats = {};
  for (const k of STAT_KEYS) {
    stats[k] = (cls.baseStats[k] || 0) + (cls.growth[k] || 0) * (ch.level - 1);
  }

  // Bonus d'équipement (stats effectives = tirage × renforcement).
  for (const slot of Object.keys(ch.equipment)) {
    const inst = ch.equipment[slot];
    if (!inst || !inst.stats) continue;
    const es = effectiveStats(inst);
    for (const k of Object.keys(es)) stats[k] = (stats[k] || 0) + es[k];
  }

  // Bonus de set 3 pièces (multiplicatif sur les totaux).
  const set = activeSet(state);
  if (set) {
    const b = SET_BONUS[set];
    if (b.atkMult) stats.atk *= 1 + b.atkMult;
    if (b.hpMult) stats.hp *= 1 + b.hpMult;
    if (b.defMult) stats.def *= 1 + b.defMult;
    if (b.spdMult) stats.spd *= 1 + b.spdMult;
    if (b.crit) stats.crit = (stats.crit || 0) + b.crit;
  }

  // Passive de classe (parties permanentes des stats).
  const pp = cls.passive ? getSkill(cls.passive)?.passive : null;
  if (pp) {
    if (pp.maxHpPct) stats.hp *= 1 + pp.maxHpPct;
    if (pp.defPct) stats.def *= 1 + pp.defPct;
    if (pp.atkPct) stats.atk *= 1 + pp.atkPct;
    if (pp.spdPct) stats.spd *= 1 + pp.spdPct;
    if (pp.critFlat) stats.crit = (stats.crit || 0) + pp.critFlat;
  }

  // Spécialisation : modificateurs permanents + maîtrise d'arme.
  const spec = getActiveSpec(state);
  if (spec) {
    const m = spec.statMods || {};
    if (m.hpPct) stats.hp *= 1 + m.hpPct;
    if (m.defPct) stats.def *= 1 + m.defPct;
    if (m.atkPct) stats.atk *= 1 + m.atkPct;
    if (m.spdPct) stats.spd *= 1 + m.spdPct;
    if (m.critFlat) stats.crit = (stats.crit || 0) + m.critFlat;

    // Maîtrise : bonus si l'arme de prédilection de la voie est équipée.
    const wInst = ch.equipment.weapon;
    const wtpl = wInst ? getEquipment(wInst.baseId) : null;
    if (spec.mastery && wtpl && wtpl.wtype === spec.mastery.wtype) {
      const k = spec.mastery;
      if (k.atkPct) stats.atk *= 1 + k.atkPct;
      if (k.defPct) stats.def *= 1 + k.defPct;
      if (k.spdPct) stats.spd *= 1 + k.spdPct;
      if (k.critFlat) stats.crit = (stats.crit || 0) + k.critFlat;
    }
  }

  return {
    maxHp: Math.max(1, Math.round(stats.hp)),
    atk: Math.max(1, Math.round(stats.atk)),
    def: Math.max(0, Math.round(stats.def)),
    spd: Math.max(1, Math.round(stats.spd)),
    crit: Math.max(0, Math.round(stats.crit * 10) / 10),
  };
}

// --- Spécialisations ---

// Spécialisation active (ou null si non choisie / id inconnu).
export function getActiveSpec(state) {
  const id = state.character.specId;
  if (!id) return null;
  const spec = getSpec(id);
  // Sécurité : la voie doit appartenir à la classe du personnage.
  return spec && spec.classId === state.character.classId ? spec : null;
}

// La spécialisation est-elle débloquée (niveau atteint) ?
export function specUnlocked(state) {
  return state.character.level >= SPEC_UNLOCK_LEVEL;
}

// Coût du prochain changement de voie (0 si premier choix gratuit).
export function nextRespecCost(state) {
  if (!state.character.specId) return 0;
  return respecCost(state.character.specChanges || 0);
}

// Choisit / change de voie. Premier choix gratuit ; les suivants coûtent de l'or.
// Renvoie { ok, error, name, paid }.
export function chooseSpec(state, specId) {
  if (!specUnlocked(state))
    return { ok: false, error: `Spécialisation débloquée au niveau ${SPEC_UNLOCK_LEVEL}.` };
  const spec = getSpec(specId);
  if (!spec || spec.classId !== state.character.classId)
    return { ok: false, error: "Voie indisponible pour cette classe." };
  if (state.character.specId === specId)
    return { ok: false, error: "Cette voie est déjà la tienne." };

  const cost = nextRespecCost(state);
  if (cost > 0) {
    if (state.gold < cost) return { ok: false, error: `Il te faut ${cost} or pour changer de voie.` };
    state.gold -= cost;
    state.character.specChanges = (state.character.specChanges || 0) + 1;
  }
  state.character.specId = specId;
  clampHp(state);
  return { ok: true, name: spec.name, paid: cost };
}

export function clampHp(state) {
  const { maxHp } = getDerivedStats(state);
  if (state.character.hpCurrent > maxHp) state.character.hpCurrent = maxHp;
  if (state.character.hpCurrent < 0) state.character.hpCurrent = 0;
}

// Régénération hors combat (appelée par la boucle de jeu).
export function regenOutOfCombat(state, deltaMs) {
  const { maxHp } = getDerivedStats(state);
  if (state.character.hpCurrent >= maxHp) return;
  const heal = maxHp * OUT_OF_COMBAT_REGEN_PER_SEC * (deltaMs / 1000);
  state.character.hpCurrent = Math.min(maxHp, state.character.hpCurrent + heal);
}

// Une arme est-elle maniable par la classe du personnage ?
// On ne contrôle QUE les armes (slot weapon) ayant un type (`wtype`) ; les
// armures et accessoires restent universels. Sans liste `weapons` -> tout permis.
export function canWieldWeapon(state, tpl) {
  if (!tpl || tpl.slot !== "weapon" || !tpl.wtype) return true;
  const cls = getClass(state.character.classId);
  if (!cls || !cls.weapons) return true;
  return cls.weapons.includes(tpl.wtype);
}

// Équipe une instance (par uid) depuis l'inventaire. Renvoie { ok, error, name }.
export function equip(state, uid) {
  const inst = findEquipmentInstance(uid);
  if (!inst) return { ok: false, error: "Objet introuvable." };
  const tpl = getEquipment(inst.baseId);
  if (!tpl) return { ok: false, error: "Objet inconnu." };
  if (state.character.level < (tpl.levelReq || 0))
    return { ok: false, error: `Niveau ${tpl.levelReq} requis.` };
  if (!canWieldWeapon(state, tpl)) {
    const cls = getClass(state.character.classId);
    return { ok: false, error: `${cls.name} ne peut pas manier cette arme.` };
  }

  const slot = tpl.slot;
  const previous = state.character.equipment[slot];

  // Retire de l'inventaire, place dans le slot, rend l'ancien à l'inventaire.
  removeEquipmentInstance(uid);
  state.character.equipment[slot] = inst;
  if (previous) addEquipmentInstance(previous);

  clampHp(state);
  return { ok: true, name: tpl.name };
}

// Déséquipe le slot indiqué et rend l'instance à l'inventaire.
export function unequip(state, slot) {
  const inst = state.character.equipment[slot];
  if (!inst) return { ok: false, error: "Rien à retirer." };
  state.character.equipment[slot] = null;
  addEquipmentInstance(inst);
  clampHp(state);
  return { ok: true };
}

// Gagne de l'XP de personnage. Renvoie le nombre de niveaux gagnés.
// Soigne intégralement à chaque niveau gagné (sensation de progression).
export function gainCharXp(state, amount) {
  const levels = applyXp(state.character, amount, charXpToNext);
  if (levels > 0) {
    // Chaque niveau gagné soigne intégralement (sensation de progression).
    state.character.hpCurrent = getDerivedStats(state).maxHp;
  }
  clampHp(state);
  return levels;
}
