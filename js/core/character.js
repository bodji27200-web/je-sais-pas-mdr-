// Logique du personnage : stats dérivées, équipement, PV, XP.

import { getClass } from "../data/classes.js";
import { getEquipment } from "../data/equipment.js";
import { getSkill } from "../data/skills.js";
import {
  addEquipment,
  removeEquipment,
  equipmentCount,
} from "./state.js";
import { applyXp, charXpToNext } from "./progression.js";

// Régénération hors combat : fraction des PV max récupérée par seconde.
export const OUT_OF_COMBAT_REGEN_PER_SEC = 0.03;

const STAT_KEYS = ["hp", "atk", "def", "spd", "crit"];

// Calcule les stats finales : base de classe + croissance + équipement + passive.
export function getDerivedStats(state) {
  const ch = state.character;
  const cls = getClass(ch.classId);
  const stats = {};
  for (const k of STAT_KEYS) {
    const base = cls.baseStats[k] || 0;
    const growth = (cls.growth[k] || 0) * (ch.level - 1);
    stats[k] = base + growth;
  }

  // Bonus d'équipement.
  for (const slot of Object.keys(ch.equipment)) {
    const itemId = ch.equipment[slot];
    if (!itemId) continue;
    const item = getEquipment(itemId);
    if (!item) continue;
    for (const k of Object.keys(item.stats)) {
      stats[k] = (stats[k] || 0) + item.stats[k];
    }
  }

  // Passive de classe (ex. Endurance : +10 % PV max).
  if (cls.passive) {
    const passive = getSkill(cls.passive);
    if (passive && passive.passive && passive.passive.maxHpPct) {
      stats.hp = Math.round(stats.hp * (1 + passive.passive.maxHpPct));
    }
  }

  // Arrondis propres + planchers.
  return {
    maxHp: Math.max(1, Math.round(stats.hp)),
    atk: Math.max(1, Math.round(stats.atk)),
    def: Math.max(0, Math.round(stats.def)),
    spd: Math.max(1, Math.round(stats.spd)),
    crit: Math.max(0, Math.round(stats.crit * 10) / 10),
  };
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

// Équipe un objet depuis l'inventaire. Renvoie { ok, error }.
export function equip(state, equipmentId) {
  const item = getEquipment(equipmentId);
  if (!item) return { ok: false, error: "Objet inconnu." };
  if (equipmentCount(equipmentId) <= 0)
    return { ok: false, error: "Tu ne possèdes pas cet objet." };
  if (state.character.level < (item.levelReq || 0))
    return { ok: false, error: `Niveau ${item.levelReq} requis.` };

  const slot = item.slot;
  const previous = state.character.equipment[slot];

  // Retire de l'inventaire, place dans le slot, rend l'ancien à l'inventaire.
  removeEquipment(equipmentId, 1);
  state.character.equipment[slot] = equipmentId;
  if (previous) addEquipment(previous, 1);

  clampHp(state);
  return { ok: true };
}

// Déséquipe le slot indiqué et rend l'objet à l'inventaire.
export function unequip(state, slot) {
  const itemId = state.character.equipment[slot];
  if (!itemId) return { ok: false, error: "Rien à retirer." };
  state.character.equipment[slot] = null;
  addEquipment(itemId, 1);
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
