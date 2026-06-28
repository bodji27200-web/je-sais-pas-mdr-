// Moteur de COMBAT COOPÉRATIF EN DUO — autoritaire (Lot 4 coop).
//
// Conçu pour vivre côté serveur (cf. docs/ARCHITECTURE-COOP-DUO.md) : 2 héros +
// N ennemis, sélection SIMULTANÉE et SECRÈTE, résolution ordonnée par la
// Clairvoyance, soutien mutuel (cibler son allié), ciblage d'IA pondéré
// (provocation), victoire (tous les ennemis morts) / défaite (les DEUX héros K.O.).
//
// Réutilise le VRAI moteur (mêmes maths) : buildPlayerCombatant /
// buildEnemyCombatant / dealDamage / applyEffect / effectiveSpd. Ce module est
// PUR (aucune dépendance réseau ni DOM) : il se teste avec `node --test` et peut
// être branché tel quel derrière la passerelle WebSocket plus tard.

import {
  buildPlayerCombatant, buildEnemyCombatant, dealDamage, applyEffect,
  effectiveSpd, SPEED_UNIT,
} from "../systems/combat.js";
import { getSkill } from "../data/skills.js";
import { getState as getStateDef } from "../data/states.js";

export const SEATS = ["A", "B"];

// --- Construction -----------------------------------------------------------
// stateA / stateB : sauvegardes (état joueur) des deux héros.
// encounter : { enemies: [enemyId, ...] }  (composition data-driven, §18/§21).
export function createDuoCombat(stateA, stateB, encounter, opts = {}) {
  const heroes = {};
  const seatState = { A: stateA, B: stateB };
  for (const seat of SEATS) {
    const h = buildPlayerCombatant(seatState[seat]);
    if (!h.skills.includes("defend")) h.skills.push("defend");
    h.seat = seat;
    h.side = "hero";
    h.fxId = "hero:" + seat;
    h.threat = 0; // « menace » accumulée (dégâts récents) pour le ciblage IA (§22)
    h.healDone = 0;
    h.taunt = 0; // tours de provocation active (attire l'IA)
    h.nextAt = (SPEED_UNIT / effectiveSpd(h)) * (opts.noJitter ? 0 : Math.random() * 0.6);
    heroes[seat] = h;
  }

  const enemies = [];
  let uid = 0;
  for (const id of (encounter && encounter.enemies) || []) {
    const e = buildEnemyCombatant(id, opts);
    if (!e) continue;
    e.uid = "e" + (uid++);
    e.side = "enemy";
    e.fxId = "enemy:" + e.uid;
    e.nextAt = (SPEED_UNIT / effectiveSpd(e)) * (opts.noJitter ? 0 : Math.random() * 0.6);
    enemies.push(e);
  }

  return {
    heroes,
    enemies,
    turn: 1,
    phase: "selecting", // selecting | resolving | won | lost
    status: "active",
    pending: { A: null, B: null }, // intentions SECRÈTES (non rediffusées avant résolution)
    seenCommands: new Set(), // idempotence/anti-rejeu (§14)
    log: [],
    lastFx: [],
    events: [],
  };
}

// --- Accès / état -----------------------------------------------------------
export function livingEnemies(combat) {
  return combat.enemies.filter((e) => e.hp > 0);
}
export function livingHeroes(combat) {
  return SEATS.map((s) => combat.heroes[s]).filter((h) => h.hp > 0);
}
function unitByRef(combat, actingSeat, ref) {
  if (ref === "self") return combat.heroes[actingSeat];
  if (ref === "ally") return combat.heroes[actingSeat === "A" ? "B" : "A"];
  if (ref === "A" || ref === "B") return combat.heroes[ref];
  return combat.enemies.find((e) => e.uid === ref) || null;
}
function isSupport(skill) {
  return !!(skill.self && (!skill.power || skill.power === 0));
}

