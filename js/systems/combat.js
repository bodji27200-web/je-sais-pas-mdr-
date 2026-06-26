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
import { getSkill } from "../data/skills.js";
import { getClass } from "../data/classes.js";
import { getEquipment } from "../data/equipment.js";
import { getResource } from "../data/resources.js";
import { getDerivedStats, gainCharXp, clampHp } from "../core/character.js";
import { rollAmount } from "../core/progression.js";
import { addGold, addResource, addEquipmentInstance } from "../core/state.js";
import { makeInstance, rollRarity, enemyLuck, rollGearDrop } from "../core/items.js";

// --- Constantes d'équilibrage (modifiables ici) ---
export const DEF_K = 90; // softcap de défense : réduction = def/(def+K)
export const DEF_CAP = 0.75; // réduction max (jamais 0 dégât permanent)
export const CRIT_MULT = 1.6; // multiplicateur de dégâts critiques
export const SPEED_UNIT = 100; // unité d'initiative ; nextAt += UNIT/vitesse
export const MAX_CONSEC = 2; // actions consécutives maximum

function makeCombatant(name, stats, skillIds, passiveId) {
  const passive = passiveId ? getSkill(passiveId) : null;
  return {
    name,
    maxHp: stats.maxHp,
    hp: stats.hp != null ? stats.hp : stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    crit: stats.crit,
    skills: skillIds || [],
    passive: passiveId || null,
    pp: (passive && passive.passive) || {}, // bonus de passive utiles EN combat
    buffs: [], // [{ type:'atk_buff'|'def_buff'|'atk_debuff'|'slow', amount, turns }]
    dots: [], // [{ type:'poison'|'bleed', dmg, turns }]
    shield: 0,
    shieldTurns: 0,
    guard: null, // { reduce, turns }
    cooldowns: {},
    nextAt: 0,
  };
}

