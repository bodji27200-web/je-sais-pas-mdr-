// Moteur de combat tour par tour.
// Le combat est une machine à états pilotée par l'UI : le joueur choisit une
// compétence -> resolveRound() résout le tour (ordre selon la vitesse), puis
// l'UI réaffiche. Les PV du personnage sont conservés entrée/sortie de combat.

import { getEnemy } from "../data/enemies.js";
import { getSkill } from "../data/skills.js";
import { getClass } from "../data/classes.js";
import { getEquipment } from "../data/equipment.js";
import { getResource } from "../data/resources.js";
import {
  getDerivedStats,
  gainCharXp,
  clampHp,
} from "../core/character.js";
import { rollAmount } from "../core/progression.js";
import { addGold, addResource, addEquipmentInstance } from "../core/state.js";
import { makeInstance, rollRarity, enemyLuck, rollGearDrop } from "../core/items.js";

function makeCombatant(name, stats, skillIds, passiveId) {
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
    buffs: [], // [{ type:'atk_buff', amount, turns }]
    cooldowns: {}, // { skillId: toursRestants }
  };
}

// Démarre un combat contre l'ennemi indiqué.
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

  const e = makeCombatant(enemy.name, { maxHp: enemy.stats.hp, atk: enemy.stats.atk, def: enemy.stats.def, spd: enemy.stats.spd, crit: enemy.stats.crit }, ["basic_attack", ...(enemy.skills || [])], null);
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
    log: [{ text: `Un ${enemy.name} surgit !`, kind: "info" }],
    status: "active", // active | won | lost
    rewards: null,
    lastFx: [], // effets du dernier tour (dégâts) pour l'UI
    lastActions: [], // actions du dernier tour (attaquant + anim) pour l'UI
  };
}

function log(combat, text, kind = "info") {
  combat.log.push({ text, kind });
}

function effectiveAtk(c) {
  let mult = 1;
  for (const b of c.buffs) if (b.type === "atk_buff") mult += b.amount;
  return c.atk * mult;
}

// Calcule et applique les dégâts d'un attaquant sur une cible.
function dealDamage(combat, attacker, defender, power) {
  let base = effectiveAtk(attacker) * power;
  base -= defender.def * 0.5;
  const variance = 0.9 + Math.random() * 0.2;
  base *= variance;
  const isCrit = Math.random() * 100 < attacker.crit;
  if (isCrit) base *= 1.5;
  const dmg = Math.max(1, Math.round(base));
  defender.hp = Math.max(0, defender.hp - dmg);
  // Effet visuel/sonore pour l'UI (rejoué une fois après chaque tour).
  combat.lastFx.push({ target: defender === combat.enemy ? "enemy" : "player", dmg, crit: isCrit });
  return { dmg, isCrit };
}

// Exécute une compétence d'un acteur vers l'autre.
function useSkill(combat, actor, other, skillId) {
  const skill = getSkill(skillId);
  if (!skill) return;
  const isPlayer = actor === combat.player;
  const kind = isPlayer ? "player" : "enemy";

  // Effet de buff (sur soi).
  if (skill.effect && skill.effect.type === "atk_buff") {
    actor.buffs.push({ type: "atk_buff", amount: skill.effect.amount, turns: skill.effect.turns });
    log(combat, `${actor.name} utilise ${skill.name} : attaque renforcée !`, kind);
  }

  // Dégâts éventuels.
  if (skill.power > 0) {
    const { dmg, isCrit } = dealDamage(combat, actor, other, skill.power);
    const skillLabel = skill.id === "basic_attack" ? "attaque" : skill.name;
    const critTxt = isCrit ? " (CRITIQUE !)" : "";
    log(combat, `${actor.name} utilise ${skillLabel} et inflige ${dmg} dégâts${critTxt}.`, isCrit ? "crit" : kind);
  }

  if (skill.cooldown > 0) actor.cooldowns[skillId] = skill.cooldown;

  // Trace l'action pour l'animation côté UI (data-driven via skill.anim).
  combat.lastActions.push({
    actor: isPlayer ? "player" : "enemy",
    skillId,
    anim: skill.anim || "dash",
    isBuff: !!(skill.effect && skill.effect.type === "atk_buff"),
    hasDamage: skill.power > 0,
  });
}

