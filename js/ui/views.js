// Rendu des écrans (HTML en chaîne). Les vues sont (presque) pures : elles lisent
// l'état et produisent du HTML ; les interactions passent par des attributs
// data-act gérés dans main.js.

import { esc, sigil, bar, fmt, fmtDuration } from "./dom.js";
import { getClass, CLASSES } from "../data/classes.js";
import { getSkill } from "../data/skills.js";
import { JOBS } from "../data/jobs.js";
import { RESOURCES, getResource } from "../data/resources.js";
import { EQUIPMENT, getEquipment, SLOTS, ARMOR_FAMILIES } from "../data/equipment.js";
import { RECIPES, STATIONS } from "../data/recipes.js";
import { ENEMIES, getEnemy } from "../data/enemies.js";
import { ZONES } from "../data/zones.js";
import { getDerivedStats } from "../core/character.js";
import { charXpToNext, jobXpToNext } from "../core/progression.js";
import { activityProgress, activityRemainingMs } from "../systems/jobs.js";
import { craftableTimes, canCraft } from "../systems/crafting.js";
import { OBJECTIVES } from "../systems/objectives.js";

const STAT_LABELS = { maxHp: "PV max", atk: "Attaque", def: "Défense", spd: "Vitesse", crit: "Critique" };
const STAT_ICONS = { maxHp: "❤️", atk: "⚔️", def: "🛡️", spd: "💨", crit: "🎯" };

// ---------------------------------------------------------------------------
// Création de personnage
// ---------------------------------------------------------------------------
export function renderCreation() {
  const cards = Object.values(CLASSES)
    .map((c) => {
      const locked = c.locked;
      return `
      <div class="class-card ${locked ? "locked" : "selectable"}" data-act="${locked ? "" : "pick-class"}" data-id="${c.id}">
        ${sigil(c.image, classEmoji(c.id), "lg")}
        <div class="class-card-body">
          <h3>${esc(c.name)} ${locked ? '<span class="tag">Bientôt</span>' : ""}</h3>
          <p class="muted">${esc(c.tagline)}</p>
        </div>
      </div>`;
    })
    .join("");

  return `
    <section class="panel creation">
      <h1 class="title">Forge ta légende</h1>
      <p class="muted center">Choisis ta classe. Pour ce prototype, seul le <strong>Guerrier</strong> est jouable.</p>
      <div class="class-grid">${cards}</div>
      <div class="creation-form" id="creation-form" hidden>
        <label>Nom du héros
          <input id="hero-name" type="text" maxlength="20" placeholder="Aventurier" autocomplete="off" />
        </label>
        <button class="btn primary" data-act="confirm-create">Commencer l'aventure</button>
      </div>
    </section>`;
}

function classEmoji(id) {
  return { warrior: "🗡️", guardian: "🛡️", archer: "🏹", mage: "🔮", assassin: "🗡️" }[id] || "⚔️";
}

// ---------------------------------------------------------------------------
// Objectifs de départ (bandeau)
// ---------------------------------------------------------------------------
export function renderObjectives(state) {
  const o = state.objectives || {};
  if (OBJECTIVES.every((ob) => o[ob.id])) return ""; // tout accompli -> on masque
  const items = OBJECTIVES.map((ob) => {
    const done = !!o[ob.id];
    return `<li class="obj ${done ? "done" : ""}"><span class="obj-mark">${done ? "✓" : "○"}</span>${esc(ob.label)}</li>`;
  }).join("");
  return `
    <div class="objectives-card">
      <span class="obj-title">⚜ Premiers pas</span>
      <ul class="obj-list">${items}</ul>
    </div>`;
}

// ---------------------------------------------------------------------------
// Barre supérieure (toujours visible)
// ---------------------------------------------------------------------------
// Contenu (sans image) de la zone d'activité du topbar — mis à jour à chaque tick.
export function topbarActivityInner(state) {
  if (!state.activity) return '<span class="muted">Aucune activité</span>';
  const job = JOBS[state.activity.jobId];
  const action = job.actions.find((a) => a.id === state.activity.actionId);
  const p = activityProgress(state) * 100;
  const remain = fmtDuration(activityRemainingMs(state));
  return `
    <span class="activity-label">${job.icon} ${esc(action ? action.name : "")} · <strong>${remain}</strong></span>
    <div class="bar tiny"><div class="bar-fill" style="width:${p}%"></div></div>`;
}

