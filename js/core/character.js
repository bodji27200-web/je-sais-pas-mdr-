// Logique du personnage : stats dérivées, équipement, PV, XP.

import { getClass } from "../data/classes.js";
import { getEquipment, weaponHand } from "../data/equipment.js";
import { getSkill } from "../data/skills.js";
import { getSpec, SPEC_UNLOCK_LEVEL, respecCost } from "../data/specializations.js";
import { getNode, getHeritageTrait } from "../data/classTree.js";
import { MATERIALS } from "../data/materials.js";
import {
  addEquipmentInstance,
  removeEquipmentInstance,
  findEquipmentInstance,
} from "./state.js";
import { effectiveStats } from "./items.js";
import { applyXp, charXpToNext } from "./progression.js";

// Régénération hors combat : fraction des PV max récupérée par seconde.
export const OUT_OF_COMBAT_REGEN_PER_SEC = 0.03;

// Stats principales calculées. `hp`/`spd` gardent leur clé moteur historique
// (spd = Clairvoyance côté UI). Les stats ajoutées (mag/res/dex/acc/critDmg)
// sont ADDITIVES : elles ne modifient pas les multiplicateurs existants.
const STAT_KEYS = ["hp", "atk", "def", "mag", "res", "dex", "acc", "spd", "crit", "critDmg"];

