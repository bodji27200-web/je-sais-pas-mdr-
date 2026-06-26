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
import { getDerivedStats, gainCharXp, clampHp, getActiveSpec, activeMaterialBehaviors } from "../core/character.js";
import { MATERIAL_BEHAVIOR } from "../data/materials.js";
import { rollAmount } from "../core/progression.js";
import { addGold, addResource, addEquipmentInstance } from "../core/state.js";
import { makeInstance, rollRarity, enemyLuck, rollGearDrop } from "../core/items.js";

// --- Constantes d'équilibrage (modifiables ici) ---
export const DEF_K = 90; // softcap de défense : réduction = def/(def+K)
export const DEF_CAP = 0.75; // réduction max (jamais 0 dégât permanent)
export const CRIT_MULT = 1.6; // multiplicateur de dégâts critiques
export const SPEED_UNIT = 100; // unité d'initiative ; nextAt += UNIT/vitesse
export const MAX_CONSEC = 2; // actions consécutives maximum

// Réduction de recharge liée à la Vitesse : faible et PLAFONNÉE (20 % max).
// Réf. 10 (vitesse de base) -> aucune réduction ; au-delà, réduction progressive.
export const CD_SPEED_REF = 10;
export const CD_MIN_FACTOR = 0.8; // au plus -20 % de recharge
export function cdFactor(spd) {
  return Math.max(CD_MIN_FACTOR, 1 - Math.max(0, spd - CD_SPEED_REF) / 100);
}

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

export function startCombat(state, enemyId) {
  const enemy = getEnemy(enemyId);
  if (!enemy) return null;

  const ds = getDerivedStats(state);
  const cls = getClass(state.character.classId);

  const spec = getActiveSpec(state);
  const player = makeCombatant(
    state.character.name,
    { maxHp: ds.maxHp, hp: Math.max(1, Math.round(state.character.hpCurrent)), atk: ds.atk, def: ds.def, spd: ds.spd, crit: ds.crit },
    ["basic_attack", ...cls.skills, ...((spec && spec.grants) || [])],
    cls.passive
  );
  // Passive de spécialisation : fusionnée aux effets de combat de la classe.
  if (spec && spec.passive) mergePp(player.pp, spec.passive);

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

  const e = makeCombatant(
    enemy.name,
    { maxHp: enemy.stats.hp, atk: enemy.stats.atk, def: enemy.stats.def, spd: enemy.stats.spd, crit: enemy.stats.crit },
    ["basic_attack", ...(enemy.skills || [])],
    enemy.passive || null
  );
  e.enemyId = enemy.id;
  e.icon = enemy.icon;
  e.image = enemy.image;
  e.sprite = enemy.sprite;
  e.isBoss = enemy.isBoss;
  e.role = enemy.role || null;

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

// Calcule et applique les dégâts. opts: { skillId, critBonus, concBonus }.
function dealDamage(combat, attacker, defender, power, opts = {}) {
  // Souplesse (Cuir, 4 pièces) : chance d'esquiver complètement l'attaque, puis
  // gain temporaire de critique. Seul le porteur du matériau peut esquiver.
  if (defender.mat && defender.mat.evasionPct > 0 && Math.random() * 100 < defender.mat.evasionPct) {
    const cfg = MATERIAL_BEHAVIOR.souplesse;
    defender.buffs.push({ type: "crit_buff", amount: cfg.critBuff, turns: cfg.critTurns });
    log(combat, `${defender.name} esquive l'attaque (Souplesse) et gagne en précision.`, defender === combat.player ? "player" : "enemy");
    combat.lastFx.push({ target: defender === combat.enemy ? "enemy" : "player", dmg: 0, crit: false, evaded: true });
    return { dmg: 0, isCrit: false, evaded: true };
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

  // Défense (rendements décroissants).
  base *= 1 - defReduction(effectiveDef(defender));

  base *= 0.9 + Math.random() * 0.2; // variance ±10 %
  const critChance = attacker.crit + (opts.critBonus || 0) + sumBuff(attacker, "crit_buff");
  const isCrit = Math.random() * 100 < critChance;
  if (isCrit) base *= CRIT_MULT;

  let dmg = Math.max(1, Math.round(base));

  // Garde : réduit la prochaine attaque reçue (consommée).
  if (defender.guard) {
    dmg = Math.max(1, Math.round(dmg * (1 - defender.guard.reduce)));
    defender.guard = null;
  }
  // Stabilité (Métal, 4 pièces) : la 1re attaque subie du combat est réduite.
  if (defender.mat && defender.mat.stability && !defender._stabilityUsed) {
    dmg = Math.max(1, Math.round(dmg * (1 - MATERIAL_BEHAVIOR.stabilite.reduce)));
    defender._stabilityUsed = true;
    log(combat, `${defender.name} encaisse le premier coup (Stabilité).`, defender === combat.player ? "player" : "enemy");
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
  if (skill.power > 0) {
    const hits = skill.hits || 1;
    let total = 0;
    let anyCrit = false;
    for (let i = 0; i < hits && other.hp > 0; i++) {
      const r = dealDamage(combat, actor, other, skill.power, { skillId, critBonus: skill.critBonus || 0, concBonus });
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
    return score;
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

  return score;
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
  // Régénération passive (joueur ou ennemi : Endurance, Régénération...).
  if (combat.status === "active") {
    for (const c of [combat.player, combat.enemy]) {
      if (c.hp > 0 && c.pp.hpRegenPct && c.hp < c.maxHp) {
        const heal = Math.round(c.maxHp * c.pp.hpRegenPct);
        if (heal > 0) c.hp = Math.min(c.maxHp, c.hp + heal);
      }
    }
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
  combat.player.nextAt += SPEED_UNIT / effectiveSpd(combat.player);
  checkDeaths(state, combat);

  // Tours de l'ennemi tant que c'est son tour (≤ MAX_CONSEC).
  let eActed = 0;
  while (combat.status === "active" && combat.enemy.nextAt <= combat.player.nextAt + 1e-6 && eActed < MAX_CONSEC) {
    useSkill(combat, combat.enemy, combat.player, chooseEnemySkill(combat));
    combat.enemy.nextAt += SPEED_UNIT / effectiveSpd(combat.enemy);
    eActed++;
    checkDeaths(state, combat);
  }

  // Anti-abus : pas plus de MAX_CONSEC tours joueur sans riposte.
  if (eActed === 0) {
    combat.pConsec += 1;
    if (combat.status === "active" && combat.pConsec >= MAX_CONSEC) {
      useSkill(combat, combat.enemy, combat.player, chooseEnemySkill(combat));
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