// --- Validation d'une intention (serveur autoritaire, §6) -------------------
// Renvoie { ok, error } sans JAMAIS modifier l'état si invalide.
export function validateIntent(combat, seat, intent) {
  if (combat.status !== "active" || combat.phase !== "selecting") return { ok: false, error: "OUT_OF_TURN" };
  if (!SEATS.includes(seat)) return { ok: false, error: "BAD_SEAT" };
  const hero = combat.heroes[seat];
  if (!hero || hero.hp <= 0) return { ok: false, error: "HERO_DOWN" };
  const skill = getSkill(intent.skillId);
  if (!skill) return { ok: false, error: "SKILL_UNKNOWN" };
  if (!hero.skills.includes(intent.skillId)) return { ok: false, error: "SKILL_NOT_OWNED" };
  if ((hero.cooldowns[intent.skillId] || 0) > 0) return { ok: false, error: "ON_COOLDOWN" };
  if (hero.res && skill.cost && hero.res.cur < skill.cost) return { ok: false, error: "NOT_ENOUGH_RESOURCE" };
  // Compatibilité de cible.
  const ref = intent.targetRef;
  if (isSupport(skill)) {
    // Soutien : sur soi ou sur l'allié (jamais un ennemi).
    const t = unitByRef(combat, seat, ref || "self");
    if (!t || t.side !== "hero" || t.hp <= 0) return { ok: false, error: "INVALID_TARGET" };
  } else if (skill.power > 0 && skill.target !== "self") {
    // Offensive : une cible ennemie vivante (ou « all »).
    if (ref && ref !== "all") {
      const t = unitByRef(combat, seat, ref);
      if (!t || t.side !== "enemy" || t.hp <= 0) return { ok: false, error: "INVALID_TARGET" };
    } else if (!livingEnemies(combat).length) return { ok: false, error: "INVALID_TARGET" };
  }
  return { ok: true };
}

// Dépose l'intention SECRÈTE d'un siège (remplaçable tant que non résolu, §6.11).
// `commandId` rend l'opération idempotente (§14).
export function submitIntent(combat, seat, intent) {
  if (intent.commandId) {
    if (combat.seenCommands.has(intent.commandId)) return { ok: true, status: "duplicate" };
  }
  const v = validateIntent(combat, seat, intent);
  if (!v.ok) return v;
  if (intent.commandId) combat.seenCommands.add(intent.commandId);
  combat.pending[seat] = { skillId: intent.skillId, targetRef: intent.targetRef || null, received: true };
  return { ok: true, status: "accepted" };
}

export function awaitingSeats(combat) {
  return SEATS.filter((s) => combat.heroes[s].hp > 0 && !combat.pending[s]);
}
export function bothChosen(combat) {
  return awaitingSeats(combat).length === 0;
}

// Action AUTO SÛRE pour un siège qui n'a pas répondu à temps (§10) : Défendre si
// possible, sinon attaque de base sur l'ennemi le plus menaçant. Jamais de
// ressource rare gaspillée (on se limite aux compétences sans coût).
export function autoIntent(combat, seat) {
  const hero = combat.heroes[seat];
  if (!hero || hero.hp <= 0) return null;
  if (hero.skills.includes("defend") && (hero.cooldowns.defend || 0) <= 0) return { skillId: "defend", targetRef: "self" };
  const target = livingEnemies(combat).sort((a, b) => b.hp - a.hp)[0];
  return { skillId: "basic_attack", targetRef: target ? target.uid : "all" };
}

// --- Résolution d'un tour (§9) ----------------------------------------------
function log(combat, text, kind = "info") { combat.log.push({ text, kind }); }

