// Système de familiers (Lot 16 — refonte « combattants »). Éclosion d'œufs,
// collection, équipement, lien, nourrissage (Essence), XP plafonnée au héros.
//
// NOUVEAU : un familier équipé est un COMBATTANT sur le terrain (sans PV, ni tué
// ni ciblé) qui agit chaque tour via sa PROPRE IA et ses PROPRES compétences.
// Plus d'étoiles -> plus fort + plus de compétences. Valeurs MODÉRÉES et
// plafonnées : un familier épaule, il ne gagne pas le combat à ta place.

import {
  getFamiliar, familiarsByRarity, getEgg, FEED_ESSENCE_COST, LINK_MAX, FAMILIAR_REGEN_CAP,
  familiarStars, familiarUsableSkills,
} from "../data/familiars.js";
import { getFamSkill } from "../data/famskills.js";
import { getSummon } from "../data/summons.js";
import { familiarXpAt } from "../data/curves.js";
import { applyXp } from "../core/progression.js";

const ESSENCE_BY_RARITY = { common: 1, uncommon: 2, rare: 4, epic: 8, legendary: 15 };

// Mise à l'échelle de combat des familiers (plafonnée : bonus de niveau/lien bornés).
const ATK_BASE = { common: 7, uncommon: 9, rare: 12, epic: 15, legendary: 19 };
const SPD_BASE = { common: 9, uncommon: 10, rare: 11, epic: 12, legendary: 13 };
const CRIT_BASE = { common: 4, uncommon: 5, rare: 6, epic: 8, legendary: 10 };

export function ensureFamiliars(state) {
  if (!state.familiars) state.familiars = { owned: {}, eggs: {}, equipped: null, essence: 0 };
  const f = state.familiars;
  if (!f.owned) f.owned = {};
  if (!f.eggs) f.eggs = {};
  if (f.essence == null) f.essence = 0;
  if (f.equipped === undefined) f.equipped = null;
  return f;
}

export function ownedCount(state) {
  return Object.keys(ensureFamiliars(state).owned).length;
}

export function addEgg(state, eggId, n = 1) {
  const f = ensureFamiliars(state);
  f.eggs[eggId] = (f.eggs[eggId] || 0) + n;
}

