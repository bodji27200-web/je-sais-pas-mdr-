// Progression de zone : déblocage ordonné des ennemis et du boss, % de zone.
// Data-driven (voir data/zones.js : champ `progression` + `bossUnlock`).

import { allZones, getZone } from "../data/zones.js";
import { getEnemy } from "../data/enemies.js";

function defeatedCount(state, id) {
  return (state.counters && state.counters.defeated && state.counters.defeated[id]) || 0;
}

// Renvoie la zone et l'entrée de progression contenant l'ennemi (ou le boss).
function locate(enemyId) {
  for (const zone of allZones()) {
    const idx = (zone.progression || []).findIndex((p) => p.enemy === enemyId);
    if (idx >= 0) return { zone, idx };
    if (zone.boss === enemyId) return { zone, idx: -1, isBoss: true };
  }
  return null;
}

// { unlocked, reasons:[...] } pour un ennemi/boss donné.
export function enemyUnlock(state, enemyId) {
  const loc = locate(enemyId);
  if (!loc) return { unlocked: true, reasons: [] };
  const { zone, idx, isBoss } = loc;
  const reasons = [];
  const lvl = state.character.level;

  if (isBoss) {
    const bu = zone.bossUnlock || {};
    if (lvl < (bu.level || 1)) reasons.push(`Niveau ${bu.level} requis`);
    const last = zone.progression[zone.progression.length - 1];
    if (last && bu.prevKills) {
      const have = defeatedCount(state, last.enemy);
      if (have < bu.prevKills)
        reasons.push(`Vaincre ${getEnemy(last.enemy)?.name || last.enemy} (${have}/${bu.prevKills})`);
    }
    return { unlocked: reasons.length === 0, reasons };
  }

  const p = zone.progression[idx];
  if (lvl < (p.level || 1)) reasons.push(`Niveau ${p.level} requis`);
  if (idx > 0 && p.prevKills) {
    const prev = zone.progression[idx - 1].enemy;
    const have = defeatedCount(state, prev);
    if (have < p.prevKills)
      reasons.push(`Vaincre ${getEnemy(prev)?.name || prev} (${have}/${p.prevKills})`);
  }
  return { unlocked: reasons.length === 0, reasons };
}

// Progression de la zone en % (0–100). 100 % = boss vaincu.
export function zoneProgress(state, zoneId) {
  const zone = getZone(zoneId);
  if (!zone) return 0;
  if (defeatedCount(state, zone.boss) > 0) return 100;
  const order = zone.progression || [];
  if (!order.length) return 0;
  let cleared = 0;
  for (const p of order) if (defeatedCount(state, p.enemy) >= (p.clearKills || 3)) cleared++;
  // Plafonné à 99 % tant que le boss n'est pas tombé.
  return Math.min(99, Math.round((cleared / order.length) * 100));
}
