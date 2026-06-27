// Moteur de combat tour par tour avec INITIATIVE basée sur la vitesse.
//
// Chaque combattant possède une « date d'action virtuelle » (nextAt). Le plus
// petit nextAt agit. Après une action, nextAt += SPEED_UNIT / vitesse. Un
// personnage rapide agit donc plus souvent ; max 2 actions consécutives.
//
// Le joueur garde le contrôle : chaque clic = UNE de ses actions. resolveRound
// exécute l'action du joueur puis fait jouer l'ennemi tant que c'est son tour
// (≤ 2 d'affilée). À la fin, c'est de nouveau au joueur.

import { getEnemy } from "../data/enemies.js";
import { getSkill, deriveSkillTags } from "../data/skills.js";
import { getClass } from "../data/classes.js";
import { getEquipment } from "../data/equipment.js";
import { getResource } from "../data/resources.js";
import { getDerivedStats, gainCharXp, clampHp, getActiveSpec, getEquippedHeritage, activeMaterialBehaviors, familyCounts, gearCombatBonuses, equippedWeaponElement } from "../core/character.js";
import { MATERIAL_BEHAVIOR } from "../data/materials.js";
import { getState as getStateDef } from "../data/states.js";
import { ELEMENT_ORDER } from "../data/elements.js";
import { getClassResource } from "../data/classResources.js";
import { effectiveFamiliarPassive, gainEquippedFamiliarXp, addEgg } from "./familiars.js";
import { combatActiveSkills, isOffPathSkill, OFF_PATH_POWER_MULT, gainMasteryOnWin } from "./classtree.js";
import { getEgg } from "../data/familiars.js";
import { rollAmount } from "../core/progression.js";
import { addGold, addResource, addEquipmentInstance } from "../core/state.js";
import { makeInstance, rollRarity, enemyLuck, rollGearDrop } from "../core/items.js";

// --- Constantes d'équilibrage (modifiables ici) ---
export const DEF_K = 90; // softcap de défense : réduction = def/(def+K)
export const DEF_CAP = 0.75; // réduction max (jamais 0 dégât permanent)
export const CRIT_MULT = 1.6; // multiplicateur de dégâts critiques
export const SPEED_UNIT = 100; // unité d'initiative ; nextAt += UNIT/vitesse
export const MAX_CONSEC = 2; // actions consécutives maximum

// Réduction de recharge liée à la Clairvoyance (clé moteur `spd`) : faible et
// PLAFONNÉE (20 % max). Réf. 10 -> aucune réduction ; au-delà, réduction progressive.
export const CD_SPEED_REF = 10;
export const CD_MIN_FACTOR = 0.8; // au plus -20 % de recharge
export function cdFactor(spd) {
  return Math.max(CD_MIN_FACTOR, 1 - Math.max(0, spd - CD_SPEED_REF) / 100);
}

// --- Esquive : Dextérité (défenseur) contre Précision (attaquant) ------------
// Rendement décroissant, PLAFOND DUR à 60 % (instr. 51-52) : atteindre le plafond
// exige un build de très haut niveau entièrement tourné vers l'esquive (instr. 53),
// et la Précision adverse fait baisser l'esquive (aucun build n'est invincible).
export const DODGE_CAP = 0.6;
export const DODGE_K = 200; // échelle des rendements décroissants
export const ACC_FACTOR = 0.85; // poids de la Précision adverse contre la Dextérité
export function dodgeChance(dex, acc) {
  const net = Math.max(0, (dex || 0) - (acc || 0) * ACC_FACTOR);
  const raw = net / (net + DODGE_K);
  // Garde-fou : une valeur non finie (Dextérité infinie) sature au plafond.
  return Math.min(DODGE_CAP, Number.isFinite(raw) ? raw : DODGE_CAP);
}

// --- Critique : plafonds (instr. 92-95) --------------------------------------
// La part venant de la STAT est plafonnée à 50 %. Les bonus de compétence et
// buffs peuvent pousser plus haut (passifs spécialisés) sans jamais garantir le
// critique (plafond dur < 100 %).
export const BASE_CRIT_CAP = 50;
export const HARD_CRIT_CAP = 85;
// Dégâts critiques : multiplicateur = 1 + critDmg%/100, plafonné globalement.
export const CRIT_DMG_DEFAULT = 60; // ×1,6 (rétro-compatible avec l'ancien CRIT_MULT)
export const CRIT_DMG_CAP = 150; // au plus ×2,5
export function critMultOf(c) {
  let cd = c && Number.isFinite(c.critDmg) ? c.critDmg : CRIT_DMG_DEFAULT;
  // Passif de nœud : Dégâts critiques bonus (plafonné globalement par CRIT_DMG_CAP).
  if (c && c.pp && c.pp.critDmgBonus) cd += c.pp.critDmgBonus;
  cd = Math.min(CRIT_DMG_CAP, cd);
  return 1 + Math.max(0, cd) / 100;
}
// Chance de critique effective : la part venant de la STAT est plafonnée à 50 %,
// les bonus de compétence/buffs peuvent dépasser, plafond dur < 100 %.
export function critChanceOf(attacker, critBonus = 0, buffCrit = 0) {
  const cc = Math.min(BASE_CRIT_CAP, attacker.crit || 0) + (critBonus || 0) + (buffCrit || 0);
  return Math.min(HARD_CRIT_CAP, cc);
}

// --- Résistance / Magie : axe MAGIQUE (compétences à élément) -----------------
// Résistance = parallèle à la Défense, mais pour les dégâts élémentaires (instr.
// 38, 88). Magie = amplifie les compétences à élément, rendement décroissant et
// plafonné (instr. 37, 87). Les compétences SANS élément restent purement
// physiques (atk/def) : l'axe magique ne perturbe pas leur calcul.
export const RES_K = 220;
export const RES_CAP = 0.6;
export function resReduction(res) {
  return Math.min(RES_CAP, Math.max(0, res || 0) / ((res || 0) + RES_K));
}
export const MAG_K = 500;
export const MAG_CAP = 0.4;
export function magBonus(mag) {
  return Math.min(MAG_CAP, Math.max(0, mag || 0) / MAG_K);
}

// --- Garde : réserve défensive numérique (instr. 71-85) ----------------------
// Réserve SÉPARÉE des PV et de la Défense. Quand la Garde est ACTIVE, une part
// des dégâts (35 % par défaut, plafonnée à 80 %) est redirigée vers la réserve ;
// la réserve épuisée, la Garde active prend fin (rupture). Le maximum dépend du
// niveau, de la Défense et de la CLASSE (le Gardien en a beaucoup plus).
export const GUARD_ABSORB_MIN = 0.35;
export const GUARD_ABSORB_MAX = 0.8;
export const GUARD_BY_CLASS = {
  guardian: { base: 60, per: 3 },
  warrior: { base: 30, per: 2 },
  archer: { base: 16, per: 1.1 },
  mage: { base: 14, per: 1.0 },
  assassin: { base: 16, per: 1.1 },
};
export function guardMaxFor(classId, level, def) {
  const k = GUARD_BY_CLASS[classId] || { base: 18, per: 1.2 };
  return Math.max(0, Math.round(k.base + k.per * Math.max(0, (level || 1) - 1) + (def || 0) * 0.4));
}
export function clampAbsorb(a) {
  return Math.min(GUARD_ABSORB_MAX, Math.max(GUARD_ABSORB_MIN, Number.isFinite(a) ? a : GUARD_ABSORB_MIN));
}
// Calcule l'absorption d'une réserve de Garde active (pure, testable). Renvoie la
// part absorbée, les dégâts restants pour les PV, la réserve restante et si la
// Garde casse (réserve épuisée -> rupture, instr. 76-77).
export function guardAbsorb(guardActive, guardPool, dmg) {
  if (!guardActive || guardPool <= 0 || dmg <= 0) return { toGuard: 0, remaining: dmg, pool: guardPool, broken: false };
  const toGuard = Math.min(guardPool, Math.round(dmg * clampAbsorb(guardActive.absorb)));
  const pool = guardPool - toGuard;
  return { toGuard, remaining: dmg - toGuard, pool, broken: pool <= 0 };
}