export function rollFamiliar(eggId) {
  const egg = getEgg(eggId);
  if (!egg) return null;
  const weights = egg.weights;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let rarity = Object.keys(weights)[0];
  for (const k of Object.keys(weights)) {
    if (r < weights[k]) { rarity = k; break; }
    r -= weights[k];
  }
  const pool = familiarsByRarity(rarity);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export function hatchEgg(state, eggId) {
  const f = ensureFamiliars(state);
  if (!(f.eggs[eggId] > 0)) return { ok: false, error: "Aucun œuf de ce type." };
  const id = rollFamiliar(eggId);
  if (!id) return { ok: false, error: "Éclosion impossible." };
  f.eggs[eggId] -= 1;
  const fam = getFamiliar(id);
  if (f.owned[id]) {
    const gain = ESSENCE_BY_RARITY[fam.rarity] || 1;
    f.essence += gain;
    return { ok: true, id, familiar: fam, duplicate: true, essenceGain: gain };
  }
  f.owned[id] = { level: 1, xp: 0, link: 0 };
  if (!f.equipped) f.equipped = id;
  return { ok: true, id, familiar: fam, duplicate: false, essenceGain: 0 };
}

export function equipFamiliar(state, id) {
  const f = ensureFamiliars(state);
  if (!f.owned[id]) return { ok: false, error: "Familier non possédé." };
  f.equipped = f.equipped === id ? null : id;
  return { ok: true, equipped: f.equipped };
}

export function feedFamiliar(state, id) {
  const f = ensureFamiliars(state);
  const o = f.owned[id];
  if (!o) return { ok: false, error: "Familier non possédé." };
  if (o.link >= LINK_MAX) return { ok: false, error: "Lien déjà au maximum." };
  if (f.essence < FEED_ESSENCE_COST) return { ok: false, error: `Essence insuffisante (${f.essence}/${FEED_ESSENCE_COST}).` };
  f.essence -= FEED_ESSENCE_COST;
  o.link = Math.min(LINK_MAX, o.link + 1);
  return { ok: true, link: o.link };
}

export function familiarLevelCap(state) {
  return state.character.level;
}

export function gainEquippedFamiliarXp(state, amount) {
  const f = ensureFamiliars(state);
  if (!f.equipped) return { levels: 0 };
  const o = f.owned[f.equipped];
  if (!o) return { levels: 0 };
  const cap = familiarLevelCap(state);
  let levels = 0;
  if (o.level < cap) {
    const before = o.level;
    applyXp(o, amount, familiarXpAt);
    if (o.level >= cap) { o.level = cap; o.xp = 0; }
    levels = o.level - before;
  }
  if (o.link < LINK_MAX && Math.random() < 0.34) o.link = Math.min(LINK_MAX, o.link + 1);
  return { levels, id: f.equipped };
}

// =====================================================================
// COMBATTANT FAMILIER (sur le terrain)
// =====================================================================

// Stats de combat d'un familier (plafonnées par rapport au héros : il ne peut pas
// dominer seul). Renvoie { atk, spd, crit, stars }.
export function familiarCombatStats(fam, owned, heroLevel) {
  const rarity = fam.rarity;
  const level = Math.min(owned.level || 1, heroLevel || 1);
  const stars = familiarStars(fam, owned);
  const link = owned.link || 0;
  let atk = (ATK_BASE[rarity] || 6) + level * 0.7 + stars * 2 + link * 0.5;
  // Plafond DUR : un familier reste un soutien (jamais plus fort que le héros).
  atk = Math.min(atk, (heroLevel || 1) * 2.4 + 25);
  const spd = (SPD_BASE[rarity] || 10) + stars;
  const crit = (CRIT_BASE[rarity] || 5) + link * 0.4;
  return { atk: Math.max(1, Math.round(atk)), spd: Math.round(spd), crit: Math.round(crit), stars };
}

// Crée l'objet combattant ALLIÉ d'un familier (ou null si aucun familier équipé).
export function buildFamiliarCombatant(state) {
  const f = ensureFamiliars(state);
  if (!f.equipped) return null;
  const fam = getFamiliar(f.equipped);
  const owned = f.owned[f.equipped];
  if (!fam || !owned) return null;
  const heroLevel = state.character.level;
  const cs = familiarCombatStats(fam, owned, heroLevel);
  const skills = familiarUsableSkills(fam, cs.stars).map((s) => s.id);
  return makeAlly("familiar", {
    id: fam.id, name: fam.name, element: fam.element, role: fam.role,
    sprite: fam.sprite, image: fam.image,
    atk: cs.atk, spd: cs.spd, crit: cs.crit, stars: cs.stars, level: owned.level, link: owned.link,
    skills, ttl: Infinity,
  });
}

// Crée un combattant ALLIÉ d'INVOCATION (mise à l'échelle sur la Magie/niveau du
// héros). `player` = combattant joueur déjà construit.
export function buildSummonCombatant(summonId, player, heroLevel) {
  const sm = getSummon(summonId);
  if (!sm) return null;
  let atk = sm.atkBase + (heroLevel || 1) * (sm.atkPerLevel || 0) + (player.mag || 0) * (sm.atkPerMag || 0);
  atk = Math.min(atk, (heroLevel || 1) * 2.6 + 30); // plafonné comme les familiers
  return makeAlly("summon", {
    id: sm.id, name: sm.name, element: sm.element, role: sm.role, sprite: sm.sprite,
    atk: Math.max(1, Math.round(atk)), spd: sm.spd || 10, crit: sm.crit || 5,
    skills: [...sm.skills], ttl: sm.ttl,
  });
}

// Fabrique l'objet allié minimal compatible avec dealDamage/applyState du moteur.
function makeAlly(kind, o) {
  return {
    kind, ally: true,
    id: o.id, name: o.name, element: o.element || null, role: o.role || null,
    sprite: o.sprite || null, image: o.image || null,
    atk: o.atk, spd: Math.max(1, o.spd), crit: o.crit || 0, critDmg: 60,
    mag: 0, mres: 0, dex: 0, acc: 10 + (o.level || 1),
    skills: o.skills || [], stars: o.stars || 0, level: o.level || 1, link: o.link || 0,
    cooldowns: {}, buffs: [], pp: {}, phaseAtkPct: 0,
    ttl: o.ttl == null ? Infinity : o.ttl,
    nextAt: 0,
  };
}

// IA d'un allié : choisit la meilleure compétence selon la situation du combat.
// (Le familier « choisit de faire » son action — il n'est pas piloté par le joueur.)
export function chooseFamiliarSkill(ally, combat) {
  const ready = (id) => !(ally.cooldowns[id] > 0);
  const usable = (ally.skills || []).filter(ready);
  if (!usable.length) return ally.skills[0] || null;
  const player = combat.player;
  const enemy = combat.enemy;
  let best = usable[0];
  let bestScore = -Infinity;
  for (const id of usable) {
    const s = getFamSkill(id);
    if (!s) continue;
    let sc = s.ai || 1;
    if (s.heroHeal && player) sc += (1 - player.hp / player.maxHp) * 6;
    if (s.cleanse && player && player.dots.length) sc += 4;
    if (s.heroGuard && player && player.guardMax > 0 && player.guardPool < player.guardMax * 0.6) sc += 3;
    if (s.heroMana && player && player.res && player.res.cur < player.res.max * 0.5) sc += 3;
    if (s.heroBuff && player && player.buffs.some((b) => b.type === s.heroBuff.type)) sc -= 4;
    if (s.state && enemy && enemy.states.some((st) => st.id === s.state)) sc -= 3;
    if (s.enemyDebuff && enemy && enemy.buffs.some((b) => b.type === s.enemyDebuff.type)) sc -= 2;
    if (s.antibuff && enemy && !enemy.buffs.some((b) => /buff/.test(b.type))) sc -= 6;
    sc += Math.random() * 0.5;
    if (sc > bestScore) { bestScore = sc; best = id; }
  }
  return best;
}

// Plafond de soin de familier (réexporté pour le moteur/les tests).
export { FAMILIAR_REGEN_CAP };
