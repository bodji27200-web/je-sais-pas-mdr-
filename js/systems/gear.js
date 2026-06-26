// Renforcement (+0 à +5) et démantèlement de l'équipement.
// Règles : amélioration garantie (aucun échec, aucune perte), coûts croissants,
// matériaux selon le type d'équipement. Le démantèlement recycle les pièces en
// or + Essence d'équipement (qui sert justement à renforcer).

import { getEquipment } from "../data/equipment.js";
import { getRarity } from "../data/rarities.js";
import { MAX_UPGRADE } from "../core/items.js";
import {
  resourceCount,
  removeResource,
  addResource,
  addGold,
  findEquipmentInstance,
  removeEquipmentInstance,
} from "../core/state.js";

const ESSENCE = "equip_essence";

// Matériau « de type » requis pour renforcer, selon la pièce.
function typeMaterial(tpl) {
  if (tpl.family === "leather") return "raw_hide";
  if (tpl.family === "cloth") return "coarse_cloth";
  if (tpl.family === "metal") return "iron_ingot";
  if (tpl.slot === "weapon") return "iron_ingot";
  if (tpl.slot === "accessory") return "rough_gem";
  return "iron_ingot";
}

// Coût pour passer de +lvl à +(lvl+1). Croît avec le niveau visé et la rareté.
// Renvoie null si la pièce est déjà au niveau max.
export function upgradeCost(inst) {
  const lvl = inst.lvl || 0;
  if (lvl >= MAX_UPGRADE) return null;
  const tpl = getEquipment(inst.baseId);
  const next = lvl + 1;
  const rarityFactor = 1 + getRarity(inst.rarity).rank * 0.35;
  return {
    gold: Math.round(25 * next * rarityFactor),
    essence: next, // 1, 2, 3, 4, 5
    material: { id: typeMaterial(tpl), qty: Math.max(1, Math.ceil(next / 2)) }, // 1,1,2,2,3
  };
}

// Le joueur peut-il payer le renforcement ? { ok, reason }.
export function canUpgrade(state, inst) {
  const cost = upgradeCost(inst);
  if (!cost) return { ok: false, reason: "Niveau maximum atteint" };
  if (state.gold < cost.gold) return { ok: false, reason: "Or insuffisant" };
  if (resourceCount(ESSENCE) < cost.essence) return { ok: false, reason: "Essence insuffisante" };
  if (resourceCount(cost.material.id) < cost.material.qty)
    return { ok: false, reason: "Matériaux insuffisants" };
  return { ok: true };
}

// Renforce une instance de l'inventaire (par uid). Garanti si payable.
export function upgradeItem(state, uid) {
  const inst = findEquipmentInstance(uid);
  if (!inst) return { ok: false, error: "Objet introuvable." };
  const check = canUpgrade(state, inst);
  if (!check.ok) return { ok: false, error: check.reason };
  const cost = upgradeCost(inst);

  addGold(-cost.gold);
  removeResource(ESSENCE, cost.essence);
  removeResource(cost.material.id, cost.material.qty);
  inst.lvl = (inst.lvl || 0) + 1;

  return { ok: true, lvl: inst.lvl };
}

// Gain de démantèlement selon la rareté (+ petit bonus pour le renforcement investi).
export function dismantleReward(inst) {
  const rank = getRarity(inst.rarity).rank;
  const gold = [4, 8, 16, 30, 60][rank] + (inst.lvl || 0) * 4;
  const essence = [1, 2, 3, 5, 8][rank] + (inst.lvl || 0);
  return { gold, essence };
}

// Le démantèlement nécessite-t-il une confirmation ? (rare et au-dessus)
export function needsDismantleConfirm(inst) {
  return getRarity(inst.rarity).rank >= 2;
}

// Démantèle une instance de l'INVENTAIRE (les pièces équipées sont dans les
// slots, donc inaccessibles ici : impossible de démanteler l'équipé).
export function dismantleItem(state, uid) {
  const inst = findEquipmentInstance(uid);
  if (!inst) return { ok: false, error: "Objet introuvable (déjà équipé ?)." };
  const reward = dismantleReward(inst);
  removeEquipmentInstance(uid);
  addGold(reward.gold);
  addResource(ESSENCE, reward.essence);
  return { ok: true, reward };
}