function makeCombatant(name, stats, skillIds, passiveId) {
  const passive = passiveId ? getSkill(passiveId) : null;
  return {
    name,
    maxHp: stats.maxHp,
    hp: stats.hp != null ? stats.hp : stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd, // spd = Clairvoyance (clé moteur historique)
    crit: stats.crit,
    mag: stats.mag != null ? stats.mag : 0,
    // mres = Résistance (mitigation magique). Nom DISTINCT de `res` ci-dessous,
    // qui est la RESSOURCE DE CLASSE (Mana/Rage/…). Ne pas confondre.
    mres: stats.mres != null ? stats.mres : 0,
    dex: stats.dex != null ? stats.dex : 0,
    acc: stats.acc != null ? stats.acc : 0,
    critDmg: stats.critDmg != null ? stats.critDmg : CRIT_DMG_DEFAULT,
    skills: skillIds || [],
    passive: passiveId || null,
    pp: (passive && passive.passive) || {}, // bonus de passive utiles EN combat
    buffs: [], // [{ type:'atk_buff'|'def_buff'|'atk_debuff'|'slow', amount, turns }]
    dots: [], // [{ type:'poison'|'bleed', dmg, turns }]
    states: [], // états élémentaires [{ id, turns, stacks, dotDmg }]
    resist: {}, // résistances élémentaires { element: facteur } (1 = neutre)
    shield: 0,
    shieldTurns: 0,
    guard: null, // brace : réduit la PROCHAINE attaque reçue { reduce, turns }
    // Garde-réserve (instr. 71-85) — séparée des PV et de la Défense.
    guardMax: stats.guardMax || 0,
    guardPool: stats.guardPool != null ? stats.guardPool : stats.guardMax || 0,
    guardActive: null, // { turns, absorb } quand la Garde redirige les dégâts
    cooldowns: {},
    res: null, // ressource de classe { id, name, color, icon, cur, max, gen } — joueur seulement
    nextAt: 0,
  };
}

// Gain de ressource de classe selon une règle (`onBasicAttack`, `onDealDamage`,
// `onTakeDamage`, `onCrit`, `onGuardAbsorb`, `onDefensiveSkill`, `regenPerTurn`).
// Sans effet si le combattant n'a pas de ressource (ennemis).
function gainResource(c, key, mult = 1) {
  if (!c.res) return;
  const amt = (c.res.gen[key] || 0) * mult;
  if (amt <= 0) return;
  c.res.cur = Math.min(c.res.max, Math.round(c.res.cur + amt));
}

// --- États élémentaires : agrégations lues par le moteur ---------------------
// Multiplicateur de dégâts subis par `target` pour un élément donné (résistances
// + vulnérabilités d'état + « +X % de dégâts subis »).
function incomingMultiplier(target, element) {
  let m = 1;
  if (element && target.resist && target.resist[element] != null) m *= target.resist[element];
  for (const st of target.states) {
    const d = getStateDef(st.id);
    if (!d) continue;
    if (d.damageTakenPct) m *= 1 + d.damageTakenPct;
    if (d.vuln && element && d.vuln[element] != null) m *= 1 + d.vuln[element];
  }
  return Math.max(0, m);
}
function stateSlow(c) {
  let s = 0;
  for (const st of c.states) {
    const d = getStateDef(st.id);
    if (d && d.slow) s += d.slow;
  }
  return s;
}
function stateNoRegen(c) {
  return c.states.some((st) => getStateDef(st.id)?.noRegen);
}
function healingMult(c) {
  let m = 1;
  for (const st of c.states) {
    const d = getStateDef(st.id);
    if (d && d.healingTakenMod) m += d.healingTakenMod;
  }
  return Math.max(0, m);
}

// Applique (ou rafraîchit / cumule) un état élémentaire sur la cible.
function applyState(combat, target, stateId, sourceAtk, who) {
  const def = getStateDef(stateId);
  if (!def) return;
  const max = def.maxStacks || 1;
  let entry = target.states.find((s) => s.id === stateId);
  const dotDmg = def.dot ? Math.max(1, Math.round(sourceAtk * def.dot.pctAtk)) : 0;
  if (!entry) {
    entry = { id: stateId, turns: def.duration, stacks: 1, dotDmg };
    target.states.push(entry);
  } else {
    entry.turns = def.duration;
    entry.stacks = Math.min(max, entry.stacks + 1);
    if (dotDmg) entry.dotDmg = dotDmg;
  }
  log(combat, `${target.name} subit ${def.name}${entry.stacks > 1 ? ` ×${entry.stacks}` : ""}.`, who);

  // Décharge (Foudre) : au seuil de cumul, éclate en dégâts puis se dissipe.
  if (def.charge && entry.stacks >= def.charge.dischargeAt) {
    const dmg = Math.max(1, Math.round(sourceAtk * def.charge.pctAtk));
    target.hp = Math.max(0, target.hp - dmg);
    combat.lastFx.push({ target: target === combat.enemy ? "enemy" : "player", dmg, crit: false, dot: true });
    log(combat, `Décharge ! ${target.name} subit ${dmg} dégâts de Foudre.`, who);
    target.states = target.states.filter((s) => s !== entry);
  }
}

// Fusionne des bonus de passive dans le « pp » d'un combattant.
// - champs numériques (lifestealPct, hpRegenPct, skillPowerPct...) : additionnés.
// - champs objet (lowHpAtk, execute, vsDebuff) : conservés si absents, sinon
//   on garde le meilleur bonus.
function mergePp(pp, extra) {
  for (const k of Object.keys(extra)) {
    const v = extra[k];
    if (typeof v === "number") pp[k] = (pp[k] || 0) + v;
    else if (v && typeof v === "object") {
      if (!pp[k]) pp[k] = { ...v };
      else if ((v.bonus || 0) > (pp[k].bonus || 0)) pp[k] = { ...v };
    }
  }
  return pp;
}

// Construit le combattant JOUEUR à partir de l'état (stats dérivées, kit de
// classe + spécialisation, ressource de classe, passifs de matériaux, résistance
// du Tissu). Extrait pour être réutilisé par le simulateur d'équilibrage (Lot 9).
export function buildPlayerCombatant(state) {
  const ds = getDerivedStats(state);
  const cls = getClass(state.character.classId);
  const spec = getActiveSpec(state);
  // Kit actif = bibliothèque emportée (loadout) ou kit naturel (voie + nœud) par
  // défaut. Compétences HORS-VOIE marquées (puissance réduite, instr. compétences).
  const activeKit = combatActiveSkills(state);
  const player = makeCombatant(
    state.character.name,
    { maxHp: ds.maxHp, hp: Math.max(1, Math.round(state.character.hpCurrent)), atk: ds.atk, def: ds.def, spd: ds.spd, crit: ds.crit, mag: ds.mag, mres: ds.res, dex: ds.dex, acc: ds.acc, critDmg: ds.critDmg, guardMax: guardMaxFor(state.character.classId, state.character.level, ds.def) },
    ["basic_attack", ...activeKit],
    cls.passive
  );
  player.offPath = new Set(activeKit.filter((id) => isOffPathSkill(state, id)));
  // Passive de spécialisation/nœud : fusionnée aux effets de combat de la classe.
  if (spec && spec.passive) mergePp(player.pp, spec.passive);

  // Garde-réserve permanente modifiée par le nœud (Bastion, Roi-bastion…).
  if (spec && spec.guardMaxPct && player.guardMax > 0) {
    player.guardMax = Math.round(player.guardMax * (1 + spec.guardMaxPct));
    player.guardPool = player.guardMax;
  }

  // Ressource de classe (Lot 8) : transitoire au combat, jamais persistée. Un
  // nœud peut moduler la réserve (Apostat : Mana max réduit -> risque réel).
  const resDef = getClassResource(state.character.classId);
  if (resDef) {
    const rmod = (spec && spec.resource) || {};
    const max = Math.max(1, Math.round(resDef.max * (1 + (rmod.maxPct || 0))));
    const start = Math.min(max, Math.round((resDef.start || 0) * (1 + (rmod.startPct || 0))));
    player.res = {
      id: resDef.id, name: resDef.name, color: resDef.color, icon: resDef.icon,
      cur: start, max,
      gen: resDef, // les règles de gain sont lues directement depuis la définition
    };
  }

  // Trait d'héritage externe (Lot 15) — effets de combat mineurs (les statMods
  // sont déjà intégrés aux stats dérivées). Garde-réserve / réserve de ressource.
  const heritage = getEquippedHeritage(state);
  if (heritage) {
    if (heritage.guardMaxPct && player.guardMax > 0) {
      player.guardMax = Math.round(player.guardMax * (1 + heritage.guardMaxPct));
      player.guardPool = player.guardMax;
    }
    if (heritage.resource && heritage.resource.startPct && player.res) {
      player.res.cur = Math.min(player.res.max, Math.round(player.res.cur * (1 + heritage.resource.startPct)));
    }
    if (heritage.passive) mergePp(player.pp, heritage.passive);
  }

  // Passifs comportementaux des matériaux d'armure (4 pièces).
  const behaviors = new Set(activeMaterialBehaviors(state));
  player.mat = {
    stability: behaviors.has("stabilite"),
    evasionPct: behaviors.has("souplesse") ? MATERIAL_BEHAVIOR.souplesse.evasionPct : 0,
    concentration: behaviors.has("concentration"),
  };
  player._distinct = new Set();
  player._concReady = false;
  player._stabilityUsed = false;

  // Résistances élémentaires du joueur : le Tissu protège de TOUS les éléments
  // (légère résistance générique), les affixes « resist » protègent d'un élément
  // PRÉCIS (cumulables = défense ciblée -> un build oriente le combat).
  const clothCount = familyCounts(state).cloth || 0;
  const clothResist = Math.min(0.3, clothCount * 0.06);
  const gear = gearCombatBonuses(state);
  for (const el of ELEMENT_ORDER) {
    const affixResist = gear.resist[el] || 0;
    const total = Math.min(0.7, clothResist + affixResist); // plafond global 70 %
    if (total > 0) player.resist[el] = (player.resist[el] != null ? player.resist[el] : 1) * (1 - total);
  }

  // Élément de l'arme : les attaques sans élément propre prennent celui de l'arme.
  player.weaponElement = equippedWeaponElement(state);

  // Dégâts élémentaires bonus (affixes) — combinés au familier plus bas.
  player.elementDmg = { ...gear.elementDmg };

  // Effets de combat issus des affixes (vol de vie, régén).
  if (gear.pp && Object.keys(gear.pp).length) mergePp(player.pp, gear.pp);

  // Familier équipé (Lot 11) : SOUTIEN LÉGER appliqué au héros en combat.
  const fam = effectiveFamiliarPassive(state);
  if (fam) {
    const p = fam.passive || {};
    if (p.maxHpPct) {
      player.maxHp = Math.round(player.maxHp * (1 + p.maxHpPct));
      player.hp = Math.min(player.maxHp, player.hp);
    }
    if (p.critFlat) player.crit += p.critFlat;
    if (p.spdPct) player.spd = Math.max(1, player.spd * (1 + p.spdPct));
    // Renfort de la Garde-réserve (rôle protecteur unique du Pétroglyphe, instr. 294).
    if (p.guardMaxPct && player.guardMax > 0) {
      player.guardMax = Math.round(player.guardMax * (1 + p.guardMaxPct));
      player.guardPool = player.guardMax;
    }
    const ppAdd = {};
    for (const k of ["skillPowerPct", "lifestealPct", "hpRegenPct"]) if (p[k]) ppAdd[k] = p[k];
    if (Object.keys(ppAdd).length) mergePp(player.pp, ppAdd);
    if (p.elementDmgPct) for (const el of Object.keys(p.elementDmgPct)) player.elementDmg[el] = (player.elementDmg[el] || 0) + p.elementDmgPct[el];
    player.familiar = { id: fam.id, sprite: fam.sprite, image: fam.image, element: fam.element, role: fam.role, level: fam.level, link: fam.link };
  }

  return player;
}

