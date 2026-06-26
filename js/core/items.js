// Instances d'équipement : chaque pièce lootée/forgée est un objet UNIQUE,
// avec sa rareté et ses stats légèrement variables (tirées à la création).
//
// Forme d'une instance :
//   { uid, baseId, rarity, stats: { atk, def, hp, spd, crit }, lvl }
//   - baseId : modèle dans data/equipment.js (nom, slot, icône, niveau requis…)
//   - rarity : id de rareté (data/rarities.js)
//   - stats  : valeurs FINALES déjà tirées (base × rareté × variance)
//   - lvl    : renforcement (+0 au départ ; système d'amélioration plus tard)

import { EQUIPMENT, getEquipment } from "../data/equipment.js";
import { RARITIES, RARITY_ORDER, getRarity } from "../data/rarities.js";

// Amplitude de variation des stats autour de la valeur attendue (±8 %).
const VARIANCE = 0.08;

// Renforcement : +0 à +5, bonus modéré par niveau sur les stats positives.
// Modéré (4 %/niv) -> la rareté reste plus importante que le renforcement
// (un commun +5 = ×1.20 ne dépasse pas un rare +0 = ×1.38).
export const MAX_UPGRADE = 5;
export const UPGRADE_PER_LEVEL = 0.04;

export function upgradeMult(lvl) {
  return 1 + UPGRADE_PER_LEVEL * (lvl || 0);
}

// Stats FINALES affichées/appliquées : stats tirées × bonus de renforcement.
// Les malus (valeurs négatives) ne sont jamais aggravés par le renforcement.
export function effectiveStats(inst) {
  if (!inst || !inst.stats) return {};
  const m = upgradeMult(inst.lvl);
  const out = {};
  for (const k of Object.keys(inst.stats)) {
    const v = inst.stats[k];
    out[k] = v >= 0 ? Math.round(v * m) : v;
  }
  return out;
}

function uid() {
  return "eq_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Tire les stats finales d'une pièce selon sa rareté.
// - stats positives : × multiplicateur de rareté × variance (≥ 1).
// - stats négatives (ex. malus de vitesse) : variance seule, pas aggravées par
//   la rareté -> une meilleure rareté reste toujours un upgrade.
function rollStats(base, rarity) {
  const out = {};
  for (const k of Object.keys(base)) {
    const v = base[k];
    const variance = 1 - VARIANCE + Math.random() * VARIANCE * 2;
    if (v >= 0) out[k] = Math.max(1, Math.round(v * rarity.mult * variance));
    else out[k] = Math.round(v * variance);
  }
  return out;
}

// Crée une instance d'un objet à partir de son modèle et d'une rareté.
export function makeInstance(baseId, rarityId = "common") {
  const tpl = getEquipment(baseId);
  if (!tpl) return null;
  const rarity = getRarity(rarityId);
  return {
    uid: uid(),
    baseId,
    rarity: rarity.id,
    stats: rollStats(tpl.stats, rarity),
    lvl: 0,
  };
}

// « Chance » d'un ennemi : décale le tirage vers les raretés supérieures.
// Boss et ennemis de haut niveau lootent nettement mieux.
export function enemyLuck(enemy) {
  const lvl = enemy.level || 1;
  if (enemy.isBoss) return Math.min(1.6, 0.5 + lvl * 0.06);
  return Math.min(0.5, 0.05 + lvl * 0.03);
}

// Tire une rareté selon un tableau pondéré modulé par la chance.
export function rollRarity(luck = 0) {
  let total = 0;
  const cumul = [];
  for (const r of RARITY_ORDER) {
    const w = r.weight * (1 + r.luckGain * luck);
    total += w;
    cumul.push([r.id, total]);
  }
  const roll = Math.random() * total;
  for (const [id, threshold] of cumul) {
    if (roll <= threshold) return id;
  }
  return "common";
}

// Pièces lootables par un ennemi : équipements de niveau requis adapté.
function lootPool(enemy) {
  const cap = (enemy.level || 1) + 1;
  return Object.values(EQUIPMENT).filter((it) => (it.levelReq || 0) <= cap);
}

// Loot d'équipement « aléatoire » d'un ennemi (en plus des drops scriptés).
// Renvoie une instance ou null. `force` garantit une pièce (boss).
export function rollGearDrop(enemy, force = false) {
  const chance = force ? 1 : enemy.isBoss ? 1 : 0.2;
  if (Math.random() > chance) return null;
  const pool = lootPool(enemy);
  if (!pool.length) return null;
  const base = pool[Math.floor(Math.random() * pool.length)];
  return makeInstance(base.id, rollRarity(enemyLuck(enemy)));
}

// --- Helpers d'affichage / comparaison -------------------------------------

export function instanceTemplate(inst) {
  return inst ? getEquipment(inst.baseId) : null;
}

export function instanceRarity(inst) {
  return getRarity(inst ? inst.rarity : "common");
}

// Nom complet affiché (préfixe de rareté pour les crans élevés).
export function instanceName(inst) {
  const tpl = instanceTemplate(inst);
  return tpl ? tpl.name : "Objet inconnu";
}

// Somme des stats (pour comparer deux pièces d'un même slot, upgrade or not).
export function statScore(stats) {
  // Pondération simple et lisible : PV comptent peu à l'unité, crit beaucoup.
  const w = { hp: 0.12, atk: 1, def: 0.9, spd: 0.8, crit: 1.4 };
  let s = 0;
  for (const k of Object.keys(stats || {})) s += (stats[k] || 0) * (w[k] || 1);
  return s;
}