// Choix de cible de l'IA parmi les héros vivants (§22) : PV/Garde bas, menace
// récente, soins fournis, provocation, vulnérabilité élémentaire.
function enemyChooseTarget(combat, enemy, element) {
  const heroes = livingHeroes(combat);
  if (!heroes.length) return null;
  let best = heroes[0], bestScore = -Infinity;
  for (const h of heroes) {
    const hpFrac = h.hp / h.maxHp;
    const guardFrac = h.guardMax > 0 ? h.guardPool / h.guardMax : 1;
    let sc = 0;
    sc += 60 * (1 - hpFrac);
    sc += 25 * (1 - guardFrac);
    sc += 0.4 * (h.threat || 0);
    sc += 18 * Math.min(3, h.healDone || 0);
    sc += 200 * (h.taunt > 0 ? 1 : 0); // provocation : quasi-priorité (incitation forte)
    if (element && h.resist && h.resist[element] != null) sc += 30 * (h.resist[element] - 1);
    sc += Math.random() * 8; // petit aléa : lisible, pas robotique
    if (sc > bestScore) { bestScore = sc; best = h; }
  }
  return best;
}

// IA d'ennemi : choisit une compétence simple (soutien si en danger, sinon frappe).
function enemyChooseSkill(combat, enemy) {
  const ready = enemy.skills.filter((id) => {
    const s = getSkill(id);
    return s && (enemy.cooldowns[id] || 0) <= 0;
  });
  const hpFrac = enemy.hp / enemy.maxHp;
  // En danger : privilégier une compétence de soutien (soin/garde/bouclier).
  if (hpFrac < 0.4) {
    const sup = ready.find((id) => isSupport(getSkill(id)));
    if (sup) return sup;
  }
  // Sinon : la meilleure offensive disponible (puissance brute), défaut attaque.
  let best = "basic_attack", bestPow = 0;
  for (const id of ready) {
    const s = getSkill(id);
    if ((s.power || 0) > bestPow) { bestPow = s.power; best = id; }
  }
  return best;
}

// Applique l'action d'un héros (réutilise les vraies maths). target : combattant.
function applyHeroAction(combat, hero, intent) {
  const skill = getSkill(intent.skillId);
  if (!skill) return;
  if (hero.res && skill.cost) hero.res.cur = Math.max(0, hero.res.cur - skill.cost);

  // Soutien : effets sur soi OU sur l'allié (cibler ≠ piloter).
  if (skill.self) {
    const tgt = isSupport(skill) ? (unitByRef(combat, hero.seat, intent.targetRef || "self") || hero) : hero;
    for (const eff of skill.self) applyEffect(tgt, eff, hero.atk, combat, "player");
    if (tgt !== hero && skill.self.some((e) => e.type === "heal")) hero.healDone = (hero.healDone || 0) + 1;
    if (isSupport(skill)) {
      log(combat, `${hero.name} soutient ${tgt === hero ? "lui-même" : tgt.name} (${skill.name}).`, "player");
    }
  }

  // Offensive.
  if (skill.power > 0) {
    let targets;
    if (skill.target === "all_enemies" || intent.targetRef === "all") targets = livingEnemies(combat);
    else {
      const t = intent.targetRef ? unitByRef(combat, hero.seat, intent.targetRef) : null;
      targets = (t && t.side === "enemy" && t.hp > 0) ? [t] : livingEnemies(combat).slice(0, 1);
    }
    const hits = skill.hits || 1;
    for (const tgt of targets) {
      let total = 0, anyCrit = false, landed = false;
      for (let i = 0; i < hits && tgt.hp > 0; i++) {
        const r = dealDamage(combat, hero, tgt, skill.power, {
          skillId: intent.skillId, critBonus: skill.critBonus || 0,
          element: skill.element || hero.weaponElement || null, unavoidable: skill.unavoidable,
        });
        total += r.dmg; anyCrit = anyCrit || r.isCrit; if (!r.evaded) landed = true;
      }
      hero.threat = (hero.threat || 0) + total;
      if (landed && skill.onHit) for (const eff of skill.onHit) applyEffect(tgt, eff, hero.atk, combat, "player");
      if (landed && skill.inflicts) applyState(combat, tgt, skill.inflicts, hero.atk);
      log(combat, `${hero.name} → ${tgt.name} : ${total} dégâts${anyCrit ? " (CRITIQUE !)" : ""}.`, anyCrit ? "crit" : "player");
    }
  } else if (!skill.self) {
    log(combat, `${hero.name} utilise ${skill.name}.`, "player");
  }

  if (skill.cooldown > 0) hero.cooldowns[intent.skillId] = skill.cooldown;
}