// Ennemi/boss ENRAGÉ : rare, mais +50 % à toutes les stats et meilleures
// récompenses (inspiré des mobs enragés de certains idle RPG).
export const ENRAGE_CHANCE = 0.02; // ~2 %
export const ENRAGE_MULT = 1.5;
export const ENRAGE_REWARD_MULT = 2;

export function startCombat(state, enemyId, opts = {}) {
  const enemy = getEnemy(enemyId);
  if (!enemy) return null;

  const player = buildPlayerCombatant(state);
  // Action « Défendre » disponible pour TOUTES les classes en combat réel (instr.
  // 78, 80). Ajoutée ici (pas dans buildPlayerCombatant) : les duels d'équilibrage
  // appellent buildPlayerCombatant directement -> aucun impact sur l'équilibrage.
  if (!player.skills.includes("defend")) player.skills.push("defend");
  // Le Gardien commence avec la Garde active plusieurs tours (instr. 79).
  if (state.character.classId === "guardian") player.guardActive = { turns: 3, absorb: 0.45 };

  // Les ennemis ne déclarent que hp/atk/def/spd/crit : on DÉRIVE les nouvelles
  // stats (mag/res/dex/acc/critDmg) à partir de leur fiche, avec possibilité de
  // surcharge explicite par ennemi (forward-compatible, instr. 26-27).
  const es = enemy.stats;
  const e = makeCombatant(
    enemy.name,
    {
      maxHp: es.hp, atk: es.atk, def: es.def, spd: es.spd, crit: es.crit,
      mag: es.mag != null ? es.mag : Math.round(es.atk * 0.3),
      mres: es.res != null ? es.res : Math.round(es.def * 0.6),
      dex: es.dex != null ? es.dex : Math.round(es.spd * 0.55),
      acc: es.acc != null ? es.acc : Math.round(es.spd * 0.4 + es.crit * 0.4),
      critDmg: es.critDmg != null ? es.critDmg : CRIT_DMG_DEFAULT,
      // Garde-réserve ennemie (instr. 85) : dérivée de la Défense, plus grande
      // pour les boss/tanks. Surchargeable par enemy.stats.guard.
      guardMax: es.guard != null ? es.guard : Math.round(es.def * 1.2 + (enemy.isBoss ? 40 : enemy.role === "tank" ? 30 : 8)),
    },
    ["basic_attack", ...(enemy.skills || [])],
    enemy.passive || null
  );
  e.enemyId = enemy.id;
  e.icon = enemy.icon;
  e.image = enemy.image;
  e.sprite = enemy.sprite;
  e.isBoss = enemy.isBoss;
  e.role = enemy.role || null;
  e.resist = enemy.resist || {}; // résistances/vulnérabilités élémentaires

  // Seconde passive éventuelle (boss : 2 passives) — fusionnée dans pp.
  if (enemy.secondPassive) {
    const sp = getSkill(enemy.secondPassive);
    if (sp && sp.passive) mergePp(e.pp, sp.passive);
  }

  // Phases de boss (Lot 10) : règles qui changent sous des seuils de PV.
  e.phases = enemy.phases || [];
  e.phaseIdx = 0;
  e.phaseAtkPct = 0;
  e.phaseDefShred = 0;
  e.element = null; // élément des attaques sans élément propre (posé par les phases)
  e.phaseName = null;

  // Enragé : +50 % à toutes les stats. Forçable pour les tests :
  // `forceEnrage: true` force l'enrage, `forceEnrage: false` le désactive.
  e.enraged = false;
  const wantEnrage = opts.forceEnrage === true || (opts.forceEnrage !== false && Math.random() < ENRAGE_CHANCE);
  if (wantEnrage) {
    e.enraged = true;
    e.maxHp = Math.round(e.maxHp * ENRAGE_MULT);
    e.hp = e.maxHp;
    e.atk = Math.round(e.atk * ENRAGE_MULT);
    e.def = Math.round(e.def * ENRAGE_MULT);
    e.spd = Math.max(1, Math.round(e.spd * ENRAGE_MULT));
    e.crit = Math.round(e.crit * ENRAGE_MULT);
    e.mag = Math.round(e.mag * ENRAGE_MULT);
    e.mres = Math.round(e.mres * ENRAGE_MULT);
    e.dex = Math.round(e.dex * ENRAGE_MULT);
    e.acc = Math.round(e.acc * ENRAGE_MULT);
  }

  // Bestiaire : on note la rencontre (les résistances se révèlent après le combat).
  if (state.bestiary) {
    const b = state.bestiary[enemy.id] || (state.bestiary[enemy.id] = { seen: false, resistKnown: false });
    b.seen = true;
  }

  // Initiative de départ (instr. 61-62, 68) : la Clairvoyance ouvre le combat
  // (pas plus rapide = step plus court = agit plus tôt), avec une petite variation
  // aléatoire CONTRÔLÉE pour départager équitablement les égalités. La variation
  // reste assez faible pour qu'un gros investissement en Clairvoyance reste visible.
  player.nextAt = (SPEED_UNIT / effectiveSpd(player)) * Math.random() * 0.6;
  e.nextAt = (SPEED_UNIT / effectiveSpd(e)) * Math.random() * 0.6;

  const intro = e.enraged
    ? { text: `Un ${enemy.name} ENRAGÉ surgit ! Statistiques décuplées — récompenses accrues.`, kind: "enemy" }
    : { text: `Un ${enemy.name} surgit !`, kind: "info" };
  const combat = {
    enemyId,
    player,
    enemy: e,
    turn: 1,
    pConsec: 0,
    log: [intro],
    status: "active",
    rewards: null,
    lastFx: [],
    lastActions: [],
  };
  return combat;
}