export function startCombat(state, enemyId) {
  const enemy = getEnemy(enemyId);
  if (!enemy) return null;

  const ds = getDerivedStats(state);
  const cls = getClass(state.character.classId);

  const player = makeCombatant(
    state.character.name,
    { maxHp: ds.maxHp, hp: Math.max(1, Math.round(state.character.hpCurrent)), atk: ds.atk, def: ds.def, spd: ds.spd, crit: ds.crit },
    ["basic_attack", ...cls.skills],
    cls.passive
  );

  const e = makeCombatant(
    enemy.name,
    { maxHp: enemy.stats.hp, atk: enemy.stats.atk, def: enemy.stats.def, spd: enemy.stats.spd, crit: enemy.stats.crit },
    ["basic_attack", ...(enemy.skills || [])],
    null
  );
  e.enemyId = enemy.id;
  e.icon = enemy.icon;
  e.image = enemy.image;
  e.sprite = enemy.sprite;
  e.isBoss = enemy.isBoss;

  return {
    enemyId,
    player,
    enemy: e,
    turn: 1,
    pConsec: 0,
    log: [{ text: `Un ${enemy.name} surgit !`, kind: "info" }],
    status: "active",
    rewards: null,
    lastFx: [],
    lastActions: [],
  };
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
  return Math.max(0.1, c.atk * mult);
}
function effectiveDef(c) {
  return Math.max(0, c.def * (1 + sumBuff(c, "def_buff")));
}
export function effectiveSpd(c) {
  return Math.max(1, c.spd * (1 + sumBuff(c, "spd_buff") - sumBuff(c, "slow")));
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
    case "shield": {
      const amt = Math.round(target.maxHp * eff.pctMaxHp);
      target.shield = Math.max(target.shield, amt);
      target.shieldTurns = eff.turns;
      log(combat, `${target.name} gagne un bouclier de ${amt} PV.`, who);
      break;
    }
    case "heal": {
      const amt = Math.round(target.maxHp * eff.pctMaxHp);
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

// Calcule et applique les dégâts. opts: { skillId, critBonus }.
function dealDamage(combat, attacker, defender, power, opts = {}) {
  let base = effectiveAtk(attacker) * power;

  // Passive : boost des compétences (hors attaque de base).
  if (opts.skillId && opts.skillId !== "basic_attack" && attacker.pp.skillPowerPct)
    base *= 1 + attacker.pp.skillPowerPct;
  // Passive : exécution (cible à faibles PV).
  if (attacker.pp.execute && defender.hp / defender.maxHp < attacker.pp.execute.threshold)
    base *= 1 + attacker.pp.execute.bonus;
  // Passive : bonus contre cible affaiblie (malus/DoT).
  if (attacker.pp.vsDebuff && hasNegative(defender)) base *= 1 + attacker.pp.vsDebuff.bonus;

  // Défense (rendements décroissants).
  base *= 1 - defReduction(effectiveDef(defender));

  base *= 0.9 + Math.random() * 0.2; // variance ±10 %
  const critChance = attacker.crit + (opts.critBonus || 0);
  const isCrit = Math.random() * 100 < critChance;
  if (isCrit) base *= CRIT_MULT;

  let dmg = Math.max(1, Math.round(base));

  // Garde : réduit la prochaine attaque reçue (consommée).
  if (defender.guard) {
    dmg = Math.max(1, Math.round(dmg * (1 - defender.guard.reduce)));
    defender.guard = null;
  }
  // Bouclier : absorbe avant les PV.
  if (defender.shield > 0) {
    const absorbed = Math.min(defender.shield, dmg);
    defender.shield -= absorbed;
    dmg -= absorbed;
  }
  defender.hp = Math.max(0, defender.hp - dmg);

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

  // Effets sur soi (buff, bouclier, garde, soin).
  if (skill.self) for (const eff of skill.self) applyEffect(actor, eff, actor.atk, combat, kind);

  // Dégâts (éventuellement multi-frappes).
  let landed = false;
  if (skill.power > 0) {
    const hits = skill.hits || 1;
    let total = 0;
    let anyCrit = false;
    for (let i = 0; i < hits && other.hp > 0; i++) {
      const r = dealDamage(combat, actor, other, skill.power, { skillId, critBonus: skill.critBonus || 0 });
      total += r.dmg;
      anyCrit = anyCrit || r.isCrit;
      landed = true;
    }
    const label = skill.id === "basic_attack" ? "attaque" : skill.name;
    const hitTxt = hits > 1 ? ` (${hits} frappes)` : "";
    log(combat, `${actor.name} utilise ${label}${hitTxt} et inflige ${total} dégâts${anyCrit ? " (CRITIQUE !)" : ""}.`, anyCrit ? "crit" : kind);
  } else if (!skill.self) {
    log(combat, `${actor.name} utilise ${skill.name}.`, kind);
  } else {
    log(combat, `${actor.name} utilise ${skill.name}.`, kind);
  }

  // Effets sur la cible touchée (poison, malus...).
  if (landed && skill.onHit) for (const eff of skill.onHit) applyEffect(other, eff, actor.atk, combat, kind);

  if (skill.cooldown > 0) actor.cooldowns[skillId] = skill.cooldown;

  combat.lastActions.push({
    actor: kind,
    skillId,
    anim: skill.anim || "light",
    isBuff: skill.target === "self" || !skill.power,
    hasDamage: skill.power > 0,
  });
}

// IA ennemie : buff si pertinent, sinon meilleure compétence offensive dispo.
function chooseEnemySkill(enemy) {
  const ready = (id) => !enemy.cooldowns[id] || enemy.cooldowns[id] <= 0;
  const available = enemy.skills.filter(ready);
  const buffSkill = available.find((id) => {
    const s = getSkill(id);
    return s && s.self && s.self.some((e) => e.type === "atk_buff");
  });
  const alreadyBuffed = enemy.buffs.some((b) => b.type === "atk_buff");
  if (buffSkill && !alreadyBuffed && Math.random() < 0.5) return buffSkill;
  const damaging = available
    .filter((id) => (getSkill(id)?.power || 0) > 0)
    .sort((a, b) => (getSkill(b).power || 0) - (getSkill(a).power || 0));
  return damaging[0] || "basic_attack";
}

// Entretien après chaque action du joueur : DoT, cooldowns, buffs, régén.
function upkeep(combat) {
  for (const c of [combat.player, combat.enemy]) {
    for (const id of Object.keys(c.cooldowns)) if (c.cooldowns[id] > 0) c.cooldowns[id] -= 1;
    c.buffs = c.buffs.filter((b) => --b.turns > 0);
    if (c.guard && --c.guard.turns <= 0) c.guard = null;
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
  }
  // Régénération passive du joueur (ex. Endurance).
  const p = combat.player;
  if (combat.status === "active" && p.hp > 0 && p.pp.hpRegenPct && p.hp < p.maxHp) {
    const heal = Math.round(p.maxHp * p.pp.hpRegenPct);
    if (heal > 0) { p.hp = Math.min(p.maxHp, p.hp + heal); }
  }
  combat.turn += 1;
}

function checkDeaths(state, combat) {
  if (combat.status !== "active") return;
  if (combat.enemy.hp <= 0) finishCombat(state, combat, "won");
  else if (combat.player.hp <= 0) finishCombat(state, combat, "lost");
}

export function playerCanUse(combat, skillId) {
  return (combat.player.cooldowns[skillId] || 0) <= 0;
}

// Résout l'action du joueur, puis les tours dus de l'ennemi (≤ MAX_CONSEC).
export function resolveRound(state, combat, playerSkillId) {
  if (combat.status !== "active") return combat;
  if (!playerCanUse(combat, playerSkillId)) return combat;

  combat.lastFx = [];
  combat.lastActions = [];

  // Action du joueur.
  useSkill(combat, combat.player, combat.enemy, playerSkillId);
  combat.player.nextAt += SPEED_UNIT / effectiveSpd(combat.player);
  checkDeaths(state, combat);

  // Tours de l'ennemi tant que c'est son tour (≤ MAX_CONSEC).
  let eActed = 0;
  while (combat.status === "active" && combat.enemy.nextAt <= combat.player.nextAt + 1e-6 && eActed < MAX_CONSEC) {
    useSkill(combat, combat.enemy, combat.player, chooseEnemySkill(combat.enemy));
    combat.enemy.nextAt += SPEED_UNIT / effectiveSpd(combat.enemy);
    eActed++;
    checkDeaths(state, combat);
  }

  // Anti-abus : pas plus de MAX_CONSEC tours joueur sans riposte.
  if (eActed === 0) {
    combat.pConsec += 1;
    if (combat.status === "active" && combat.pConsec >= MAX_CONSEC) {
      useSkill(combat, combat.enemy, combat.player, chooseEnemySkill(combat.enemy));
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
    checkDeaths(state, combat); // un DoT peut achever un combattant
  }
  return combat;
}

function finishCombat(state, combat, result) {
  combat.status = result;
  if (result === "lost") {
    log(combat, `${combat.player.name} est vaincu...`, "enemy");
    state.character.hpCurrent = 1;
    clampHp(state);
    return;
  }

  const enemy = getEnemy(combat.enemyId);
  state.character.hpCurrent = combat.player.hp;

  const drops = [];
  const luck = enemyLuck(enemy);
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
      }
    }
  }

  const allowedWtypes = getClass(state.character.classId)?.weapons || null;
  const extra = rollGearDrop(enemy, enemy.isBoss, allowedWtypes);
  if (extra) {
    addEquipmentInstance(extra);
    drops.push({ type: "equipment", inst: extra, name: getEquipment(extra.baseId)?.name || extra.baseId, rarity: extra.rarity });
  }

  addGold(enemy.gold);
  const levels = gainCharXp(state, enemy.xp);

  state.counters.kills += 1;
  if (!state.counters.defeated) state.counters.defeated = {};
  state.counters.defeated[enemy.id] = (state.counters.defeated[enemy.id] || 0) + 1;
  if (enemy.isBoss) {
    state.counters.bossKills += 1;
    state.flags.bossDefeated = true;
  }

  combat.rewards = { xp: enemy.xp, gold: enemy.gold, drops, levels };
  log(combat, `${enemy.name} est vaincu ! +${enemy.xp} XP, +${enemy.gold} or.`, "reward");
  if (levels > 0) log(combat, `Niveau supérieur ! Tu passes niveau ${state.character.level}.`, "reward");
}