function applyEnemyAction(combat, enemy) {
  const skillId = enemyChooseSkill(combat, enemy);
  const skill = getSkill(skillId);
  if (!skill) return;
  if (skill.self) { for (const eff of skill.self) applyEffect(enemy, eff, enemy.atk, combat, "enemy"); }
  if (skill.power > 0) {
    const element = skill.element || enemy.element || null;
    const tgt = enemyChooseTarget(combat, enemy, element);
    if (tgt) {
      const hits = skill.hits || 1;
      let total = 0, anyCrit = false, landed = false;
      for (let i = 0; i < hits && tgt.hp > 0; i++) {
        const r = dealDamage(combat, enemy, tgt, skill.power, { skillId, critBonus: skill.critBonus || 0, element });
        total += r.dmg; anyCrit = anyCrit || r.isCrit; if (!r.evaded) landed = true;
      }
      if (landed && skill.onHit) for (const eff of skill.onHit) applyEffect(tgt, eff, enemy.atk, combat, "enemy");
      if (landed && skill.inflicts) applyState(combat, tgt, skill.inflicts, enemy.atk);
      log(combat, `${enemy.name} → ${tgt.name} : ${total} dégâts${anyCrit ? " (CRITIQUE !)" : ""}.`, "enemy");
    }
  } else if (!skill.self) {
    log(combat, `${enemy.name} utilise ${skill.name}.`, "enemy");
  }
  if (skill.cooldown > 0) enemy.cooldowns[skillId] = skill.cooldown;
}

// État élémentaire (version locale au duo, mêmes données que le solo).
function applyState(combat, target, stateId, sourceAtk) {
  const def = getStateDef(stateId);
  if (!def) return;
  const max = def.maxStacks || 1;
  let entry = target.states.find((s) => s.id === stateId);
  const dotDmg = def.dot ? Math.max(1, Math.round(sourceAtk * def.dot.pctAtk)) : 0;
  if (!entry) { entry = { id: stateId, turns: def.duration, stacks: 1, dotDmg }; target.states.push(entry); }
  else { entry.turns = def.duration; entry.stacks = Math.min(max, entry.stacks + 1); if (dotDmg) entry.dotDmg = dotDmg; }
}

function allUnits(combat) {
  return [...SEATS.map((s) => combat.heroes[s]), ...combat.enemies];
}

function duoUpkeep(combat) {
  for (const c of allUnits(combat)) {
    if (c.hp <= 0) continue;
    for (const id of Object.keys(c.cooldowns)) if (c.cooldowns[id] > 0) c.cooldowns[id] -= 1;
    if (c.taunt > 0) c.taunt -= 1;
    c.threat = Math.round((c.threat || 0) * 0.6); // la menace s'estompe
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
    const tot = dot + sdot;
    if (tot > 0 && c.hp > 0) {
      c.hp = Math.max(0, c.hp - tot);
      combat.lastFx.push({ target: c.fxId, dmg: tot, crit: false, dot: true });
    }
    if (c.hp > 0 && c.pp.hpRegenPct && c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * c.pp.hpRegenPct));
    if (c.hp > 0 && c.res && c.res.gen && c.res.gen.regenPerTurn) c.res.cur = Math.min(c.res.max, c.res.cur + c.res.gen.regenPerTurn);
  }
  // Aura ambiante des ennemis (inévitable) sur les héros vivants — plafonnée.
  let auraPct = 0;
  for (const e of livingEnemies(combat)) if (e.aura && e.aura.pctMaxHp) auraPct = Math.max(auraPct, e.aura.pctMaxHp);
  if (auraPct > 0) {
    for (const h of livingHeroes(combat)) {
      const bite = Math.max(1, Math.round(h.maxHp * auraPct));
      if (h.hp > 1) { h.hp = Math.max(1, h.hp - bite); combat.lastFx.push({ target: h.fxId, dmg: bite, crit: false, dot: true }); }
    }
  }
  combat.turn += 1;
}