function log(combat, text, kind = "info") {
  combat.log.push({ text, kind });
}

// --- Stats effectives (avec buffs/debuffs + passives de combat) ---
function sumBuff(c, type) {
  let s = 0;
  for (const b of c.buffs) if (b.type === type) s += b.amount;
  return s;
}
function effectiveAtk(c) {
  let mult = 1 + sumBuff(c, "atk_buff") - sumBuff(c, "atk_debuff");
  if (c.pp.lowHpAtk && c.hp / c.maxHp < c.pp.lowHpAtk.threshold) mult += c.pp.lowHpAtk.bonus;
  // Apostat : plus puissant à FAIBLE ressource (risque réel : sorts indisponibles).
  if (c.pp.lowResourceAtk && c.res && c.res.max > 0 && c.res.cur / c.res.max < c.pp.lowResourceAtk.threshold)
    mult += c.pp.lowResourceAtk.bonus;
  if (c.phaseAtkPct) mult += c.phaseAtkPct; // enrage de phase (boss)
  return Math.max(0.1, c.atk * mult);
}
function effectiveDef(c) {
  return Math.max(0, c.def * (1 + sumBuff(c, "def_buff")));
}
export function effectiveSpd(c) {
  return Math.max(1, c.spd * (1 + sumBuff(c, "spd_buff") - sumBuff(c, "slow") - stateSlow(c)));
}

function hasNegative(c) {
  return c.dots.length > 0 || c.buffs.some((b) => b.type === "atk_debuff" || b.type === "slow");
}

// Réduction de dégâts par la défense : rendements décroissants, plafonnée.
function defReduction(def) {
  return Math.min(DEF_CAP, def / (def + DEF_K));
}

function applyEffect(target, eff, sourceAtk, combat, who) {
  switch (eff.type) {
    case "atk_buff":
    case "def_buff":
    case "spd_buff":
    case "atk_debuff":
    case "slow":
      target.buffs.push({ type: eff.type, amount: eff.amount, turns: eff.turns });
      break;
    case "guard":
      target.guard = { reduce: eff.reduce, turns: eff.turns };
      break;
    case "guard_active": {
      // Active la Garde-réserve : redirige une part des dégâts (instr. 73-75).
      target.guardActive = { turns: eff.turns, absorb: clampAbsorb(eff.absorb) };
      log(combat, `${target.name} lève sa Garde.`, who);
      break;
    }
    case "guard_restore": {
      // Restaure de la Garde (instr. 78) — JAMAIS des PV (pas un soin déguisé, instr. 81).
      const amt = eff.pctMax ? Math.round(target.guardMax * eff.pctMax) : Math.round(eff.amount || 0);
      if (amt > 0 && target.guardMax > 0) {
        target.guardPool = Math.min(target.guardMax, target.guardPool + amt);
        log(combat, `${target.name} restaure ${amt} de Garde.`, who);
      }
      break;
    }
    case "shield": {
      const amt = Math.round(target.maxHp * eff.pctMaxHp);
      target.shield = Math.max(target.shield, amt);
      target.shieldTurns = eff.turns;
      log(combat, `${target.name} gagne un bouclier de ${amt} PV.`, who);
      break;
    }
    case "heal": {
      // Les soins reçus peuvent être réduits par un état (Brûlure).
      const amt = Math.round(target.maxHp * eff.pctMaxHp * healingMult(target));
      target.hp = Math.min(target.maxHp, target.hp + amt);
      log(combat, `${target.name} récupère ${amt} PV.`, who);
      break;
    }
    case "poison":
    case "bleed":
      target.dots.push({ type: eff.type, dmg: Math.max(1, Math.round(sourceAtk * eff.pctAtk)), turns: eff.turns });
      log(combat, `${target.name} est affecté par ${eff.type === "poison" ? "Poison" : "Saignement"}.`, who);
      break;
  }
}

// Calcule et applique les dégâts. opts: { skillId, critBonus, concBonus }.
function dealDamage(combat, attacker, defender, power, opts = {}) {
  // ESQUIVE (instr. 39-60) : Dextérité du défenseur contre Précision de
  // l'attaquant, + éventuelle Souplesse (Cuir 4 pièces), le tout PLAFONNÉ à 60 %.
  // Une esquive annule les dégâts directs (le coût/effet déjà payé reste payé).
  // `opts.unavoidable` : attaque rare explicitement marquée inévitable (instr. 58).
  if (!opts.unavoidable) {
    let pDodge = dodgeChance(defender.dex, attacker.acc);
    if (defender.mat && defender.mat.evasionPct > 0) pDodge += defender.mat.evasionPct / 100;
    pDodge = Math.min(DODGE_CAP, pDodge);
    if (pDodge > 0 && Math.random() < pDodge) {
      // Souplesse : esquiver accorde un petit bonus de critique (identité Cuir).
      if (defender.mat && defender.mat.evasionPct > 0) {
        const cfg = MATERIAL_BEHAVIOR.souplesse;
        defender.buffs.push({ type: "crit_buff", amount: cfg.critBuff, turns: cfg.critTurns });
      }
      log(combat, `${defender.name} esquive l'attaque.`, defender === combat.player ? "player" : "enemy");
      combat.lastFx.push({ target: defender === combat.enemy ? "enemy" : "player", dmg: 0, crit: false, evaded: true });
      return { dmg: 0, isCrit: false, evaded: true };
    }
  }

  let base = effectiveAtk(attacker) * power;

  // Passive : boost des compétences (hors attaque de base).
  if (opts.skillId && opts.skillId !== "basic_attack" && attacker.pp.skillPowerPct)
    base *= 1 + attacker.pp.skillPowerPct;
  // Concentration (Tissu, 4 pièces) : compétence renforcée après 2 compétences différentes.
  if (opts.concBonus) base *= 1 + opts.concBonus;
  // Passive : exécution (cible à faibles PV).
  if (attacker.pp.execute && defender.hp / defender.maxHp < attacker.pp.execute.threshold)
    base *= 1 + attacker.pp.execute.bonus;
  // Passive : bonus contre cible affaiblie (malus/DoT).
  if (attacker.pp.vsDebuff && hasNegative(defender)) base *= 1 + attacker.pp.vsDebuff.bonus;

  // Défense (rendements décroissants) — éventuellement percée par une phase de boss.
  const shred = attacker.phaseDefShred || 0;
  base *= 1 - defReduction(effectiveDef(defender) * (1 - shred));

  // Élément : résistances/vulnérabilités de la cible + états (Trempé, Exposé...).
  base *= incomingMultiplier(defender, opts.element || null);

  // Bonus de dégâts élémentaires (affixes d'arme/accessoire + familier).
  if (attacker.elementDmg && opts.element && attacker.elementDmg[opts.element])
    base *= 1 + attacker.elementDmg[opts.element];

  // Axe MAGIQUE (instr. 37-38, 87-88) : une attaque À ÉLÉMENT est amplifiée par
  // la Magie de l'attaquant et atténuée par la Résistance du défenseur (rendements
  // décroissants, plafonnés). Les attaques SANS élément restent purement physiques.
  if (opts.element) {
    base *= 1 + magBonus(attacker.mag);
    base *= 1 - resReduction(defender.mres);
  }

  base *= 0.9 + Math.random() * 0.2; // variance ±10 %
  // Chance critique plafonnée (voir critChanceOf) ; Dégâts critiques = critMultOf.
  const critChance = critChanceOf(attacker, opts.critBonus || 0, sumBuff(attacker, "crit_buff"));
  const isCrit = Math.random() * 100 < critChance;
  if (isCrit) base *= critMultOf(attacker);

  let dmg = Math.max(1, Math.round(base));

  // Garde : réduit la prochaine attaque reçue (consommée).
  if (defender.guard) {
    dmg = Math.max(1, Math.round(dmg * (1 - defender.guard.reduce)));
    defender.guard = null;
    gainResource(defender, "onGuardAbsorb"); // bloquer alimente la Garde
  }
  // Stabilité (Métal, 4 pièces) : la 1re attaque subie du combat est réduite.
  if (defender.mat && defender.mat.stability && !defender._stabilityUsed) {
    dmg = Math.max(1, Math.round(dmg * (1 - MATERIAL_BEHAVIOR.stabilite.reduce)));
    defender._stabilityUsed = true;
    log(combat, `${defender.name} encaisse le premier coup (Stabilité).`, defender === combat.player ? "player" : "enemy");
  }
  // GARDE-RÉSERVE active : redirige une part des dégâts vers la réserve (instr.
  // 73-77). La part absorbée est retirée de la réserve, le reste touchera les PV.
  // Réserve vidée -> la Garde active prend fin (rupture). Dégâts de Garde et de PV
  // sont journalisés SÉPARÉMENT (instr. 82).
  if (defender.guardActive && defender.guardPool > 0 && dmg > 0) {
    const g = guardAbsorb(defender.guardActive, defender.guardPool, dmg);
    if (g.toGuard > 0) {
      defender.guardPool = g.pool;
      dmg = g.remaining;
      gainResource(defender, "onGuardAbsorb");
      combat.lastFx.push({ target: defender === combat.enemy ? "enemy" : "player", dmg: g.toGuard, crit: false, guard: true });
      log(combat, `${defender.name} encaisse ${g.toGuard} sur sa Garde.`, defender === combat.player ? "player" : "enemy");
      if (g.broken) {
        defender.guardActive = null;
        log(combat, `La Garde de ${defender.name} est brisée !`, defender === combat.enemy ? "player" : "enemy");
      }
    }
  }
  // Bouclier : absorbe avant les PV.
  if (defender.shield > 0) {
    const absorbed = Math.min(defender.shield, dmg);
    defender.shield -= absorbed;
    dmg -= absorbed;
  }
  defender.hp = Math.max(0, defender.hp - dmg);

  // Ressource de classe : encaisser un coup et placer un critique en génèrent.
  if (dmg > 0) gainResource(defender, "onTakeDamage");
  if (isCrit) gainResource(attacker, "onCrit");

  // Vol de vie éventuel (spécialisations).
  if (attacker.pp.lifestealPct && dmg > 0) {
    const heal = Math.round(dmg * attacker.pp.lifestealPct);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
  }

  combat.lastFx.push({ target: defender === combat.enemy ? "enemy" : "player", dmg, crit: isCrit });
  return { dmg, isCrit };
}