function pct(value, max) {
  return Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
}

export function renderTopbar(state) {
  const ch = state.character;
  const cls = getClass(ch.classId);
  const ds = getDerivedStats(state);
  const xpNext = charXpToNext(ch.level);

  // Les éléments qui varient dans le temps ont un id : mis à jour sans recréer
  // les <img> (sinon clignotement à chaque tick).
  return `
    <div class="top-hero">
      ${sigil(cls.image, classEmoji(cls.id))}
      <div class="top-id">
        <div class="top-name">${esc(ch.name)} <span class="muted">· ${esc(cls.name)}</span></div>
        <div class="top-lvl">Niv. ${ch.level}</div>
      </div>
    </div>
    <div class="top-bars">
      <div class="bar-row"><span class="bar-icon">❤️</span>
        <div class="bar hp"><div class="bar-fill" id="tb-hp-fill" style="width:${pct(ch.hpCurrent, ds.maxHp)}%"></div></div>
        <span class="bar-num" id="tb-hp-num">${fmt(ch.hpCurrent)}/${fmt(ds.maxHp)}</span></div>
      <div class="bar-row"><span class="bar-icon">✨</span>
        <div class="bar xp"><div class="bar-fill" id="tb-xp-fill" style="width:${pct(ch.xp, xpNext)}%"></div></div>
        <span class="bar-num" id="tb-xp-num">${fmt(ch.xp)}/${fmt(xpNext)}</span></div>
    </div>
    <div class="top-side">
      <div class="gold" id="tb-gold">🪙 ${fmt(state.gold)}</div>
      <div class="top-activity" id="tb-activity">${topbarActivityInner(state)}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Écran Personnage
// ---------------------------------------------------------------------------
export function renderCharacter(state) {
  const ch = state.character;
  const cls = getClass(ch.classId);
  const ds = getDerivedStats(state);

  const stats = ["maxHp", "atk", "def", "spd", "crit"]
    .map((k) => `<div class="stat"><span class="stat-ico">${STAT_ICONS[k]}</span><span class="stat-lbl">${STAT_LABELS[k]}</span><span class="stat-val">${k === "crit" ? ds[k] + " %" : fmt(ds[k])}</span></div>`)
    .join("");

  const slots = Object.keys(SLOTS)
    .map((slot) => {
      const itemId = ch.equipment[slot];
      if (!itemId) {
        return `<div class="slot empty"><span class="slot-name">${SLOTS[slot]}</span><span class="muted">— vide —</span></div>`;
      }
      const item = getEquipment(itemId);
      return `
        <div class="slot filled">
          ${sigil(item.image, item.icon)}
          <div class="slot-info">
            <span class="slot-name">${SLOTS[slot]}</span>
            <strong>${esc(item.name)} ${familyTag(item)}</strong>
            <span class="muted small">${statLine(item.stats)}</span>
          </div>
          <button class="btn tiny" data-act="unequip" data-slot="${slot}">Retirer</button>
        </div>`;
    })
    .join("");

  const activeSkills = cls.skills
    .map((id) => getSkill(id))
    .filter(Boolean)
    .map((s) => `<li><strong>${esc(s.name)}</strong> — <span class="muted">${esc(s.desc)}</span></li>`)
    .join("");
  const passive = cls.passive ? getSkill(cls.passive) : null;

  return `
    <section class="panel">
      <div class="char-head">
        ${sigil(cls.image, classEmoji(cls.id), "lg")}
        <div>
          <h2>${esc(ch.name)}</h2>
          <p class="muted">${esc(cls.name)} · Niveau ${ch.level}</p>
          <p class="muted small">${esc(cls.desc)}</p>
        </div>
      </div>
      <h3 class="section-title">Statistiques</h3>
      <div class="stat-grid">${stats}</div>
      <h3 class="section-title">Équipement</h3>
      <div class="slot-list">${slots}</div>
      <h3 class="section-title">Compétences</h3>
      <ul class="skill-list">
        ${activeSkills}
        ${passive ? `<li><strong>${esc(passive.name)}</strong> <span class="tag">Passive</span> — <span class="muted">${esc(passive.desc)}</span></li>` : ""}
      </ul>
    </section>`;
}

function familyTag(item) {
  if (!item.family) return "";
  const f = ARMOR_FAMILIES[item.family];
  return f ? `<span class="tag" style="border-color:${f.color};color:${f.color}">${f.name}</span>` : "";
}

function statLine(stats) {
  return Object.keys(stats)
    .map((k) => {
      const v = stats[k];
      const label = { hp: "PV", atk: "ATK", def: "DEF", spd: "VIT", crit: "CRIT" }[k] || k;
      return `${v > 0 ? "+" : ""}${v} ${label}`;
    })
    .join(" · ");
}

// ---------------------------------------------------------------------------
// Écran Métiers
// ---------------------------------------------------------------------------
export function renderJobs(state) {
  const blocks = Object.values(JOBS)
    .map((job) => {
      const jp = state.jobs[job.id];
      const xpNext = jobXpToNext(jp.level);
      const actions = job.actions
        .map((a) => renderJobAction(state, job, a))
        .join("");
      return `
        <div class="job-block">
          <div class="job-head">
            ${sigil(job.image, job.icon)}
            <div class="job-id">
              <strong>${esc(job.name)}</strong> <span class="muted">Niv. ${jp.level}</span>
              ${bar(jp.xp, xpNext, "xp")}
              <span class="muted small">${fmt(jp.xp)}/${fmt(xpNext)} XP</span>
            </div>
          </div>
          <div class="action-list">${actions}</div>
        </div>`;
    })
    .join("");

  return `<section class="panel"><h2>Métiers</h2><p class="muted">Une seule activité de récolte à la fois. Elle continue même hors-ligne.</p>${blocks}</section>`;
}

function renderJobAction(state, job, a) {
  const jp = state.jobs[job.id];
  const locked = jp.level < a.levelReq;
  const isActive = state.activity && state.activity.jobId === job.id && state.activity.actionId === a.id;
  const yields = a.drops
    .map((d) => {
      const r = getResource(d.resource);
      const range = d.min === d.max ? `${d.min}` : `${d.min}-${d.max}`;
      const chance = d.chance < 1 ? ` ${Math.round(d.chance * 100)}%` : "";
      return `<span class="yield">${r.icon} ${esc(r.name)} ×${range}${chance}</span>`;
    })
    .join("");

  let control;
  if (locked) control = `<button class="btn tiny" disabled>Niv. ${a.levelReq}</button>`;
  else if (isActive) {
    const p = activityProgress(state) * 100;
    const remain = fmtDuration(activityRemainingMs(state));
    control = `
      <div class="action-active">
        <div class="action-progress">
          <div class="bar"><div class="bar-fill" id="job-active-fill" style="width:${p}%"></div></div>
          <span class="remain" id="job-active-remain">${remain}</span>
        </div>
        <button class="btn tiny danger" data-act="stop-activity">Arrêter</button>
      </div>`;
  } else {
    control = `<button class="btn tiny" data-act="start-activity" data-job="${job.id}" data-id="${a.id}">Démarrer</button>`;
  }

  return `
    <div class="action ${locked ? "locked" : ""} ${isActive ? "active" : ""}">
      <div class="action-main">
        <strong>${esc(a.name)}</strong>
        <span class="muted small">⏱ ${(a.durationMs / 1000).toFixed(0)} s · +${a.xp} XP</span>
        <div class="yields">${yields}</div>
      </div>
      <div class="action-ctrl">${control}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Écran Craft
// ---------------------------------------------------------------------------
export function renderCraft(state) {
  const sections = Object.values(STATIONS)
    .map((station) => {
      const recipes = RECIPES.filter((r) => r.station === station.id);
      if (!recipes.length) return "";
      const items = recipes.map((r) => renderRecipe(state, r)).join("");
      return `<div class="craft-station"><h3 class="section-title">${station.icon} ${esc(station.name)}</h3><div class="recipe-grid">${items}</div></div>`;
    })
    .join("");

  return `<section class="panel"><h2>Atelier</h2><p class="muted">Transforme tes ressources en équipement.</p>${sections}</section>`;
}

function renderRecipe(state, recipe) {
  const out = recipe.output;
  const outDef = out.type === "equipment" ? getEquipment(out.id) : getResource(out.id);
  const check = canCraft(state, recipe);
  const times = craftableTimes(state, recipe);

  const inputs = recipe.inputs
    .map((inp) => {
      const r = getResource(inp.resource);
      const have = state.inventory.resources[inp.resource] || 0;
      const ok = have >= inp.qty;
      return `<span class="ingredient ${ok ? "" : "missing"}">${r.icon} ${esc(r.name)} ${have}/${inp.qty}</span>`;
    })
    .join("");

  const stats = out.type === "equipment" ? `<span class="muted small">${statLine(outDef.stats)} ${familyTag(outDef)}</span>` : "";

  return `
    <div class="recipe ${check.ok ? "" : "cant"}">
      ${sigil(outDef.image, outDef.icon)}
      <div class="recipe-body">
        <strong>${esc(outDef.name)}${out.qty > 1 ? " ×" + out.qty : ""}</strong>
        ${stats}
        <div class="ingredients">${inputs}</div>
      </div>
      <button class="btn tiny ${check.ok ? "primary" : ""}" data-act="craft" data-id="${recipe.id}" ${check.ok ? "" : "disabled"}>
        ${check.ok ? "Fabriquer" : check.reason}
      </button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Écran Inventaire
// ---------------------------------------------------------------------------
export function renderInventory(state) {
  const res = Object.keys(state.inventory.resources)
    .filter((id) => state.inventory.resources[id] > 0)
    .sort((a, b) => (getResource(a)?.tier || 0) - (getResource(b)?.tier || 0));
  const resHtml = res.length
    ? res
        .map((id) => {
          const r = getResource(id);
          return `<div class="inv-item" title="${esc(r.desc)}">${sigil(r.image, r.icon)}<span class="inv-name">${esc(r.name)}</span><span class="inv-qty">×${fmt(state.inventory.resources[id])}</span></div>`;
        })
        .join("")
    : '<p class="muted">Aucune ressource. Lance un métier !</p>';

  const eqIds = Object.keys(state.inventory.equipment).filter((id) => state.inventory.equipment[id] > 0);
  const eqHtml = eqIds.length
    ? eqIds
        .map((id) => {
          const item = getEquipment(id);
          const canEquip = state.character.level >= (item.levelReq || 0);
          return `
            <div class="inv-gear">
              ${sigil(item.image, item.icon)}
              <div class="inv-gear-info">
                <strong>${esc(item.name)} ${familyTag(item)}</strong>
                <span class="muted small">${SLOTS[item.slot]} · ${statLine(item.stats)}</span>
                <span class="muted small">×${state.inventory.equipment[id]}${item.levelReq ? " · Niv. " + item.levelReq : ""}</span>
              </div>
              <button class="btn tiny ${canEquip ? "primary" : ""}" data-act="equip" data-id="${id}" ${canEquip ? "" : "disabled"}>${canEquip ? "Équiper" : "Niv. " + item.levelReq}</button>
            </div>`;
        })
        .join("")
    : '<p class="muted">Aucun équipement. Forge-en à l\'atelier !</p>';

  return `
    <section class="panel">
      <h2>Inventaire</h2>
      <h3 class="section-title">Ressources</h3>
      <div class="inv-grid">${resHtml}</div>
      <h3 class="section-title">Équipement</h3>
      <div class="gear-list">${eqHtml}</div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Écran Combat — sélection de zone / d'ennemi
// ---------------------------------------------------------------------------
export function renderZones(state) {
  const zone = Object.values(ZONES)[0];
  const enemies = zone.enemies
    .map((id) => {
      const e = getEnemy(id);
      return `
        <div class="enemy-card">
          ${sigil(e.image, e.icon)}
          <div class="enemy-info"><strong>${esc(e.name)}</strong><span class="muted small">Niv. ${e.level} · ❤️ ${e.stats.hp}</span></div>
          <button class="btn tiny" data-act="fight" data-id="${e.id}">Combattre</button>
        </div>`;
    })
    .join("");

  const boss = getEnemy(zone.boss);
  const bossCard = `
    <div class="enemy-card boss">
      ${sigil(boss.image, boss.icon, "lg")}
      <div class="enemy-info"><strong>${esc(boss.name)}</strong> <span class="tag boss-tag">BOSS</span><span class="muted small">Niv. ${boss.level} · ❤️ ${boss.stats.hp}</span></div>
      <button class="btn ${state.flags.bossDefeated ? "" : "primary"}" data-act="fight" data-id="${boss.id}">${state.flags.bossDefeated ? "Réaffronter" : "Affronter"}</button>
    </div>`;

  return `
    <section class="panel">
      <div class="zone-head">
        ${sigil(zone.image, zone.icon, "lg")}
        <div><h2>${esc(zone.name)}</h2><p class="muted">${esc(zone.desc)}</p><p class="muted small">Niveau conseillé : ${zone.recommendedLevel}+</p></div>
      </div>
      <h3 class="section-title">Ennemis</h3>
      <div class="enemy-list">${enemies}</div>
      <h3 class="section-title">Boss</h3>
      ${bossCard}
      <p class="muted small hint">💡 Tes PV se régénèrent au fil du temps hors combat.</p>
    </section>`;
}

// ---------------------------------------------------------------------------
// Écran Combat — la bataille
// ---------------------------------------------------------------------------
// Log de combat (texte seulement, mis à jour de façon ciblée).
export function renderBattleLog(combat) {
  return combat.log
    .slice(-40)
    .map((l) => `<div class="log-line ${l.kind}">${esc(l.text)}</div>`)
    .join("");
}

// Contrôles : barre de compétences (combat actif) ou écran de fin (sans image).
export function renderBattleControls(state, combat) {
  if (combat.status === "active") {
    const btns = combat.player.skills
      .map((id) => {
        const s = getSkill(id);
        const cd = combat.player.cooldowns[id] || 0;
        return `<button class="btn skill-btn" data-act="skill" data-id="${id}" ${cd > 0 ? "disabled" : ""} title="${esc(s.desc)}">
            ${esc(s.name)}${cd > 0 ? ` <span class="cd">(${cd})</span>` : ""}
          </button>`;
      })
      .join("");
    return `<div class="skill-bar">${btns}</div>`;
  }
  const won = combat.status === "won";
  let rewardHtml = "";
  if (won && combat.rewards) {
    const drops = combat.rewards.drops.map((d) => `<li>${esc(d.name)} ×${d.qty}</li>`).join("");
    rewardHtml = `
      <div class="reward-box">
        <p>+${combat.rewards.xp} XP · +${combat.rewards.gold} 🪙</p>
        ${drops ? `<ul class="drop-list">${drops}</ul>` : '<p class="muted small">Aucun butin cette fois.</p>'}
        ${combat.rewards.levels > 0 ? `<p class="lvlup">Niveau ${state.character.level} atteint !</p>` : ""}
      </div>`;
  }
  return `
    <div class="battle-end">
      <h3 class="${won ? "win" : "lose"}">${won ? "Victoire !" : "Défaite..."}</h3>
      ${rewardHtml}
      <div class="end-actions">
        ${won ? `<button class="btn primary" data-act="fight" data-id="${combat.enemyId}">Rejouer</button>` : ""}
        <button class="btn" data-act="leave-combat">Retour à la zone</button>
      </div>
    </div>`;
}

export function renderBattle(state, combat) {
  const p = combat.player;
  const e = combat.enemy;

  // Les barres ont un id : mises à jour à chaque tour SANS recréer les portraits.
  return `
    <section class="panel battle">
      <div class="battle-arena">
        <div class="combatant enemy-side">
          ${sigil(e.image, e.icon, "lg")}
          <strong>${esc(e.name)}</strong>
          <div class="bar-row">
            <div class="bar hp enemy"><div class="bar-fill" id="bt-enemy-fill" style="width:${pct(e.hp, e.maxHp)}%"></div></div>
            <span class="bar-num" id="bt-enemy-num">${fmt(e.hp)}/${fmt(e.maxHp)}</span>
          </div>
        </div>
        <div class="vs">⚔</div>
        <div class="combatant player-side">
          ${sigil(getClass(state.character.classId).image, classEmoji(state.character.classId), "lg")}
          <strong>${esc(p.name)}</strong>
          <div class="bar-row">
            <div class="bar hp"><div class="bar-fill" id="bt-player-fill" style="width:${pct(p.hp, p.maxHp)}%"></div></div>
            <span class="bar-num" id="bt-player-num">${fmt(p.hp)}/${fmt(p.maxHp)}</span>
          </div>
        </div>
      </div>
      <div class="battle-log" id="battle-log">${renderBattleLog(combat)}</div>
      <div id="bt-controls">${renderBattleControls(state, combat)}</div>
    </section>`;
}