function checkEnd(combat) {
  if (!livingEnemies(combat).length) { combat.status = "won"; combat.phase = "won"; log(combat, "Victoire ! Tous les ennemis sont vaincus.", "reward"); return true; }
  if (!livingHeroes(combat).length) { combat.status = "lost"; combat.phase = "lost"; log(combat, "Défaite : les deux héros sont à terre...", "enemy"); return true; }
  return false;
}

// Résout le tour courant. Les sièges sans intention reçue jouent l'action AUTO
// sûre (§10) si `opts.autoFill` (défaut true). Renvoie la liste d'événements.
export function resolveTurn(combat, opts = {}) {
  if (combat.status !== "active") return { ok: false, error: "OUT_OF_TURN" };
  const autoFill = opts.autoFill !== false;
  for (const seat of SEATS) {
    const h = combat.heroes[seat];
    if (h.hp <= 0) { combat.pending[seat] = null; continue; }
    if (!combat.pending[seat]) {
      if (!autoFill) return { ok: false, error: "AWAITING", needFrom: awaitingSeats(combat) };
      combat.pending[seat] = autoIntent(combat, seat);
    }
  }

  combat.phase = "resolving";
  combat.lastFx = [];
  combat.log = [];

  // File d'initiative déterministe (Clairvoyance puis tempo brut puis id, §9).
  const order = allUnits(combat)
    .filter((u) => u.hp > 0)
    .sort((a, b) => (a.nextAt - b.nextAt) || (effectiveSpd(b) - effectiveSpd(a)) || (idOf(a) < idOf(b) ? -1 : 1));

  for (const unit of order) {
    if (combat.status !== "active" || unit.hp <= 0) continue;
    if (unit.side === "hero") {
      const intent = combat.pending[unit.seat];
      if (intent) applyHeroAction(combat, unit, intent);
    } else {
      applyEnemyAction(combat, unit);
    }
    unit.nextAt += SPEED_UNIT / effectiveSpd(unit);
    checkEnd(combat);
  }

  if (combat.status === "active") {
    duoUpkeep(combat);
    checkEnd(combat);
  }

  combat.pending = { A: null, B: null };
  if (combat.status === "active") combat.phase = "selecting";
  return { ok: true, status: combat.status, log: combat.log.slice(), fx: combat.lastFx.slice() };
}

function idOf(u) { return u.side === "hero" ? "hero:" + u.seat : u.uid; }

// Vue filtrée d'état (ce que le client reçoit — pas les sélections secrètes, §8.2).
export function publicView(combat) {
  const unit = (u) => ({
    id: idOf(u), name: u.name, side: u.side, fxId: u.fxId,
    hp: u.hp, maxHp: u.maxHp, guardPool: u.guardPool, guardMax: u.guardMax,
    resource: u.res ? { id: u.res.id, cur: u.res.cur, max: u.res.max } : null,
    buffs: u.buffs.map((b) => ({ type: b.type, turns: b.turns })),
    states: u.states.map((s) => ({ id: s.id, turns: s.turns, stacks: s.stacks })),
    down: u.hp <= 0, taunt: u.taunt > 0,
  });
  return {
    turn: combat.turn, phase: combat.phase, status: combat.status,
    heroes: { A: unit(combat.heroes.A), B: unit(combat.heroes.B) },
    enemies: combat.enemies.map(unit),
    awaiting: awaitingSeats(combat),
    turnOrderPreview: allUnits(combat).filter((u) => u.hp > 0)
      .sort((a, b) => a.nextAt - b.nextAt).map(idOf),
  };
}