function useSkill(combat, actor, other, skillId) {
  const skill = getSkill(skillId);
  if (!skill) return;
  const isPlayer = actor === combat.player;
  const kind = isPlayer ? "player" : "enemy";

  // Coût en ressource de classe (Lot 8) : déduit à l'usage. L'éligibilité est
  // déjà vérifiée en amont (playerCanUse / IA), on borne par sécurité.
  if (actor.res && skill.cost) actor.res.cur = Math.max(0, actor.res.cur - skill.cost);

  // Effets sur soi (buff, bouclier, garde, soin).
  if (skill.self) for (const eff of skill.self) applyEffect(actor, eff, actor.atk, combat, kind);

  // Concentration (Tissu) : la compétence est-elle renforcée ce tour ?
  let concBonus = 0;
  if (actor.mat && actor.mat.concentration && skill.power > 0 && actor._concReady) {
    concBonus = MATERIAL_BEHAVIOR.concentration.bonus;
    actor._concReady = false;
    actor._distinct.clear();
    log(combat, `${actor.name} libère sa Concentration : compétence renforcée !`, isPlayer ? "player" : "enemy");
  }

  // Dégâts (éventuellement multi-frappes).
  let landed = false;
  // Pénalité HORS-VOIE : une compétence apprise hors de la voie naturelle frappe
  // moins fort (affichée dans l'UI de la bibliothèque). Ne touche que le joueur.
  const powerMult = actor.offPath && actor.offPath.has(skillId) ? OFF_PATH_POWER_MULT : 1;
  if (skill.power > 0) {
    const hits = skill.hits || 1;
    let total = 0;
    let anyCrit = false;
    // Multi-frappes : la puissance est déjà répartie par frappe dans les données
    // (instr. 96). Chaque frappe vérifie SÉPARÉMENT l'esquive et le critique.
    for (let i = 0; i < hits && other.hp > 0; i++) {
      const r = dealDamage(combat, actor, other, skill.power * powerMult, { skillId, critBonus: skill.critBonus || 0, concBonus, element: skill.element || actor.weaponElement || actor.element || null, unavoidable: skill.unavoidable });
      total += r.dmg;
      anyCrit = anyCrit || r.isCrit;
      if (!r.evaded) landed = true;
    }
    const label = skill.id === "basic_attack" ? "attaque" : skill.name;
    const hitTxt = hits > 1 ? ` (${hits} frappes)` : "";
    if (landed) {
      log(combat, `${actor.name} utilise ${label}${hitTxt} et inflige ${total} dégâts${anyCrit ? " (CRITIQUE !)" : ""}.`, anyCrit ? "crit" : kind);
    } else {
      // Toutes les frappes esquivées : afficher « esquivé », jamais « 0 dégât ».
      log(combat, `${actor.name} utilise ${label} — esquivé !`, kind);
    }
  } else if (!skill.self) {
    log(combat, `${actor.name} utilise ${skill.name}.`, kind);
  } else {
    log(combat, `${actor.name} utilise ${skill.name}.`, kind);
  }

  // Effets sur la cible touchée (poison, malus...).
  if (landed && skill.onHit) for (const eff of skill.onHit) applyEffect(other, eff, actor.atk, combat, kind);
  // État élémentaire infligé par la compétence (Brûlure, Trempé, Charge...).
  if (landed && skill.inflicts) applyState(combat, other, skill.inflicts, actor.atk, kind);

  // CONVERSION de Garde en dégâts (instr. 83-84) : consomme une part RÉELLE de la
  // réserve pour un supplément de dégâts directs (l'identité « offensive » de
  // certaines classes défensives). Indépendant de l'esquive (effet déjà payé).
  if (skill.guardConvert && actor.guardPool > 0 && other.hp > 0) {
    const spend = Math.min(actor.guardPool, Math.round(actor.guardMax * (skill.guardConvert.pctMax || 0)));
    if (spend > 0) {
      actor.guardPool -= spend;
      const bonus = Math.max(1, Math.round(spend * (skill.guardConvert.ratio || 1)));
      other.hp = Math.max(0, other.hp - bonus);
      combat.lastFx.push({ target: other === combat.enemy ? "enemy" : "player", dmg: bonus, crit: false });
      log(combat, `${actor.name} convertit sa Garde en force (+${bonus} dégâts).`, kind);
    }
  }

  // Recharge réduite par la Vitesse (plafonnée). Une compétence garde toujours
  // au moins 1 tour de recharge.
  if (skill.cooldown > 0)
    actor.cooldowns[skillId] = Math.max(1, Math.round(skill.cooldown * cdFactor(actor.spd)));

  // Concentration : suit les compétences DIFFÉRENTES utilisées par le porteur ;
  // après en avoir utilisé assez, la prochaine compétence sera renforcée.
  if (actor.mat && actor.mat.concentration) {
    actor._distinct.add(skillId);
    if (actor._distinct.size >= MATERIAL_BEHAVIOR.concentration.skillsNeeded) actor._concReady = true;
  }

  // Génération de ressource de classe selon le TYPE d'action :
  //  - attaque de base : gain dédié (toujours utile) ;
  //  - compétence offensive ayant touché : gain « onDealDamage » (1×/action) ;
  //  - compétence de soutien sur soi : gain « onDefensiveSkill ».
  if (actor.res) {
    if (skillId === "basic_attack") gainResource(actor, "onBasicAttack");
    else if (landed) gainResource(actor, "onDealDamage");
    else if (skill.self && (!skill.power || skill.power === 0)) gainResource(actor, "onDefensiveSkill");
  }

  combat.lastActions.push({
    actor: kind,
    skillId,
    anim: skill.anim || "light",
    isBuff: skill.target === "self" || !skill.power,
    hasDamage: skill.power > 0,
  });
}

// IA ennemie « qui réfléchit » : évalue chaque compétence disponible et choisit
// la meilleure selon la situation (PV, buffs/malus déjà en place, létalité).
//
// Principes (inspirés d'un vrai combat de rôle) :
//  - se soigner / se défendre quand on est en danger ;
//  - se renforcer (atk_buff) en ouverture, jamais en double ;
//  - poser DoT / malus s'ils ne sont pas déjà actifs sur la cible ;
//  - garder les gros bursts pour achever (cible à faibles PV) ;
//  - sinon, taper au mieux (dégâts attendus, défense de la cible incluse).
function hasBuffType(c, type) {
  return c.buffs.some((b) => b.type === type);
}
function hasDot(c, type) {
  return c.dots.some((d) => d.type === type);
}

// Dégâts attendus d'une compétence offensive contre `target` (défense incluse).
function expectedDamage(actor, target, skill) {
  const hits = skill.hits || 1;
  const perHit = effectiveAtk(actor) * (skill.power || 0) * (1 - defReduction(effectiveDef(target)));
  return perHit * hits;
}