// Garde-fou (instr. 319) : jamais de NaN / Infinity / valeur aberrante dans une
// stat. Renvoie un nombre fini, sinon la valeur de repli.
function safeNum(n, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

// Applique un bloc de modificateurs de stat (nœud d'arbre, maîtrise, Trait
// d'héritage) sur l'objet `stats` { hp, atk, def, mag, res, dex, acc, spd, crit,
// critDmg }. Pourcentages (…Pct) multiplicatifs ; valeurs plates (…Flat) additives.
// Vocabulaire data-driven : ajouter une clé = une ligne ici, rien dans le moteur.
export function applyNodeStatMods(stats, m) {
  if (!m) return;
  // multiplicatifs
  if (m.hpPct) stats.hp *= 1 + m.hpPct;
  if (m.atkPct) stats.atk *= 1 + m.atkPct;
  if (m.defPct) stats.def *= 1 + m.defPct;
  if (m.spdPct) stats.spd *= 1 + m.spdPct;
  if (m.magPct) stats.mag *= 1 + m.magPct;
  if (m.resPct) stats.res *= 1 + m.resPct;
  if (m.dexPct) stats.dex *= 1 + m.dexPct;
  if (m.accPct) stats.acc *= 1 + m.accPct;
  // additifs
  if (m.critFlat) stats.crit = (stats.crit || 0) + m.critFlat;
  if (m.critDmgFlat) stats.critDmg = (stats.critDmg || 0) + m.critDmgFlat;
  if (m.accFlat) stats.acc = (stats.acc || 0) + m.accFlat;
  if (m.dexFlat) stats.dex = (stats.dex || 0) + m.dexFlat;
  if (m.magFlat) stats.mag = (stats.mag || 0) + m.magFlat;
  if (m.resFlat) stats.res = (stats.res || 0) + m.resFlat;
  if (m.hpFlat) stats.hp = (stats.hp || 0) + m.hpFlat;
  if (m.atkFlat) stats.atk = (stats.atk || 0) + m.atkFlat;
}

// Slots d'armure pris en compte pour les bonus de matériau (seuils 2 / 4 pièces).
// Cinq emplacements -> les seuils 2 et 4 sont atteignables, et les builds
// HYBRIDES (ex. 2 Tissu + 2 Métal) cumulent deux bonus « 2 pièces ».
const ARMOR_SLOTS = ["head", "chest", "hands", "legs", "feet"];

// Compte les familles d'armure équipées (5 slots d'armure).
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

// Bonus de matériau actifs : pour chaque famille, le bonus « 2 pièces » dès 2,
// et le bonus « 4 pièces » (avec passif comportemental) dès 4. Cumulables entre
// matériaux (builds hybrides). Renvoie [{ material, tier, statMods, behavior?, label }].
export function activeMaterialBonuses(state) {
  const c = familyCounts(state);
  const out = [];
  for (const fam of Object.keys(c)) {
    const mat = MATERIALS[fam];
    if (!mat) continue;
    if (c[fam] >= 2) out.push({ material: fam, tier: 2, statMods: mat.bonus2.statMods, label: mat.bonus2.label });
    if (c[fam] >= 4)
      out.push({ material: fam, tier: 4, statMods: mat.bonus4.statMods, behavior: mat.bonus4.behavior, label: mat.bonus4.label });
  }
  return out;
}

// Comportements de matériau actifs (4 pièces) — lus par le moteur de combat.
export function activeMaterialBehaviors(state) {
  return activeMaterialBonuses(state)
    .filter((b) => b.behavior)
    .map((b) => b.behavior);
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

  // Bonus de matériau (seuils 2 / 4 pièces, cumulables -> builds hybrides).
  for (const b of activeMaterialBonuses(state)) {
    const m = b.statMods || {};
    if (m.atkPct) stats.atk *= 1 + m.atkPct;
    if (m.hpPct) stats.hp *= 1 + m.hpPct;
    if (m.defPct) stats.def *= 1 + m.defPct;
    if (m.spdPct) stats.spd *= 1 + m.spdPct;
    if (m.critFlat) stats.crit = (stats.crit || 0) + m.critFlat;
  }

  // Affixes de stat (Lot 13) : % cumulés depuis toutes les pièces équipées.
  // Visibles sur la fiche -> deux mêmes objets de raretés différentes diffèrent.
  for (const slot of Object.keys(ch.equipment)) {
    const inst = ch.equipment[slot];
    if (!inst || !inst.affixes) continue;
    for (const af of inst.affixes) {
      if (af.kind !== "stat") continue;
      if (af.stat === "pctAtk") stats.atk *= 1 + af.value;
      else if (af.stat === "pctDef") stats.def *= 1 + af.value;
      else if (af.stat === "pctHp") stats.hp *= 1 + af.value;
      else if (af.stat === "spdPct") stats.spd *= 1 + af.value;
      else if (af.stat === "critFlat") stats.crit = (stats.crit || 0) + af.value;
    }
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

  // Nœud d'arbre équipé (= spécialisation généralisée) : modificateurs permanents
  // + maîtrise d'arme. Réutilise EXACTEMENT le mécanisme des spécialisations.
  const spec = getActiveSpec(state);
  if (spec) {
    applyNodeStatMods(stats, spec.statMods);

    // Maîtrise : bonus si l'arme de prédilection de la voie est équipée dans
    // l'une OU l'autre main (dual-wield pris en compte).
    const wieldsMastery = spec.mastery && ["weapon", "offhand"].some((s) => {
      const t = ch.equipment[s] ? getEquipment(ch.equipment[s].baseId) : null;
      return t && t.wtype === spec.mastery.wtype;
    });
    if (wieldsMastery) applyNodeStatMods(stats, spec.mastery);
  }

  // Trait d'héritage externe équipé (Lot 15) : un seul, bonus mineur permanent.
  const trait = getEquippedHeritage(state);
  if (trait && trait.statMods) applyNodeStatMods(stats, trait.statMods);

  return {
    maxHp: Math.max(1, Math.round(safeNum(stats.hp, 1))),
    atk: Math.max(1, Math.round(safeNum(stats.atk, 1))),
    def: Math.max(0, Math.round(safeNum(stats.def))),
    mag: Math.max(0, Math.round(safeNum(stats.mag))),
    res: Math.max(0, Math.round(safeNum(stats.res))),
    dex: Math.max(0, Math.round(safeNum(stats.dex))),
    acc: Math.max(0, Math.round(safeNum(stats.acc))),
    spd: Math.max(1, Math.round(safeNum(stats.spd, 1))),
    crit: Math.max(0, Math.round(safeNum(stats.crit) * 10) / 10),
    critDmg: Math.max(0, Math.round(safeNum(stats.critDmg, 60))),
  };
}

// Décomposition lisible de chaque stat : base (classe + niveau), équipement
// (pièces équipées), bonus (classe + spé + matériaux, surtout multiplicatifs),
// et total. Les trois composantes somment exactement au total affiché.
export function getStatDetails(state) {
  const ch = state.character;
  const cls = getClass(ch.classId);
  const total = getDerivedStats(state);

  const base = {};
  for (const k of STAT_KEYS) base[k] = (cls.baseStats[k] || 0) + (cls.growth[k] || 0) * (ch.level - 1);

  const equip = { hp: 0, atk: 0, def: 0, spd: 0, crit: 0 };
  for (const slot of Object.keys(ch.equipment)) {
    const inst = ch.equipment[slot];
    if (!inst || !inst.stats) continue;
    const es = effectiveStats(inst);
    for (const k of Object.keys(es)) equip[k] = (equip[k] || 0) + es[k];
  }

  const nameMap = { hp: "maxHp", atk: "atk", def: "def", mag: "mag", res: "res", dex: "dex", acc: "acc", spd: "spd", crit: "crit", critDmg: "critDmg" };
  const details = {};
  for (const k of STAT_KEYS) {
    const tk = nameMap[k];
    const b = Math.round(base[k]);
    const e = Math.round(equip[k] || 0);
    const t = total[tk];
    details[tk] = { base: b, equip: e, bonus: t - b - e, total: t };
  }
  return details;
}

// --- Spécialisations ---

// Nœud d'arbre actif (= spécialisation/classe avancée équipée), ou null si profil
// de base. Résout d'abord l'arbre complet (getNode), puis retombe sur les 15
// spécialisations historiques (getSpec) pour toute compatibilité.
export function getActiveSpec(state) {
  const id = state.character.specId;
  if (!id) return null;
  const node = getNode(id) || getSpec(id);
  if (!node || node.base) return null; // un nœud de base = profil de base (aucun mod)
  // Sécurité : le nœud doit appartenir à la voie du personnage.
  return node.classId === state.character.classId ? node : null;
}

// Trait d'héritage externe actuellement équipé (un seul), ou null.
export function getEquippedHeritage(state) {
  const id = state.character && state.character.heritageTrait;
  return id ? getHeritageTrait(id) : null;
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

// Agrège les affixes de COMBAT des pièces équipées (Lot 13) : résistances
// élémentaires (cumulables, plafonnées à 60 %/élément), dégâts élémentaires
// bonus, et effets dynamiques (vol de vie, régén). Lu par buildPlayerCombatant.
export function gearCombatBonuses(state) {
  const resist = {}; // { element: réduction cumulée (0..0.6) }
  const elementDmg = {}; // { element: bonus de dégâts }
  const pp = {}; // { lifestealPct, hpRegenPct }
  for (const slot of Object.keys(state.character.equipment)) {
    const inst = state.character.equipment[slot];
    if (!inst || !inst.affixes) continue;
    for (const af of inst.affixes) {
      if (af.kind === "resist" && af.element) resist[af.element] = Math.min(0.6, (resist[af.element] || 0) + af.value);
      else if (af.kind === "elementDmg" && af.element) elementDmg[af.element] = (elementDmg[af.element] || 0) + af.value;
      else if (af.kind === "combat" && af.pp) pp[af.pp] = (pp[af.pp] || 0) + af.value;
    }
  }
  return { resist, elementDmg, pp };
}

// Élément de l'arme équipée (oriente les attaques sans élément propre). La main
// principale prime ; à défaut, l'arme de la main secondaire.
export function equippedWeaponElement(state) {
  const eq = state.character.equipment;
  return (eq.weapon && eq.weapon.element) || (eq.offhand && eq.offhand.element) || null;
}

// Une arme est-elle maniable par la classe du personnage ?
// On ne contrôle QUE les armes (slot weapon) ayant un type (`wtype`) ; les
// armures et accessoires restent universels. Sans liste `weapons` -> tout permis.
export function canWieldWeapon(state, tpl) {
  if (!tpl || tpl.slot !== "weapon" || !tpl.wtype) return true;
  const cls = getClass(state.character.classId);
  if (!cls || !cls.weapons) return true;
  if (cls.weapons.includes(tpl.wtype)) return true;
  // Les nœuds hybrides autorisent des armes supplémentaires (Lame runique : wand…).
  const node = getActiveSpec(state);
  return !!(node && node.addWeapons && node.addWeapons.includes(tpl.wtype));
}

// Une arme à deux mains occupe-t-elle actuellement la main principale ?
function mainHandIsTwoHanded(state) {
  const w = state.character.equipment.weapon;
  const t = w ? getEquipment(w.baseId) : null;
  return !!t && weaponHand(t.wtype) === "two";
}

// Équipe une instance (par uid) depuis l'inventaire. `preferredSlot` (optionnel)
// permet de choisir la main pour une arme à une main : "weapon" (main droite) ou
// "offhand" (main gauche). Renvoie { ok, error, name, slot }.
export function equip(state, uid, preferredSlot = null) {
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

  const eq = state.character.equipment;
  const displaced = []; // pièces renvoyées à l'inventaire (slot libéré par incompatibilité)
  let slot = tpl.slot;

  if (tpl.slot === "weapon") {
    // Routage main principale / secondaire selon le maniement de l'arme.
    const hand = weaponHand(tpl.wtype);
    if (hand === "two") {
      slot = "weapon"; // occupe les deux mains : on libère la main gauche
      if (eq.offhand) { displaced.push(eq.offhand); eq.offhand = null; }
    } else if (hand === "off") {
      slot = "offhand"; // bouclier : main gauche uniquement
      if (mainHandIsTwoHanded(state)) { displaced.push(eq.weapon); eq.weapon = null; }
    } else {
      // Arme à une main : main droite par défaut, main gauche si demandé/libre.
      if (preferredSlot === "offhand") slot = "offhand";
      else if (preferredSlot === "weapon") slot = "weapon";
      else if (!eq.weapon) slot = "weapon";
      else if (!eq.offhand && !mainHandIsTwoHanded(state)) slot = "offhand";
      else slot = "weapon";
      // Poser une arme en main gauche est incompatible avec une 2 mains en main droite.
      if (slot === "offhand" && mainHandIsTwoHanded(state)) { displaced.push(eq.weapon); eq.weapon = null; }
    }
  } else if (tpl.slot === "accessory") {
    // Les accessoires ont DEUX emplacements ; le 2e se débloque en battant un boss.
    const second = accessory2Unlocked(state);
    if (!eq.accessory) slot = "accessory";
    else if (second && !eq.accessory2) slot = "accessory2";
    else slot = "accessory"; // les deux pleins (ou 2e verrouillé) -> remplace le 1er
  }

  const previous = eq[slot];

  // Retire de l'inventaire, place dans le slot, rend l'ancien + les déplacés.
  removeEquipmentInstance(uid);
  eq[slot] = inst;
  if (previous) displaced.push(previous);
  for (const p of displaced) if (p) addEquipmentInstance(p);

  clampHp(state);
  return { ok: true, name: tpl.name, slot };
}

// Le 2e emplacement d'accessoire est-il débloqué ? (un boss vaincu).
export function accessory2Unlocked(state) {
  return !!(state.flags && state.flags.bossDefeated) || (state.counters && state.counters.bossKills > 0);
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