// IA ennemie : buff si pertinent, sinon meilleure compétence offensive dispo.
function chooseEnemySkill(enemy) {
  const ready = (id) => !enemy.cooldowns[id] || enemy.cooldowns[id] <= 0;
  const available = enemy.skills.filter(ready);

  const buffSkill = available.find((id) => {
    const s = getSkill(id);
    return s && s.effect && s.effect.type === "atk_buff";
  });
  const alreadyBuffed = enemy.buffs.some((b) => b.type === "atk_buff");
  if (buffSkill && !alreadyBuffed && Math.random() < 0.5) return buffSkill;

  const damaging = available
    .filter((id) => (getSkill(id)?.power || 0) > 0)
    .sort((a, b) => (getSkill(b).power || 0) - (getSkill(a).power || 0));
  return damaging[0] || "basic_attack";
}

function tickEndOfRound(combat) {
  for (const c of [combat.player, combat.enemy]) {
    // Cooldowns.
    for (const id of Object.keys(c.cooldowns)) {
      if (c.cooldowns[id] > 0) c.cooldowns[id] -= 1;
    }
    // Buffs.
    c.buffs = c.buffs.filter((b) => {
      b.turns -= 1;
      return b.turns > 0;
    });
  }

  // Régénération passive du joueur (ex. Endurance).
  if (combat.status === "active" && combat.player.hp > 0 && combat.player.passive) {
    const p = getSkill(combat.player.passive);
    if (p && p.passive && p.passive.hpRegenPct) {
      const heal = Math.round(combat.player.maxHp * p.passive.hpRegenPct);
      if (heal > 0 && combat.player.hp < combat.player.maxHp) {
        combat.player.hp = Math.min(combat.player.maxHp, combat.player.hp + heal);
        log(combat, `${combat.player.name} régénère ${heal} PV.`, "info");
      }
    }
  }

  combat.turn += 1;
}

// La compétence est-elle utilisable par le joueur ce tour ?
export function playerCanUse(combat, skillId) {
  const cd = combat.player.cooldowns[skillId] || 0;
  return cd <= 0;
}

// Résout un tour complet à partir de la compétence choisie par le joueur.
export function resolveRound(state, combat, playerSkillId) {
  if (combat.status !== "active") return combat;
  if (!playerCanUse(combat, playerSkillId)) return combat;

  combat.lastFx = []; // effets de ce tour
  combat.lastActions = []; // actions de ce tour

  // Ordre selon la vitesse (égalité : joueur en premier).
  const playerFirst = combat.player.spd >= combat.enemy.spd;
  const order = playerFirst ? ["player", "enemy"] : ["enemy", "player"];

  for (const who of order) {
    if (combat.status !== "active") break;
    if (who === "player" && combat.player.hp > 0) {
      useSkill(combat, combat.player, combat.enemy, playerSkillId);
    } else if (who === "enemy" && combat.enemy.hp > 0) {
      useSkill(combat, combat.enemy, combat.player, chooseEnemySkill(combat.enemy));
    }
    // Vérification des morts après chaque action.
    if (combat.enemy.hp <= 0) finishCombat(state, combat, "won");
    else if (combat.player.hp <= 0) finishCombat(state, combat, "lost");
  }

  if (combat.status === "active") tickEndOfRound(combat);
  return combat;
}

// Clôture le combat, applique les conséquences sur l'état persistant.
function finishCombat(state, combat, result) {
  combat.status = result;

  if (result === "lost") {
    log(combat, `${combat.player.name} est vaincu...`, "enemy");
    state.character.hpCurrent = 1;
    clampHp(state);
    return;
  }

  // Victoire.
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
        // Drop scripté : une instance avec rareté tirée selon la chance de l'ennemi.
        const inst = makeInstance(d.item, rollRarity(luck));
        if (!inst) continue;
        addEquipmentInstance(inst);
        drops.push({ type: "equipment", inst, name: getEquipment(d.item)?.name || d.item, rarity: inst.rarity });
      }
    }
  }

  // Loot d'équipement aléatoire (boss : garanti). C'est le moteur du « refarm ».
  const extra = rollGearDrop(enemy, enemy.isBoss);
  if (extra) {
    addEquipmentInstance(extra);
    drops.push({ type: "equipment", inst: extra, name: getEquipment(extra.baseId)?.name || extra.baseId, rarity: extra.rarity });
  }

  addGold(enemy.gold);
  const levels = gainCharXp(state, enemy.xp);

  state.counters.kills += 1;
  if (enemy.isBoss) {
    state.counters.bossKills += 1;
    state.flags.bossDefeated = true;
  }

  combat.rewards = { xp: enemy.xp, gold: enemy.gold, drops, levels };
  log(combat, `${enemy.name} est vaincu ! +${enemy.xp} XP, +${enemy.gold} or.`, "reward");
  if (levels > 0) log(combat, `Niveau supérieur ! Tu passes niveau ${state.character.level}.`, "reward");
}