// --- Mémoire légère de l'IA (instr. 277-278) ---------------------------------
// L'IA NE LIT PAS les futurs choix du joueur : elle observe seulement l'historique
// récent. Si le joueur répète une stratégie, l'IA ajuste ses PRIORITÉS (pas de
// bonus de stats caché). Fenêtre glissante de 6 actions.
function recordPlayerMove(combat, skillId) {
  if (!combat.playerHistory) combat.playerHistory = [];
  combat.playerHistory.push(skillId);
  if (combat.playerHistory.length > 6) combat.playerHistory.shift();
}
// Schéma dominant récent du joueur, ou null si pas de répétition marquée (< 60 %).
function playerPattern(combat) {
  const h = combat.playerHistory || [];
  if (h.length < 3) return null;
  const counts = {};
  for (const id of h) counts[id] = (counts[id] || 0) + 1;
  let top = null, n = 0;
  for (const id of Object.keys(counts)) if (counts[id] > n) { n = counts[id]; top = id; }
  const frac = n / h.length;
  if (frac < 0.6) return null;
  const sk = getSkill(top);
  return { id: top, frac, aggressive: !!(sk && (sk.power || 0) > 0) };
}
// Une compétence est-elle « défensive » (soutien sur soi) ? Classement DATA-DRIVEN
// via les tags d'IA (instr. 238-239) : aucune dépendance au texte français.
function isDefensiveSkill(s) {
  if (!s || (s.power || 0) > 0) return false;
  const tags = deriveSkillTags(s);
  return tags.includes("guard") || tags.includes("heal");
}

function scoreEnemySkill(combat, id) {
  const enemy = combat.enemy;
  const player = combat.player;
  const s = getSkill(id);
  if (!s) return -Infinity;
  const hpPct = enemy.hp / enemy.maxHp;

  // --- Compétences sur soi (soin / défense / renforcement) ---
  if (s.self && (!s.power || s.power === 0)) {
    let score = 0;
    for (const eff of s.self) {
      if (eff.type === "heal") {
        // D'autant plus prioritaire qu'on est bas ; inutile à PV pleins.
        score += (1 - hpPct) * 220 - 20;
      } else if (eff.type === "shield" || eff.type === "guard" || eff.type === "def_buff") {
        // Défensif : utile quand on est en danger ; redondant si déjà actif.
        const danger = hpPct < 0.5 ? 1 : 0.35;
        const redundant = (eff.type === "def_buff" && hasBuffType(enemy, "def_buff")) || (eff.type === "guard" && enemy.guard);
        score += danger * 120 - (redundant ? 200 : 0);
      } else if (eff.type === "atk_buff") {
        // Mise en place offensive : tôt dans le combat, une seule fois.
        score += hasBuffType(enemy, "atk_buff") ? -200 : 60 + hpPct * 40;
      } else if (eff.type === "spd_buff") {
        score += hasBuffType(enemy, "spd_buff") ? -100 : 40;
      }
    }
    return score + memoryNudge(combat, s);
  }

  // --- Compétences offensives ---
  let score = expectedDamage(enemy, player, s);
  const lethal = score >= player.hp; // ce coup peut tuer
  const playerLow = player.hp / player.maxHp < 0.4;

  // Bonus d'achèvement : on sort le burst quand ça peut conclure.
  if (lethal) score += 1000;
  else if (playerLow && (s.power || 0) >= 1.6) score += 120;

  // Effets « onHit » : valoriser DoT/malus pas encore actifs (sinon gaspillage).
  for (const eff of s.onHit || []) {
    if (eff.type === "poison" || eff.type === "bleed") score += hasDot(player, eff.type) ? -40 : 70;
    else if (eff.type === "atk_debuff") score += hasBuffType(player, "atk_debuff") ? -30 : 55;
    else if (eff.type === "slow") score += hasBuffType(player, "slow") ? -30 : 45;
  }

  // Légère préférence pour ne pas « gaspiller » un gros cooldown hors fenêtre.
  if ((s.cooldown || 0) >= 3 && !lethal && !playerLow) score -= 25;

  return score + memoryNudge(combat, s);
}

// Ajustement de PRIORITÉ issu de la mémoire (jamais un bonus de stats). Joueur
// répétitivement agressif -> l'IA valorise un peu plus la défense ; joueur
// répétitivement passif -> l'IA valorise un peu plus l'offensive.
function memoryNudge(combat, s) {
  const pat = playerPattern(combat);
  if (!pat) return 0;
  if (pat.aggressive && isDefensiveSkill(s)) return 30 * pat.frac;
  if (!pat.aggressive && (s.power || 0) > 0) return 25 * pat.frac;
  return 0;
}

function chooseEnemySkill(combat) {
  const enemy = combat.enemy;
  const ready = (id) => !enemy.cooldowns[id] || enemy.cooldowns[id] <= 0;
  const available = enemy.skills.filter(ready);
  if (!available.length) return "basic_attack";

  let best = "basic_attack";
  let bestScore = scoreEnemySkill(combat, "basic_attack");
  for (const id of available) {
    // Petit aléa (±6 %) : l'IA reste lisible mais pas parfaitement robotique.
    const score = scoreEnemySkill(combat, id) * (0.97 + Math.random() * 0.06);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

// --- Phases de boss (Lot 10) -------------------------------------------------
// Quand les PV du boss passent SOUS un seuil, on entre dans la phase : règles
// persistantes (atk/defShred/élément) + effets ponctuels (heal, brise-bouclier,
// nouvelle compétence). Boucle au cas où plusieurs seuils sont franchis d'un coup.
function checkPhase(combat) {
  const e = combat.enemy;
  if (!e.phases || e.phaseIdx >= e.phases.length || e.hp <= 0) return;
  while (e.phaseIdx < e.phases.length) {
    const ph = e.phases[e.phaseIdx];
    if (e.hp / e.maxHp > ph.atHpPct) break;
    const set = ph.set || {};
    if (set.atkPct) e.phaseAtkPct = (e.phaseAtkPct || 0) + set.atkPct;
    if (set.defShredPct) e.phaseDefShred = Math.max(e.phaseDefShred || 0, set.defShredPct);
    if (set.element) e.element = set.element;
    if (set.clearShields) { combat.player.shield = 0; combat.player.shieldTurns = 0; }
    if (ph.heal) e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * ph.heal));
    if (ph.grant && !e.skills.includes(ph.grant)) e.skills.push(ph.grant);
    e.phaseName = ph.name;
    log(combat, `⚠ ${e.name} — ${ph.name} : ${ph.announce}`, "enemy");
    e.phaseIdx++;
  }
}

// Compétence que l'ennemi joue : choisie FRAÎCHEMENT à chaque tour (jamais
// pré-annoncée). Le journal ne révèle l'action qu'au moment où elle est exécutée
// (instr. 28-30, 272). Plus de séquence scriptée ni de télégraphie.
function nextEnemySkill(combat) {
  return chooseEnemySkill(combat);
}

// L'intention n'est JAMAIS révélée à l'avance (instr. 29-30, 272). Conservé en
// no-op pour compat ; renvoie toujours null -> l'UI n'affiche aucune annonce.
export function enemyIntentInfo() {
  return null;
}

// Entretien après chaque action du joueur : DoT, cooldowns, buffs, régén.
function upkeep(combat) {
  for (const c of [combat.player, combat.enemy]) {
    for (const id of Object.keys(c.cooldowns)) if (c.cooldowns[id] > 0) c.cooldowns[id] -= 1;
    c.buffs = c.buffs.filter((b) => --b.turns > 0);
    if (c.guard && --c.guard.turns <= 0) c.guard = null;
    if (c.guardActive && --c.guardActive.turns <= 0) c.guardActive = null; // expiration de la Garde active
    if (c.shieldTurns > 0 && --c.shieldTurns <= 0) c.shield = 0;
    // Dégâts sur la durée.
    if (c.dots.length) {
      let dot = 0;
      for (const d of c.dots) dot += d.dmg;
      c.dots = c.dots.filter((d) => --d.turns > 0);
      if (dot > 0 && c.hp > 0) {
        c.hp = Math.max(0, c.hp - dot);
        combat.lastFx.push({ target: c === combat.enemy ? "enemy" : "player", dmg: dot, crit: false, dot: true });
        log(combat, `${c.name} subit ${dot} dégâts de poison/saignement.`, c === combat.enemy ? "player" : "enemy");
      }
    }
    // États élémentaires : dégâts sur la durée + décrément des durées.
    if (c.states && c.states.length) {
      let sdot = 0;
      for (const st of c.states) if (st.dotDmg) sdot += st.dotDmg;
      c.states = c.states.filter((st) => --st.turns > 0);
      if (sdot > 0 && c.hp > 0) {
        c.hp = Math.max(0, c.hp - sdot);
        combat.lastFx.push({ target: c === combat.enemy ? "enemy" : "player", dmg: sdot, crit: false, dot: true });
        log(combat, `${c.name} subit ${sdot} dégâts élémentaires.`, c === combat.enemy ? "player" : "enemy");
      }
    }
  }
  // Régénération passive (Endurance, Régénération...) — annulée par Marque funéraire.
  if (combat.status === "active") {
    for (const c of [combat.player, combat.enemy]) {
      if (c.hp > 0 && c.pp.hpRegenPct && c.hp < c.maxHp && !stateNoRegen(c)) {
        const heal = Math.round(c.maxHp * c.pp.hpRegenPct);
        if (heal > 0) c.hp = Math.min(c.maxHp, c.hp + heal);
      }
      // Régénération de ressource de classe (Mana surtout).
      if (c.hp > 0) gainResource(c, "regenPerTurn");
    }
  }
  combat.turn += 1;
}

function checkDeaths(state, combat) {
  if (combat.status !== "active") return;
  if (combat.enemy.hp <= 0) finishCombat(state, combat, "won");
  else if (combat.player.hp <= 0) finishCombat(state, combat, "lost");
}

// Le joueur peut-il lancer la compétence ? (recharge terminée ET ressource
// suffisante). Renvoie aussi la raison pour l'affichage (Lot 8).
export function playerCanUse(combat, skillId) {
  return whyCannotUse(combat, skillId) === null;
}

// null = utilisable ; sinon "cooldown" ou "resource".
export function whyCannotUse(combat, skillId) {
  const s = getSkill(skillId);
  if (!s) return "cooldown";
  if ((combat.player.cooldowns[skillId] || 0) > 0) return "cooldown";
  const res = combat.player.res;
  if (res && s.cost && res.cur < s.cost) return "resource";
  return null;
}

// Aperçu de l'ordre PROBABLE des prochains tours (initiative par vitesse).
// Simulation sans effet de bord ; n'intègre pas le plafond MAX_CONSEC (indicatif).
export function forecastTurns(combat, n = 6) {
  if (!combat || combat.status !== "active") return [];
  const ps = effectiveSpd(combat.player);
  const es = effectiveSpd(combat.enemy);
  let pn = combat.player.nextAt;
  let en = combat.enemy.nextAt;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (pn <= en + 1e-6) {
      out.push("player");
      pn += SPEED_UNIT / ps;
    } else {
      out.push("enemy");
      en += SPEED_UNIT / es;
    }
  }
  return out;
}

// Résout l'action du joueur, puis les tours dus de l'ennemi (≤ MAX_CONSEC).
export function resolveRound(state, combat, playerSkillId) {
  if (combat.status !== "active") return combat;
  if (!playerCanUse(combat, playerSkillId)) return combat;

  combat.lastFx = [];
  combat.lastActions = [];

  // Action du joueur.
  useSkill(combat, combat.player, combat.enemy, playerSkillId);
  recordPlayerMove(combat, playerSkillId); // mémoire légère de l'IA (instr. 277)
  combat.player.nextAt += SPEED_UNIT / effectiveSpd(combat.player);
  checkPhase(combat); // un burst peut faire franchir un seuil de phase tout de suite
  checkDeaths(state, combat);

  // Tours de l'ennemi tant que c'est son tour (≤ MAX_CONSEC). L'action est choisie
  // fraîchement et n'est révélée qu'au moment de son exécution (instr. 29-30).
  let eActed = 0;
  while (combat.status === "active" && combat.enemy.nextAt <= combat.player.nextAt + 1e-6 && eActed < MAX_CONSEC) {
    useSkill(combat, combat.enemy, combat.player, nextEnemySkill(combat));
    combat.enemy.nextAt += SPEED_UNIT / effectiveSpd(combat.enemy);
    eActed++;
    checkDeaths(state, combat);
  }

  // Anti-abus : pas plus de MAX_CONSEC tours joueur sans riposte.
  if (eActed === 0) {
    combat.pConsec += 1;
    if (combat.status === "active" && combat.pConsec >= MAX_CONSEC) {
      useSkill(combat, combat.enemy, combat.player, nextEnemySkill(combat));
      combat.enemy.nextAt += SPEED_UNIT / effectiveSpd(combat.enemy);
      combat.pConsec = 0;
      checkDeaths(state, combat);
    } else if (combat.status === "active") {
      log(combat, "Grâce à ta vitesse, tu enchaînes une action !", "info");
    }
  } else {
    combat.pConsec = 0;
  }

  if (combat.status === "active") {
    upkeep(combat);
    checkPhase(combat); // un DoT peut aussi faire franchir un seuil
    checkDeaths(state, combat); // un DoT peut achever un combattant
  }
  return combat;
}

function finishCombat(state, combat, result) {
  combat.status = result;
  // Toute tentative (victoire OU défaite) révèle les résistances dans le bestiaire.
  if (state.bestiary && state.bestiary[combat.enemyId]) state.bestiary[combat.enemyId].resistKnown = true;
  if (result === "lost") {
    log(combat, `${combat.player.name} est vaincu...`, "enemy");
    state.character.hpCurrent = 1;
    clampHp(state);
    return;
  }

  const enemy = getEnemy(combat.enemyId);
  state.character.hpCurrent = combat.player.hp;
  const enraged = !!combat.enemy.enraged;
  const rewardMult = enraged ? ENRAGE_REWARD_MULT : 1;

  const drops = [];
  const luck = enemyLuck(enemy) + (enraged ? 0.5 : 0); // enragé -> meilleur butin
  for (const d of enemy.drops || []) {
    if (Math.random() <= d.chance) {
      if (d.type === "resource") {
        const qty = rollAmount(d.min, d.max);
        if (qty <= 0) continue;
        addResource(d.item, qty);
        drops.push({ id: d.item, qty, name: getResource(d.item)?.name || d.item, type: "resource" });
      } else if (d.type === "equipment") {
        const inst = makeInstance(d.item, rollRarity(luck));
        if (!inst) continue;
        addEquipmentInstance(inst);
        drops.push({ type: "equipment", inst, name: getEquipment(d.item)?.name || d.item, rarity: inst.rarity });
      } else if (d.type === "egg") {
        const qty = rollAmount(d.min, d.max);
        if (qty <= 0) continue;
        addEgg(state, d.item, qty);
        drops.push({ type: "egg", egg: d.item, qty, name: getEgg(d.item)?.name || "Œuf" });
      }
    }
  }

  const allowedWtypes = getClass(state.character.classId)?.weapons || null;
  const extra = rollGearDrop(enemy, enemy.isBoss, allowedWtypes);
  if (extra) {
    addEquipmentInstance(extra);
    drops.push({ type: "equipment", inst: extra, name: getEquipment(extra.baseId)?.name || extra.baseId, rarity: extra.rarity });
  }

  const goldGain = Math.round(enemy.gold * rewardMult);
  const xpGain = Math.round(enemy.xp * rewardMult);
  addGold(goldGain);
  const levels = gainCharXp(state, xpGain);
  clampHp(state); // un familier a pu gonfler les PV max en combat : on borne au réel

  // Familier équipé : gagne de l'XP (plafonnée au niveau du héros) + du lien.
  const famGain = gainEquippedFamiliarXp(state, xpGain);

  // Maîtrise de la classe ÉQUIPÉE (instr. mastery) : +1 par victoire, bonus boss.
  // N'augmente JAMAIS pour une autre classe (lit equippedNodeId).
  const masteryGain = gainMasteryOnWin(state, enemy.isBoss ? 3 : 1);

  state.counters.kills += 1;
  if (!state.counters.defeated) state.counters.defeated = {};
  state.counters.defeated[enemy.id] = (state.counters.defeated[enemy.id] || 0) + 1;
  if (enemy.isBoss) {
    state.counters.bossKills += 1;
    state.flags.bossDefeated = true;
  }

  combat.rewards = { xp: xpGain, gold: goldGain, drops, levels, familiar: famGain, enraged, mastery: masteryGain };
  log(combat, `${enemy.name}${enraged ? " (enragé)" : ""} est vaincu ! +${xpGain} XP, +${goldGain} or.`, "reward");
  if (levels > 0) log(combat, `Niveau supérieur ! Tu passes niveau ${state.character.level}.`, "reward");
  if (famGain && famGain.levels > 0) log(combat, `Ton familier gagne ${famGain.levels} niveau(x) !`, "reward");
  if (masteryGain && masteryGain.leveledUp) log(combat, `Maîtrise de classe : palier ${masteryGain.level} atteint !`, "reward");
  if (masteryGain && masteryGain.heritageUnlocked) log(combat, `Trait d'héritage débloqué !`, "reward");
}

// ===========================================================================
// SIMULATEUR D'ÉQUILIBRAGE (Lot 9)
// ---------------------------------------------------------------------------
// Outil headless réutilisant le VRAI moteur (useSkill/dealDamage/états/ressources
// /matériaux/passifs). Il sert à mesurer l'équilibre relatif des classes et des
// 15 spécialisations. Le duel est une approximation SYMÉTRIQUE : chaque
// combattant subit son entretien (cooldowns, DoT, régén, ressource) au DÉBUT de
// son propre tour. Les deux camps étant traités à l'identique, les taux de
// victoire relatifs sont significatifs (ce n'est pas une reproduction exacte de
// la cadence PvE, qui n'a pas lieu d'être ici).

// Score générique d'une compétence pour un acteur quelconque (≠ scoreEnemySkill
// qui est figé sur combat.enemy). Ne propose jamais une compétence inabordable.
export function pickSkillGeneric(actor, other) {
  const ready = (id) => {
    const s = getSkill(id);
    if (!s) return false;
    if ((actor.cooldowns[id] || 0) > 0) return false;
    if (actor.res && s.cost && actor.res.cur < s.cost) return false;
    return true;
  };
  const score = (id) => {
    const s = getSkill(id);
    if (!s) return -Infinity;
    const hpPct = actor.hp / actor.maxHp;
    // Compétences de soutien (sur soi).
    if (s.self && (!s.power || s.power === 0)) {
      let sc = 0;
      for (const eff of s.self) {
        if (eff.type === "heal") sc += (1 - hpPct) * 220 - 20;
        else if (eff.type === "shield" || eff.type === "guard" || eff.type === "def_buff") {
          const danger = hpPct < 0.5 ? 1 : 0.35;
          const redundant = (eff.type === "def_buff" && actor.buffs.some((b) => b.type === "def_buff")) || (eff.type === "guard" && actor.guard);
          sc += danger * 120 - (redundant ? 200 : 0);
        } else if (eff.type === "atk_buff") sc += actor.buffs.some((b) => b.type === "atk_buff") ? -200 : 60 + hpPct * 40;
        else if (eff.type === "spd_buff") sc += actor.buffs.some((b) => b.type === "spd_buff") ? -100 : 40;
      }
      return sc;
    }
    // Compétences offensives.
    let sc = expectedDamage(actor, other, s);
    const lethal = sc >= other.hp;
    const otherLow = other.hp / other.maxHp < 0.4;
    if (lethal) sc += 1000;
    else if (otherLow && (s.power || 0) >= 1.6) sc += 120;
    for (const eff of s.onHit || []) {
      if (eff.type === "poison" || eff.type === "bleed") sc += other.dots.some((d) => d.type === eff.type) ? -40 : 70;
      else if (eff.type === "atk_debuff") sc += other.buffs.some((b) => b.type === "atk_debuff") ? -30 : 55;
      else if (eff.type === "slow") sc += other.buffs.some((b) => b.type === "slow") ? -30 : 45;
    }
    if (s.inflicts && !other.states.some((st) => st.id === s.inflicts)) sc += 40;
    if ((s.cooldown || 0) >= 3 && !lethal && !otherLow) sc -= 25;
    return sc;
  };

  const options = actor.skills.filter(ready);
  let best = "basic_attack";
  let bestScore = score("basic_attack");
  for (const id of options) {
    const sc = score(id) * (0.97 + Math.random() * 0.06);
    if (sc > bestScore) { bestScore = sc; best = id; }
  }
  return best;
}

// Entretien de DÉBUT de tour pour un seul combattant (cooldowns, buffs, garde,
// bouclier, DoT, états, régén PV et ressource).
function simStartTurnUpkeep(combat, c) {
  for (const id of Object.keys(c.cooldowns)) if (c.cooldowns[id] > 0) c.cooldowns[id] -= 1;
  c.buffs = c.buffs.filter((b) => --b.turns > 0);
  if (c.guard && --c.guard.turns <= 0) c.guard = null;
  if (c.guardActive && --c.guardActive.turns <= 0) c.guardActive = null;
  if (c.shieldTurns > 0 && --c.shieldTurns <= 0) c.shield = 0;
  let dot = 0;
  for (const d of c.dots) dot += d.dmg;
  c.dots = c.dots.filter((d) => --d.turns > 0);
  let sdot = 0;
  for (const st of c.states) if (st.dotDmg) sdot += st.dotDmg;
  c.states = c.states.filter((st) => --st.turns > 0);
  const total = dot + sdot;
  if (total > 0 && c.hp > 0) c.hp = Math.max(0, c.hp - total);
  if (c.hp > 0 && c.pp.hpRegenPct && c.hp < c.maxHp && !stateNoRegen(c)) {
    c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * c.pp.hpRegenPct));
  }
  if (c.hp > 0) gainResource(c, "regenPerTurn");
}

// Simulateur PvE (Lot 8, instr. 325-333) : joue un VRAI combat joueur-vs-ennemi
// avec le moteur complet (startCombat + resolveRound), le joueur étant piloté par
// une politique (défaut : pickSkillGeneric). Sert à mesurer des taux de victoire
// et à détecter les valeurs absurdes (0 % / 100 %, no-hit trop fréquents).
// `state.character.hpCurrent` doit être plein avant l'appel (combat réel).
export function simulatePvE(state, enemyId, opts = {}) {
  const combat = startCombat(state, enemyId, { forceEnrage: opts.forceEnrage === true ? true : false });
  if (!combat) return null;
  const policy = opts.policy || pickSkillGeneric;
  const maxRounds = opts.maxRounds || 400;
  let tookDamage = false;
  let safety = 0;
  while (combat.status === "active" && safety < maxRounds) {
    safety++;
    const hpBefore = combat.player.hp;
    let id = policy(combat.player, combat.enemy);
    if (!playerCanUse(combat, id)) id = "basic_attack";
    resolveRound(state, combat, id);
    if (combat.player.hp < hpBefore) tookDamage = true;
  }
  return {
    win: combat.status === "won",
    turns: combat.turn,
    hpFrac: combat.player.hp / combat.player.maxHp,
    noHitWin: combat.status === "won" && !tookDamage,
  };
}

// Simule un duel entre deux builds (states A et B). Renvoie le vainqueur.
//   opts : { maxTurns, policyA, policyB }
// policy(actor, other) -> skillId (défaut : pickSkillGeneric).
export function simulateDuel(stateA, stateB, opts = {}) {
  const a = buildPlayerCombatant(stateA);
  const b = buildPlayerCombatant(stateB);
  a.hp = a.maxHp;
  b.hp = b.maxHp;
  // Initiative de départ pilotée par la vitesse (le plus rapide tend à ouvrir),
  // avec un aléa pour éviter tout biais de « premier coup » systématique.
  a.nextAt = (SPEED_UNIT / effectiveSpd(a)) * Math.random();
  b.nextAt = (SPEED_UNIT / effectiveSpd(b)) * Math.random();
  const combat = { player: a, enemy: b, turn: 1, status: "active", log: [], lastFx: [], lastActions: [] };
  const policyA = opts.policyA || pickSkillGeneric;
  const policyB = opts.policyB || pickSkillGeneric;
  const maxTurns = opts.maxTurns || 80;
  let safety = 0;
  while (a.hp > 0 && b.hp > 0 && combat.turn <= maxTurns && safety < 2000) {
    safety++;
    const aFirst = a.nextAt <= b.nextAt + 1e-6;
    const actor = aFirst ? a : b;
    const other = aFirst ? b : a;
    simStartTurnUpkeep(combat, actor);
    if (actor.hp <= 0) break; // un DoT a pu l'achever
    if (other.hp <= 0) break;
    combat.lastFx = [];
    combat.lastActions = [];
    const id = (actor === a ? policyA : policyB)(actor, other);
    useSkill(combat, actor, other, id);
    actor.nextAt += SPEED_UNIT / effectiveSpd(actor);
    combat.turn += 1;
  }
  let winner = "draw";
  if (a.hp <= 0 && b.hp > 0) winner = "B";
  else if (b.hp <= 0 && a.hp > 0) winner = "A";
  else if (a.hp / a.maxHp > b.hp / b.maxHp) winner = "A"; // limite de tours : avantage au plus haut %
  else if (b.hp / b.maxHp > a.hp / a.maxHp) winner = "B";
  return { winner, turns: combat.turn, aHp: a.hp, bHp: b.hp };
}
