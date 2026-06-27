// Rendu des écrans (HTML en chaîne). Les vues sont (presque) pures : elles lisent
// l'état et produisent du HTML ; les interactions passent par des attributs
// data-act gérés dans main.js.

import { esc, sigil, bar, fmt, fmtDuration, chainImg } from "./dom.js";
import { getClass, CLASSES } from "../data/classes.js";
import { getSkill } from "../data/skills.js";
import { getClassResource } from "../data/classResources.js";
import { FAMILIARS, allFamiliars, FAMILIAR_ROLES, EGGS, LINK_MAX, FEED_ESSENCE_COST } from "../data/familiars.js";
import { ensureFamiliars, familiarLevelCap } from "../systems/familiars.js";
import { familiarXpAt } from "../data/curves.js";
import { JOBS, unlockedTiers, bestTier, nextTier } from "../data/jobs.js";
import { RESOURCES, getResource } from "../data/resources.js";
import { EQUIPMENT, getEquipment, SLOTS, ARMOR_FAMILIES } from "../data/equipment.js";
import { effectiveStats, MAX_UPGRADE } from "../core/items.js";
import { getRarity } from "../data/rarities.js";
import { upgradeCost, canUpgrade, dismantleReward } from "../systems/gear.js";
import { RECIPES, STATIONS } from "../data/recipes.js";
import { ENEMIES, getEnemy } from "../data/enemies.js";
import { ZONES, allZones } from "../data/zones.js";
import { enemyUnlock, zoneProgress, zoneUnlocked } from "../systems/zoneprog.js";
import { getDerivedStats, getStatDetails, canWieldWeapon, getActiveSpec, specUnlocked, nextRespecCost, familyCounts, activeMaterialBonuses, accessory2Unlocked } from "../core/character.js";
import { MATERIALS } from "../data/materials.js";
import { forecastTurns, whyCannotUse, enemyIntentInfo, DEF_K, DEF_CAP } from "../systems/combat.js";
import { getState as getStateDef } from "../data/states.js";
import { getElement } from "../data/elements.js";
import { specsForClass, SPEC_UNLOCK_LEVEL } from "../data/specializations.js";
import { charXpToNext, jobXpToNext } from "../core/progression.js";
import { activityProgress, activityRemainingMs, activeTier } from "../systems/jobs.js";
import { craftableTimes, canCraft, recipeAllowedForClass } from "../systems/crafting.js";
import { OBJECTIVES, objectiveHint, rewardLabel } from "../systems/objectives.js";
import { getGuide } from "../data/guides.js";
import { evaluateAchievements, unlockedCount } from "../systems/achievements.js";
import { ACHIEVEMENTS } from "../data/achievements.js";

// Icône pièce d'or (image fournie). Utilisée dans les contextes HTML (pas les
// attributs title ni les toasts, qui restent en texte).
const COIN = '<img class="coin-ico" src="assets/ui/gold.png" alt="or" />';

const STAT_LABELS = { maxHp: "PV max", atk: "Attaque", def: "Défense", spd: "Vitesse", crit: "Critique" };
const STAT_ICONS = { maxHp: "❤️", atk: "⚔️", def: "🛡️", spd: "💨", crit: "🎯" };
const STAT_TIP = {
  maxHp: "Quantité totale de dégâts que tu peux encaisser.",
  atk: "Base de tes dégâts infligés.",
  def: "Réduit chaque attaque reçue avec des rendements décroissants (formule def/(def+90)), plafonnée à 75 % : jamais 0 dégât.",
  spd: "La Vitesse détermine la fréquence des actions (initiative). Un personnage plus rapide agit plus souvent (au plus 2 fois d'affilée) et réduit légèrement ses recharges (jusqu'à -20 %).",
  crit: "Chance d'infliger un coup critique (×1,6 dégâts).",
};

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
      <p class="muted center">Choisis ta classe. Les <strong>cinq classes</strong> sont jouables — chacune a son identité, ses forces et ses faiblesses.</p>
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
  // La première quête non accomplie reçoit un indice (comment la réussir).
  const firstOpen = OBJECTIVES.find((ob) => !o[ob.id]);
  const items = OBJECTIVES.map((ob) => {
    const done = !!o[ob.id];
    const active = ob === firstOpen;
    const rl = rewardLabel(ob.reward);
    return `<li class="obj ${done ? "done" : ""}${active ? " active" : ""}">
        <span class="obj-mark">${done ? "✓" : "○"}</span>${esc(ob.label)}${rl ? ` <span class="muted small">(${esc(rl)})</span>` : ""}
        ${active ? `<span class="obj-hint">${esc(objectiveHint(state, ob.id))}</span>` : ""}
      </li>`;
  }).join("");
  return `
    <div class="objectives-card">
      <span class="obj-title">⚜ Quêtes de découverte</span>
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
  const tier = activeTier(state);
  const p = activityProgress(state) * 100;
  const remain = fmtDuration(activityRemainingMs(state));
  return `
    <span class="activity-label">${job.icon} ${esc(tier ? tier.name : "")} · <strong>${remain}</strong></span>
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
      <div class="topbar-actions">
        <button class="gear-btn help-btn" data-act="open-guide" title="Aide / Guide" aria-label="Aide">?</button>
        <button class="gear-btn" data-act="open-options" title="Options" aria-label="Options">⚙</button>
      </div>
      <div class="gold" id="tb-gold">${COIN} <span id="tb-gold-num">${fmt(state.gold)}</span></div>
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

  const det = getStatDetails(state);
  const stats = ["maxHp", "atk", "def", "spd", "crit"]
    .map((k) => {
      const d = det[k];
      const parts = [`base ${fmt(d.base)}`];
      if (d.equip) parts.push(`équip. ${d.equip > 0 ? "+" : ""}${fmt(d.equip)}`);
      if (d.bonus) parts.push(`bonus ${d.bonus > 0 ? "+" : ""}${fmt(d.bonus)}`);
      // Détail spécifique : réduction de dégâts effective de la Défense.
      let extra = "";
      if (k === "def") {
        const red = Math.round(Math.min(DEF_CAP, d.total / (d.total + DEF_K)) * 100);
        extra = ` <span class="muted">→ −${red}% dégâts subis</span>`;
      }
      const valTxt = k === "crit" ? d.total + " %" : fmt(d.total);
      return `
        <div class="stat" title="${esc(STAT_TIP[k])}">
          <span class="stat-ico">${STAT_ICONS[k]}</span>
          <span class="stat-lbl">${STAT_LABELS[k]}</span>
          <span class="stat-val">${valTxt}</span>
          <span class="stat-break muted small">${parts.join(" · ")}${extra}</span>
        </div>`;
    })
    .join("");

  const acc2Locked = !accessory2Unlocked(state);
  const slots = Object.keys(SLOTS)
    .map((slot) => {
      const inst = ch.equipment[slot];
      if (!inst) {
        if (slot === "accessory2" && acc2Locked) {
          return `<div class="slot empty locked"><span class="slot-name">${SLOTS[slot]}</span><span class="muted small">🔒 Vaincre un boss pour débloquer</span></div>`;
        }
        return `<div class="slot empty"><span class="slot-name">${SLOTS[slot]}</span><span class="muted">— vide —</span></div>`;
      }
      const item = getEquipment(inst.baseId);
      const r = getRarity(inst.rarity);
      return `
        <div class="slot filled" style="border-left:3px solid ${r.color}">
          ${sigil(item.image, item.icon)}
          <div class="slot-info">
            <span class="slot-name">${SLOTS[slot]}</span>
            <div class="gear-title"><strong style="color:${r.color}">${esc(item.name)}</strong>${upgradeSuffix(inst)}${rarityTag(inst)}${familyTag(item)}${elementBadge(inst)}</div>
            <span class="muted small">${statLine(effectiveStats(inst))}</span>
            ${affixList(inst)}
          </div>
          <button class="btn tiny" data-act="unequip" data-slot="${slot}">Retirer</button>
        </div>`;
    })
    .join("");

  const res = getClassResource(cls.id);
  const skillMeta = (s) => {
    const bits = [];
    if (s.cost) bits.push(`Coût ${s.cost}${res ? " " + res.name : ""}`);
    if (s.cooldown > 0) bits.push(`Récup. ${s.cooldown}`);
    return bits.length ? ` <span class="tag tiny">${esc(bits.join(" · "))}</span>` : "";
  };
  const activeSkills = ["basic_attack", ...cls.skills]
    .map((id) => getSkill(id))
    .filter(Boolean)
    .map((s) => `<li><strong>${esc(s.name)}</strong>${skillMeta(s)} — <span class="muted">${esc(s.desc)}</span></li>`)
    .join("");
  const passive = cls.passive ? getSkill(cls.passive) : null;
  const resLine = res
    ? `<p class="muted small res-note"><span style="color:${res.color}">${res.icon || ""} <strong>${esc(res.name)}</strong></span> — ${esc(res.desc)}</p>`
    : "";

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
      ${renderMaterialSection(state)}
      <h3 class="section-title">Compétences</h3>
      ${resLine}
      <ul class="skill-list">
        ${activeSkills}
        ${passive ? `<li><strong>${esc(passive.name)}</strong> <span class="tag">Passive</span> — <span class="muted">${esc(passive.desc)}</span></li>` : ""}
      </ul>
      ${renderSpecSection(state)}
    </section>`;
}

// Décrit en clair les bonus d'une spécialisation (stats permanentes, passive,
// maîtrise, compétence accordée).
function specBonusLines(spec) {
  const out = [];
  const m = spec.statMods || {};
  const pctLbl = { atkPct: "ATK", defPct: "DEF", hpPct: "PV", spdPct: "VIT" };
  for (const k of Object.keys(pctLbl)) if (m[k]) out.push(`${m[k] > 0 ? "+" : ""}${Math.round(m[k] * 100)} % ${pctLbl[k]}`);
  if (m.critFlat) out.push(`+${m.critFlat} % crit`);
  const p = spec.passive || {};
  if (p.lifestealPct) out.push(`Vol de vie ${Math.round(p.lifestealPct * 100)} %`);
  if (p.hpRegenPct) out.push(`Régén. ${Math.round(p.hpRegenPct * 100)} %/tour`);
  if (p.skillPowerPct) out.push(`Compétences +${Math.round(p.skillPowerPct * 100)} %`);
  if (p.lowHpAtk) out.push(`ATK +${Math.round(p.lowHpAtk.bonus * 100)} % sous ${Math.round(p.lowHpAtk.threshold * 100)} % PV`);
  if (p.execute) out.push(`+${Math.round(p.execute.bonus * 100)} % dégâts sous ${Math.round(p.execute.threshold * 100)} % PV cible`);
  if (p.vsDebuff) out.push(`+${Math.round(p.vsDebuff.bonus * 100)} % dégâts sur cible affaiblie`);
  return out;
}

function renderSpecCard(state, spec, active, cost) {
  const skill = (spec.grants || []).map((id) => getSkill(id)).filter(Boolean)[0];
  const bonuses = specBonusLines(spec).map((b) => `<span class="spec-bonus">${esc(b)}</span>`).join("");
  const mLbl = spec.mastery ? `Maîtrise ${esc(spec.mastery.wtype)} : ${specBonusLines({ statMods: spec.mastery }).join(" · ") || "bonus"}` : "";
  let btn;
  if (active) btn = `<span class="tag spec-current">Voie actuelle</span>`;
  else if (cost > 0) btn = `<button class="btn tiny" data-act="choose-spec" data-spec="${spec.id}">Changer · ${fmt(cost)} ${COIN}</button>`;
  else btn = `<button class="btn tiny primary" data-act="choose-spec" data-spec="${spec.id}">Choisir</button>`;
  return `
    <div class="spec-card ${active ? "active" : ""}">
      <div class="spec-head"><strong>${esc(spec.name)}</strong>${btn}</div>
      <p class="muted small">${esc(spec.desc)}</p>
      <div class="spec-bonuses">${bonuses}</div>
      ${skill ? `<p class="muted small">⚡ <strong>${esc(skill.name)}</strong> — ${esc(skill.desc)}</p>` : ""}
      ${mLbl ? `<p class="muted small">🏅 ${mLbl}</p>` : ""}
    </div>`;
}

// Section « Voie » : verrouillée avant le niveau 10, sinon choix/affichage de la
// spécialisation (premier choix gratuit, changements payants).
function renderSpecSection(state) {
  if (!specUnlocked(state)) {
    const lvl = state.character.level;
    return `
      <h3 class="section-title">Voie</h3>
      <p class="muted">🔒 Spécialisation débloquée au <strong>niveau ${SPEC_UNLOCK_LEVEL}</strong> (niveau actuel : ${lvl}). Trois voies par classe, chacune avec ses bonus, sa compétence et sa maîtrise d'arme.</p>`;
  }
  const specs = specsForClass(state.character.classId);
  const active = getActiveSpec(state);
  const cost = nextRespecCost(state);
  const intro = active
    ? `Voie actuelle : <strong>${esc(active.name)}</strong>. Changer de voie coûte de l'or (coût croissant).`
    : `Choisis ta voie — <strong>le premier choix est gratuit</strong>.`;
  const cards = specs.map((s) => renderSpecCard(state, s, active && active.id === s.id, cost)).join("");
  return `
    <h3 class="section-title">Voie</h3>
    <p class="muted small">${intro}</p>
    <div class="spec-grid">${cards}</div>`;
}

// Section « Matériaux d'armure » : compte des pièces par matériau et seuils 2/4.
function renderMaterialSection(state) {
  const counts = familyCounts(state);
  const rows = Object.values(MATERIALS)
    .map((mat) => {
      const n = counts[mat.id] || 0;
      const active2 = n >= 2;
      const active4 = n >= 4;
      const tier = (on, label) => `<div class="mat-tier ${on ? "on" : ""}">${on ? "✓" : "○"} ${esc(label)}</div>`;
      return `
        <div class="mat-card" style="border-left:3px solid ${mat.color}">
          <div class="mat-head"><strong style="color:${mat.color}">${esc(mat.name)}</strong> <span class="muted small">${n}/5 pièces</span></div>
          <p class="muted small">${esc(mat.identity)}</p>
          ${tier(active2, mat.bonus2.label)}
          ${tier(active4, mat.bonus4.label)}
        </div>`;
    })
    .join("");
  return `
    <h3 class="section-title">Matériaux d'armure</h3>
    <p class="muted small">Mixe les matériaux : 2 pièces activent un bonus, 4 pièces un bonus majeur avec un passif. Les builds hybrides cumulent plusieurs bonus « 2 pièces ».</p>
    <div class="mat-grid">${rows}</div>`;
}

function familyTag(item) {
  if (!item.family) return "";
  const f = ARMOR_FAMILIES[item.family];
  return f ? `<span class="tag" style="border-color:${f.color};color:${f.color}">${f.name}</span>` : "";
}

function rarityTag(inst) {
  const r = getRarity(inst.rarity);
  return `<span class="tag rarity" style="border-color:${r.color};color:${r.color}">${r.name}</span>`;
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

// Badge d'élément d'une arme (Lot 13).
function elementBadge(inst) {
  if (!inst || !inst.element) return "";
  const el = getElement(inst.element);
  if (!el) return "";
  return ` <span class="el-tag" style="border-color:${el.color};color:${el.color}">${el.icon} ${esc(el.name)}</span>`;
}

// Texte lisible d'un affixe (Lot 13).
function affixText(af) {
  const el = af.element ? getElement(af.element) : null;
  if (af.kind === "resist") return `Résist. ${el ? el.icon + " " + el.name : ""} +${Math.round(af.value * 100)} %`;
  if (af.kind === "elementDmg") return `Dégâts ${el ? el.icon + " " + el.name : ""} +${Math.round(af.value * 100)} %`;
  if (af.kind === "combat") return `${af.label} +${Math.round(af.value * 100)} %`;
  // stat
  if (af.stat === "critFlat") return `Crit +${af.value} %`;
  return `${af.label} +${Math.round(af.value * 100)} %`;
}

// Liste d'affixes d'une instance (puces). Vide si aucun.
function affixList(inst) {
  if (!inst || !inst.affixes || !inst.affixes.length) return "";
  return `<div class="affixes">${inst.affixes.map((af) => `<span class="affix">${esc(affixText(af))}</span>`).join("")}</div>`;
}

const STAT_SHORT = { hp: "PV", atk: "ATK", def: "DEF", spd: "VIT", crit: "CRIT" };

// Comparaison honnête stat par stat (candidat vs pièce équipée). Pas de « score »
// unique : on montre les vraies différences, au joueur de décider selon son build.
function compareLine(a, b) {
  if (!b) return '<span class="muted">aucune pièce équipée</span>';
  const parts = [];
  for (const k of ["atk", "def", "hp", "spd", "crit"]) {
    const d = (a[k] || 0) - (b[k] || 0);
    if (!d) continue;
    const color = d > 0 ? "#5fcf95" : "#e08a86";
    parts.push(`<span style="color:${color}">${d > 0 ? "+" : ""}${d} ${STAT_SHORT[k]}</span>`);
  }
  return parts.length ? `vs équipé : ${parts.join(" · ")}` : "équivalent à l'équipé";
}

// Badge « +N » de renforcement à côté du nom (rien si +0).
function upgradeSuffix(inst) {
  return inst.lvl > 0 ? ` <span class="plus">+${inst.lvl}</span>` : "";
}

function rc(state, id) {
  return state.inventory.resources[id] || 0;
}

// Prévisualisation avant/après des stats qui changent au prochain renforcement.
function statDiffPreview(inst) {
  const cur = effectiveStats(inst);
  const next = effectiveStats({ ...inst, lvl: (inst.lvl || 0) + 1 });
  return (
    Object.keys(next)
      .filter((k) => next[k] !== cur[k])
      .map((k) => `${STAT_SHORT[k] || k} ${cur[k]}→<strong>${next[k]}</strong>`)
      .join(" · ") || "—"
  );
}

// Coût d'un renforcement, chaque composante rougie si non payable.
function costLine(state, cost) {
  const mat = getResource(cost.material.id);
  const part = (have, need, label) =>
    `<span class="${have >= need ? "" : "lack"}">${label} ${need}</span>`;
  return [
    part(state.gold, cost.gold, COIN),
    part(rc(state, "equip_essence"), cost.essence, "✨"),
    part(rc(state, cost.material.id), cost.material.qty, `${mat ? mat.icon : "❔"}`),
  ].join(" · ");
}

// ---------------------------------------------------------------------------
// Écran Métiers
// ---------------------------------------------------------------------------
export function renderJobs(state) {
  const blocks = Object.values(JOBS)
    .map((job) => renderJobBlock(state, job))
    .join("");
  return `<section class="panel"><h2>Métiers</h2><p class="muted">Une seule activité à la fois. Elle progresse même hors-ligne (efficacité réduite). L'activité principale évolue automatiquement quand ton métier monte de niveau.</p>${blocks}</section>`;
}

// Liste des butins d'un palier (ressource principale + secondaires + chances).
function tierYields(tier) {
  return tier.drops
    .map((d) => {
      const r = getResource(d.resource);
      const range = d.min === d.max ? `${d.min}` : `${d.min}-${d.max}`;
      const chance = d.chance < 1 ? ` <span class="muted">${Math.round(d.chance * 100)}%</span>` : "";
      const primary = d.resource === tier.resource ? " primary" : "";
      return `<span class="yield${primary}">${r.icon} ${esc(r.name)} ×${range}${chance}</span>`;
    })
    .join("");
}

// Un métier = une activité principale évolutive + un sélecteur de palier optionnel.
function renderJobBlock(state, job) {
  const jp = state.jobs[job.id];
  const xpNext = jobXpToNext(jp.level);
  const unlocked = unlockedTiers(job.id, jp.level); // meilleur -> moindre
  const isJobActive = state.activity && state.activity.jobId === job.id;
  const shownTier = isJobActive ? activeTier(state) : bestTier(job.id, jp.level);
  const nxt = nextTier(job.id, jp.level);

  let body;
  if (!shownTier) {
    body = `<p class="muted small">Aucun palier disponible.</p>`;
  } else {
    const isActive = isJobActive;
    let control;
    if (isActive) {
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
      control = `<button class="btn tiny primary" data-act="start-activity" data-job="${job.id}" data-auto="1">Démarrer</button>`;
    }

    // Sélecteur de palier : actif seulement si plusieurs paliers sont débloqués.
    let selector = "";
    if (unlocked.length > 1) {
      const chips = unlocked
        .slice()
        .sort((a, b) => a.minLevel - b.minLevel)
        .map((t) => {
          const sel = shownTier && t.id === shownTier.id ? " selected" : "";
          return `<button class="tier-chip${sel}" data-act="start-activity" data-job="${job.id}" data-tier="${t.id}" title="${esc(getResource(t.resource)?.name || t.name)}">${esc(t.name)}</button>`;
        })
        .join("");
      selector = `<div class="tier-select"><span class="muted small">Palier :</span>${chips}</div>`;
    }

    body = `
      <div class="job-activity ${isActive ? "active" : ""}">
        <div class="action-main">
          <strong>${esc(shownTier.name)}</strong>
          <span class="muted small">⏱ ${(shownTier.durationMs / 1000).toFixed(0)} s · +${shownTier.xp} XP</span>
          <div class="yields">${tierYields(shownTier)}</div>
        </div>
        <div class="action-ctrl">${control}</div>
      </div>
      ${selector}
      ${nxt ? `<p class="muted small next-tier">🔒 Prochain palier : <strong>${esc(nxt.name)}</strong> au niveau ${nxt.minLevel}</p>` : `<p class="muted small">Palier maximal atteint.</p>`}`;
  }

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
      ${body}
    </div>`;
}

// ---------------------------------------------------------------------------
// Écran Craft (Atelier) — catégories, filtres et recherche
// ---------------------------------------------------------------------------

// Filtres par défaut (l'état des filtres vit dans main.js).
export function defaultCraftFilters() {
  return { cat: "all", cls: "all", craftable: false, search: "" };
}

// Catégorie d'une recette (data-driven, dérivée de sa sortie).
const CRAFT_CATEGORIES = [
  { id: "all", label: "Tout" },
  { id: "weapon", label: "Armes" },
  { id: "armor", label: "Armures" },
  { id: "accessory", label: "Accessoires" },
  { id: "material", label: "Matériaux" },
];
function recipeCategory(recipe) {
  const out = recipe.output;
  if (out.type === "resource") return "material";
  const tpl = getEquipment(out.id);
  if (!tpl) return "other";
  if (tpl.slot === "weapon") return "weapon";
  if (tpl.slot === "head" || tpl.slot === "chest" || tpl.slot === "legs") return "armor";
  if (tpl.slot === "accessory") return "accessory";
  return "other";
}

// Classes capables de manier une arme d'un type donné (pour l'affichage compat).
function classesForWtype(wtype) {
  return Object.values(CLASSES).filter((c) => (c.weapons || []).includes(wtype));
}

// La recette correspond-elle au filtre de classe ? Les armes sont restreintes au
// type maniable ; armures/accessoires/matériaux restent universels.
function matchesClass(recipe, clsId) {
  if (clsId === "all") return true;
  const out = recipe.output;
  if (out.type !== "equipment") return true;
  const tpl = getEquipment(out.id);
  if (!tpl) return true;
  if (tpl.slot !== "weapon" || !tpl.wtype) return true; // armure/accessoire = universel
  const cls = getClass(clsId);
  return cls && (cls.weapons || []).includes(tpl.wtype);
}

// Recherche textuelle : nom de l'objet + nom des matériaux (filtre « par matériau »).
function matchesSearch(recipe, q) {
  if (!q) return true;
  q = q.toLowerCase();
  const out = recipe.output;
  const outDef = out.type === "equipment" ? getEquipment(out.id) : getResource(out.id);
  if (outDef && outDef.name.toLowerCase().includes(q)) return true;
  for (const inp of recipe.inputs) {
    const r = getResource(inp.resource);
    if (r && r.name.toLowerCase().includes(q)) return true;
  }
  return false;
}

// Résumé compact des métiers de transformation (niveaux).
function renderProfessionsSummary(state) {
  const chips = Object.values(STATIONS)
    .map((st) => {
      const prof = (state.professions && state.professions[st.id]) || { level: 1 };
      return `<span class="prof-chip" title="${esc(st.desc || "")}">${st.icon} ${esc(st.name)} <strong>${prof.level}</strong></span>`;
    })
    .join("");
  return `<div class="prof-summary">${chips}</div>`;
}

// Barre de filtres (catégorie, classe, réalisable, recherche).
function renderCraftFilterBar(state, f) {
  const catChips = CRAFT_CATEGORIES.map(
    (c) => `<button class="filter-chip ${f.cat === c.id ? "selected" : ""}" data-act="craft-filter" data-key="cat" data-val="${c.id}">${esc(c.label)}</button>`
  ).join("");
  const clsChips = [{ id: "all", name: "Toutes classes" }, ...Object.values(CLASSES)]
    .map((c) => `<button class="filter-chip ${f.cls === c.id ? "selected" : ""}" data-act="craft-filter" data-key="cls" data-val="${c.id}">${esc(c.name)}</button>`)
    .join("");
  return `
    <div class="craft-filters">
      <input id="craft-search" class="craft-search" type="text" placeholder="Rechercher (objet ou matériau)…" value="${esc(f.search)}" autocomplete="off" />
      <div class="filter-row">${catChips}</div>
      <div class="filter-row">${clsChips}</div>
      <div class="filter-row">
        <button class="filter-chip ${f.craftable ? "selected" : ""}" data-act="craft-filter" data-key="craftable" data-val="toggle">✓ Réalisable maintenant</button>
      </div>
    </div>`;
}

export function renderCraft(state, filters = defaultCraftFilters()) {
  return `
    <section class="panel">
      <h2>Atelier</h2>
      <p class="muted small">Transforme tes ressources en équipement. Chaque arme forgée reçoit un élément et des affixes aléatoires : re-craft pour varier ton build.</p>
      ${renderProfessionsSummary(state)}
      ${renderCraftFilterBar(state, filters)}
      <div id="craft-results">${renderCraftResults(state, filters)}</div>
    </section>`;
}

// Liste filtrée des recettes, groupée par catégorie (mise à jour ciblée possible).
export function renderCraftResults(state, filters = defaultCraftFilters()) {
  const f = filters;
  let recipes = RECIPES.filter((r) => {
    // Cohérence : par défaut (filtre « toutes classes »), on masque les armes que
    // TA classe ne peut pas manier. Choisir une classe précise reste possible
    // pour consulter ses recettes (navigation).
    if (f.cls === "all" && !recipeAllowedForClass(state, r)) return false;
    if (f.cat !== "all" && recipeCategory(r) !== f.cat) return false;
    if (!matchesClass(r, f.cls)) return false;
    if (!matchesSearch(r, f.search)) return false;
    if (f.craftable && !canCraft(state, r).ok) return false;
    return true;
  });

  if (!recipes.length) {
    return `<p class="muted center" style="padding:18px 0">Aucune recette ne correspond à ces filtres.</p>`;
  }

  // Groupement par catégorie pour une lecture claire.
  const order = ["weapon", "armor", "accessory", "material", "other"];
  const labels = { weapon: "Armes", armor: "Armures", accessory: "Accessoires", material: "Matériaux", other: "Objets spéciaux" };
  const groups = {};
  for (const r of recipes) {
    const c = recipeCategory(r);
    (groups[c] = groups[c] || []).push(r);
  }
  return order
    .filter((c) => groups[c])
    .map((c) => {
      const items = groups[c].map((r) => renderRecipe(state, r)).join("");
      return `<div class="craft-cat"><h3 class="section-title">${esc(labels[c])}</h3><div class="recipe-grid">${items}</div></div>`;
    })
    .join("");
}

function renderRecipe(state, recipe) {
  const out = recipe.output;
  const outDef = out.type === "equipment" ? getEquipment(out.id) : getResource(out.id);
  const check = canCraft(state, recipe);
  const station = STATIONS[recipe.station];

  const inputs = recipe.inputs
    .map((inp) => {
      const r = getResource(inp.resource);
      const have = state.inventory.resources[inp.resource] || 0;
      const ok = have >= inp.qty;
      return `<span class="ingredient ${ok ? "" : "missing"}">${r.icon} ${esc(r.name)} ${have}/${inp.qty}</span>`;
    })
    .join("");

  // Méta : type + métier requis + classes compatibles (armes) + XP de métier.
  const typeLabel =
    out.type === "resource"
      ? "Matériau"
      : { weapon: "Arme", head: "Tête", chest: "Torse", legs: "Jambes", accessory: "Accessoire" }[outDef.slot] || "Objet";
  const profReq = recipe.profReq || 1;
  const metaParts = [typeLabel, `${station ? esc(station.name) : ""} niv. ${profReq}`];
  if (recipe.levelReq) metaParts.push("Niv. " + recipe.levelReq);
  const meta = `<span class="recipe-meta muted">${metaParts.filter(Boolean).join(" · ")}</span>`;

  const isWeapon = out.type === "equipment" && outDef.slot === "weapon";
  const extra = out.type === "equipment" ? `<span class="recipe-meta muted">✦ ${isWeapon ? "Élément + affixes" : "Affixes"} aléatoires</span>` : "";
  const stats = out.type === "equipment"
    ? `<span class="muted small">${statLine(outDef.stats)} ${familyTag(outDef)}</span>${extra}`
    : `<span class="muted small">+${recipe.profXp || 0} XP ${esc(station ? station.name : "métier")}</span>`;

  return `
    <div class="recipe ${check.ok ? "" : "cant"}">
      ${sigil(outDef.image, outDef.icon)}
      <div class="recipe-body">
        <strong>${esc(outDef.name)}${out.qty > 1 ? " ×" + out.qty : ""}</strong>
        ${meta}
        ${stats}
        <div class="ingredients">${inputs}</div>
      </div>
      <button class="btn tiny ${check.ok ? "primary" : ""}" data-act="craft" data-id="${recipe.id}" ${check.ok ? "" : "disabled"} title="${check.ok ? "Fabriquer" : esc(check.reason)}">
        ${check.ok ? "Fabriquer" : esc(check.reason)}
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

  const instances = state.inventory.equipment.slice().sort((a, b) => {
    const ta = getEquipment(a.baseId), tb = getEquipment(b.baseId);
    const sa = Object.keys(SLOTS).indexOf(ta?.slot), sb = Object.keys(SLOTS).indexOf(tb?.slot);
    if (sa !== sb) return sa - sb;
    const ra = getRarity(a.rarity).rank, rb = getRarity(b.rarity).rank;
    if (ra !== rb) return rb - ra;
    return (tb?.levelReq || 0) - (ta?.levelReq || 0);
  });
  const eqHtml = instances.length
    ? instances
        .map((inst) => {
          const item = getEquipment(inst.baseId);
          if (!item) return "";
          const r = getRarity(inst.rarity);
          const levelOk = state.character.level >= (item.levelReq || 0);
          const compatible = canWieldWeapon(state, item);
          const canEquip = levelOk && compatible;
          const equipLabel = !compatible ? "Incompatible" : !levelOk ? "Niv. " + item.levelReq : "Équiper";
          const equipTitle = !compatible ? "Ta classe ne peut pas manier ce type d'arme." : "";
          // Comparaison HONNÊTE (stat par stat) avec la pièce équipée du même slot.
          const equipped = state.character.equipment[item.slot];
          const cmp = compareLine(effectiveStats(inst), equipped ? effectiveStats(equipped) : null);

          // Ligne de renforcement : aperçu avant/après + coût, ou « max ».
          const cost = upgradeCost(inst);
          const up = canUpgrade(state, inst);
          const upLine = cost
            ? `<span class="muted small upgrade-preview">▶ +${inst.lvl}→+${inst.lvl + 1} : ${statDiffPreview(inst)} <span class="cost">(${costLine(state, cost)})</span></span>`
            : `<span class="muted small">✦ Renforcement max (+${MAX_UPGRADE})</span>`;

          const dr = dismantleReward(inst);
          return `
            <div class="inv-gear" style="border-left:3px solid ${r.color}">
              ${sigil(item.image, item.icon)}
              <div class="inv-gear-info">
                <div class="gear-title"><strong style="color:${r.color}">${esc(item.name)}</strong>${upgradeSuffix(inst)}${rarityTag(inst)}${familyTag(item)}${elementBadge(inst)}</div>
                <span class="muted small">${SLOTS[item.slot]} · ${statLine(effectiveStats(inst))}</span>
                <span class="muted small">${item.levelReq ? "Niv. " + item.levelReq : "Aucun prérequis"} · ${cmp}</span>
                ${affixList(inst)}
                ${upLine}
              </div>
              <div class="inv-gear-actions">
                <button class="btn tiny ${canEquip ? "primary" : ""}" data-act="equip" data-uid="${inst.uid}" ${canEquip ? "" : "disabled"} title="${esc(equipTitle)}">${equipLabel}</button>
                <button class="btn tiny" data-act="upgrade" data-uid="${inst.uid}" ${cost && up.ok ? "" : "disabled"} title="${cost ? esc(up.ok ? "Renforcer cette pièce" : up.reason) : "Niveau maximum"}">Améliorer</button>
                <button class="btn tiny ghost" data-act="dismantle" data-uid="${inst.uid}" title="Démanteler : +🪙${dr.gold} +✨${dr.essence}">Démanteler</button>
              </div>
            </div>`;
        })
        .join("")
    : '<p class="muted">Aucun équipement. Forge-en à l\'atelier ou pille des ennemis !</p>';

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
// Guides contextuels & Succès (Lot 12)
// ---------------------------------------------------------------------------
export function renderGuide(guideId) {
  const g = getGuide(guideId);
  if (!g) return "";
  const lines = g.lines.map((l) => `<li>${esc(l)}</li>`).join("");
  return `
    <h2>Guide — ${esc(g.title)}</h2>
    <ul class="guide-list">${lines}</ul>
    <p class="muted small">Tu peux rouvrir ce guide via le bouton d'aide, ou désactiver les guides dans les options.</p>
    <div class="end-actions"><button class="btn primary" data-act="close-modal">Compris</button></div>`;
}

export function renderAchievements(state) {
  const list = evaluateAchievements(state);
  const cats = [...new Set(ACHIEVEMENTS.map((a) => a.cat))];
  const sections = cats
    .map((cat) => {
      const rows = list
        .filter((a) => a.cat === cat)
        .map((a) => {
          const pr = a.progress && !a.unlocked ? ` <span class="muted small">(${a.progress.cur}/${a.progress.max})</span>` : "";
          return `<li class="ach ${a.unlocked ? "done" : ""}">
              <span class="ach-mark">${a.unlocked ? "★" : "☆"}</span>
              <span><strong>${esc(a.name)}</strong>${a.badge ? ' <span class="tag tiny">Badge</span>' : ""}${pr}<br><span class="muted small">${esc(a.desc)}</span></span>
            </li>`;
        })
        .join("");
      return `<h3 class="section-title">${esc(cat)}</h3><ul class="ach-list">${rows}</ul>`;
    })
    .join("");
  return `
    <h2>Succès — ${unlockedCount(state)}/${ACHIEVEMENTS.length}</h2>
    ${sections}
    <div class="end-actions"><button class="btn" data-act="close-modal">Fermer</button></div>`;
}

// ---------------------------------------------------------------------------
// Écran Familiers (Lot 11)
// ---------------------------------------------------------------------------
const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

function linkPips(link) {
  let s = "";
  for (let i = 0; i < LINK_MAX; i++) s += `<span class="link-pip ${i < link ? "on" : ""}"></span>`;
  return `<span class="link-bar" title="Lien ${link}/${LINK_MAX}">${s}</span>`;
}

function familiarPassiveLines(fam) {
  const p = fam.passive || {};
  const out = [];
  if (p.skillPowerPct) out.push(`Compétences +${Math.round(p.skillPowerPct * 100)} %`);
  if (p.lifestealPct) out.push(`Vol de vie +${Math.round(p.lifestealPct * 100)} %`);
  if (p.hpRegenPct) out.push(`Régén. ${Math.round(p.hpRegenPct * 100)} %/tour`);
  if (p.critFlat) out.push(`Crit +${p.critFlat} %`);
  if (p.spdPct) out.push(`Vitesse +${Math.round(p.spdPct * 100)} %`);
  if (p.maxHpPct) out.push(`PV max +${Math.round(p.maxHpPct * 100)} %`);
  if (p.elementDmgPct) for (const el of Object.keys(p.elementDmgPct)) {
    const e = getElement(el);
    out.push(`${e ? e.name : el} +${Math.round(p.elementDmgPct[el] * 100)} %`);
  }
  return out;
}

function filterChip(act, key, val, cur, label) {
  return `<button class="zone-chip ${cur === val ? "active" : ""}" data-act="${act}" data-key="${key}" data-val="${val}">${esc(label)}</button>`;
}

export function renderFamiliars(state, filters = { element: "all", role: "all", rarity: "all" }) {
  const f = ensureFamiliars(state);
  const cap = familiarLevelCap(state);

  // --- Œufs + essence ---
  const eggBtns = Object.values(EGGS)
    .map((egg) => {
      const n = f.eggs[egg.id] || 0;
      const r = getRarity(egg.id === "common" ? "common" : egg.id);
      const eggSvg = `<svg viewBox="0 0 24 30" width="20" height="26" aria-hidden="true"><path d="M12 1 C6 1 2 12 2 19 a10 10 0 0 0 20 0 C22 12 18 1 12 1 Z" fill="${r.color}22" stroke="${r.color}" stroke-width="1.6"/><path d="M7 16 l3 3 l-2 3 M15 14 l-2 4 l3 2" stroke="${r.color}" stroke-width="1.2" fill="none" opacity="0.7"/></svg>`;
      return `<div class="egg-card">
          <div class="egg-ico" style="border-color:${r.color}">${eggSvg}</div>
          <div class="egg-info"><strong style="color:${r.color}">${esc(egg.name)}</strong><span class="muted small">En réserve : ${n}</span></div>
          <button class="btn tiny ${n > 0 ? "primary" : ""}" data-act="hatch-egg" data-egg="${egg.id}" ${n > 0 ? "" : "disabled"}>Faire éclore</button>
        </div>`;
    })
    .join("");

  // --- Filtres ---
  const elements = ["all", ...new Set(allFamiliars().map((x) => x.element))];
  const roles = ["all", ...Object.keys(FAMILIAR_ROLES)];
  const rarities = ["all", "common", "uncommon", "rare", "epic", "legendary"];
  const elChips = elements.map((el) => filterChip("familiar-filter", "element", el, filters.element, el === "all" ? "Tous éléments" : getElement(el)?.name || el)).join("");
  const roleChips = roles.map((r) => filterChip("familiar-filter", "role", r, filters.role, r === "all" ? "Tous rôles" : FAMILIAR_ROLES[r].name)).join("");
  const rarChips = rarities.map((r) => filterChip("familiar-filter", "rarity", r, filters.rarity, r === "all" ? "Toutes raretés" : getRarity(r).name)).join("");

  // --- Collection (possédés + silhouettes à découvrir) ---
  const list = allFamiliars()
    .filter((fam) => (filters.element === "all" || fam.element === filters.element)
      && (filters.role === "all" || fam.role === filters.role)
      && (filters.rarity === "all" || fam.rarity === filters.rarity))
    .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.element.localeCompare(b.element));

  const cards = list
    .map((fam) => {
      const owned = f.owned[fam.id];
      const r = getRarity(fam.rarity);
      const el = getElement(fam.element);
      const role = FAMILIAR_ROLES[fam.role];
      if (!owned) {
        return `<div class="fam-card locked" style="border-color:${r.color}33">
            <div class="fam-portrait silhouette">${sigil("", "")}</div>
            <div class="fam-body"><strong class="muted">? ? ?</strong>
              <span class="muted small">${el ? el.icon : ""} ${esc(r.name)} · ${role ? role.name : ""}</span>
              <span class="muted small">Non découvert</span></div>
          </div>`;
      }
      const equipped = f.equipped === fam.id;
      const need = familiarXpAt(owned.level);
      const xpPct = owned.level >= cap ? 100 : Math.min(100, Math.round((owned.xp / need) * 100));
      const passives = familiarPassiveLines(fam).map((x) => `<span class="spec-bonus">${esc(x)}</span>`).join("");
      return `<div class="fam-card ${equipped ? "equipped" : ""}" style="border-color:${r.color}">
          <div class="fam-portrait">${sigil(fam.image, "")}</div>
          <div class="fam-body">
            <div class="fam-title"><strong style="color:${r.color}">${esc(fam.name)}</strong>
              <span class="tag rarity" style="border-color:${r.color};color:${r.color}">${r.name}</span></div>
            <span class="muted small">${el ? el.icon + " " + el.name : ""} · ${role ? role.name : ""} · Niv. ${owned.level}${owned.level >= cap ? " (max)" : ""}</span>
            <div class="bar tiny"><div class="bar-fill xp" style="width:${xpPct}%"></div></div>
            ${linkPips(owned.link)}
            <div class="spec-bonuses">${passives}</div>
            <p class="muted small">${esc(fam.desc)}</p>
            <div class="fam-actions">
              <button class="btn tiny ${equipped ? "" : "primary"}" data-act="equip-familiar" data-id="${fam.id}">${equipped ? "Équipé ✓" : "Équiper"}</button>
              <button class="btn tiny" data-act="feed-familiar" data-id="${fam.id}" ${owned.link >= LINK_MAX || f.essence < FEED_ESSENCE_COST ? "disabled" : ""}>Nourrir · ${FEED_ESSENCE_COST} ✦</button>
            </div>
          </div>
        </div>`;
    })
    .join("");

  const discovered = Object.keys(f.owned).length;
  return `
    <section class="panel">
      <h2>Familiers</h2>
      <p class="muted small">Découverts : ${discovered}/${allFamiliars().length} · Essence de familier : <strong>${f.essence} ✦</strong>. Un familier équipé t'épaule en combat (soutien léger) et gagne de l'expérience.</p>
      <h3 class="section-title">Œufs</h3>
      <div class="egg-list">${eggBtns}</div>
      <h3 class="section-title">Collection</h3>
      <div class="fam-filters">${elChips}</div>
      <div class="fam-filters">${roleChips}</div>
      <div class="fam-filters">${rarChips}</div>
      <div class="fam-grid">${cards || '<p class="muted">Aucun familier pour ce filtre.</p>'}</div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Écran Combat — sélection de zone / d'ennemi
// ---------------------------------------------------------------------------
// Ligne de bestiaire d'un ennemi : résistances/faiblesses, cachées tant qu'on
// ne l'a pas affronté (découverte progressive).
function bestiaryLine(state, enemy) {
  const resist = enemy.resist || {};
  const keys = Object.keys(resist);
  if (!keys.length) return "";
  const known = state.bestiary && state.bestiary[enemy.id] && state.bestiary[enemy.id].resistKnown;
  if (!known) return `<span class="muted small bestiary">⚲ Résistances inconnues — affronte-le pour les révéler</span>`;
  const tag = (k, cls) => {
    const el = getElement(k);
    return el ? `<span class="el-tag ${cls}" style="border-color:${el.color};color:${el.color}">${el.icon} ${esc(el.name)}</span>` : "";
  };
  const weak = keys.filter((k) => resist[k] > 1).map((k) => tag(k, "weak")).join(" ");
  const res = keys.filter((k) => resist[k] < 1).map((k) => tag(k, "res")).join(" ");
  return `<div class="bestiary-line small">${weak ? `<span class="muted">Faible : </span>${weak} ` : ""}${res ? `<span class="muted">Résiste : </span>${res}` : ""}</div>`;
}

export function renderZones(state, selectedZoneId) {
  const zonesList = Object.values(ZONES);
  // Zone sélectionnée (défaut : 1re). Si verrouillée, on retombe sur la 1re.
  let zone = zonesList.find((z) => z.id === selectedZoneId) || zonesList[0];
  if (!zoneUnlocked(state, zone.id).unlocked) zone = zonesList[0];

  // Sélecteur de zones (cartes/chips). Zone verrouillée -> non cliquable + raison.
  const zoneChips = zonesList
    .map((z) => {
      const u = zoneUnlocked(state, z.id);
      const active = z.id === zone.id;
      const done = zoneProgress(state, z.id) >= 100;
      if (!u.unlocked) {
        return `<button class="zone-chip locked" disabled title="Verrouillée : ${esc(u.reason)}">${z.icon} ${esc(z.name)} <span class="lock">🔒</span></button>`;
      }
      return `<button class="zone-chip ${active ? "active" : ""}" data-act="select-zone" data-zone="${z.id}">${z.icon} ${esc(z.name)}${done ? ' <span class="zone-done">✓</span>' : ""}</button>`;
    })
    .join("");
  const zoneSelector = `<div class="zone-selector">${zoneChips}</div>`;

  const prog = zoneProgress(state, zone.id);
  const defeated = (id) => (state.counters && state.counters.defeated && state.counters.defeated[id]) || 0;

  const enemies = zone.enemies
    .map((id) => {
      const e = getEnemy(id);
      const u = enemyUnlock(state, id);
      const kills = defeated(id);
      const btn = u.unlocked
        ? `<button class="btn tiny" data-act="fight" data-id="${e.id}">Combattre</button>`
        : `<button class="btn tiny" disabled>Verrouillé</button>`;
      const sub = u.unlocked
        ? `Niv. ${e.level} · PV ${e.stats.hp}${kills ? ` · vaincu ×${kills}` : ""}`
        : `Requis : ${esc(u.reasons.join(" · "))}`;
      return `
        <div class="enemy-card ${u.unlocked ? "" : "locked"}">
          ${sigil(e.image, e.icon)}
          <div class="enemy-info"><strong>${esc(e.name)}</strong><span class="muted small">${sub}</span>${bestiaryLine(state, e)}</div>
          ${btn}
        </div>`;
    })
    .join("");

  const boss = getEnemy(zone.boss);
  const bu = enemyUnlock(state, zone.boss);
  const bossBtn = bu.unlocked
    ? `<button class="btn ${state.flags.bossDefeated ? "" : "primary"}" data-act="fight" data-id="${boss.id}">${state.flags.bossDefeated ? "Réaffronter" : "Affronter"}</button>`
    : `<button class="btn" disabled>Verrouillé</button>`;
  const bossSub = bu.unlocked
    ? `Niv. ${boss.level} · PV ${boss.stats.hp}`
    : `Requis : ${esc(bu.reasons.join(" · "))}`;

  const elTags = (zone.elements || [])
    .map((id) => {
      const el = getElement(id);
      return el ? `<span class="el-tag" style="border-color:${el.color};color:${el.color}">${el.icon} ${esc(el.name)}</span>` : "";
    })
    .join(" ");

  return `
    <section class="panel">
      ${zoneSelector}
      <div class="zone-head">
        ${sigil(zone.image, zone.icon, "lg")}
        <div><h2>${esc(zone.name)}</h2><p class="muted">${esc(zone.desc)}</p>
          <p class="muted small">Niveau conseillé : ${zone.recommendedLevel}+${elTags ? ` · Éléments : ${elTags}` : ""}</p></div>
      </div>
      <div class="zone-prog">
        <div class="bar"><div class="bar-fill xp" style="width:${prog}%"></div></div>
        <span class="muted small">Progression de la zone : ${prog}%${prog >= 100 ? " — terminée" : ""}</span>
      </div>
      <h3 class="section-title">Ennemis</h3>
      <div class="enemy-list">${enemies}</div>
      <h3 class="section-title">Boss</h3>
      <div class="enemy-card boss ${bu.unlocked ? "" : "locked"}">
        ${sigil(boss.image, boss.icon, "lg")}
        <div class="enemy-info"><strong>${esc(boss.name)}</strong> <span class="tag boss-tag">BOSS</span><span class="muted small">${bossSub}</span></div>
        ${bossBtn}
      </div>
      <p class="muted small hint">Tes PV se régénèrent au fil du temps hors combat.</p>
    </section>`;
}

// ---------------------------------------------------------------------------
// Écran Combat — la bataille
// ---------------------------------------------------------------------------
// Pastille d'élément (couleur + infobulle).
function elementDot(elementId) {
  const el = getElement(elementId);
  if (!el) return "";
  return `<span class="el-dot" style="background:${el.color}" title="${esc(el.name)}"></span>`;
}

// Icônes des états actifs d'un combattant (avec cumul et infobulle).
export function renderStates(c) {
  if (!c || !c.states || !c.states.length) return "";
  return c.states
    .map((st) => {
      const d = getStateDef(st.id);
      if (!d) return "";
      return `<span class="state-chip" style="border-color:${d.color}" title="${esc(d.name)} — ${esc(d.desc)}">${d.icon}${st.stacks > 1 ? `<b>${st.stacks}</b>` : ""}</span>`;
    })
    .join("");
}

// Aperçu de l'ordre probable des prochains tours (chips Toi / Adversaire).
export function renderForecast(combat) {
  const order = forecastTurns(combat, 6);
  if (!order.length) return "";
  const chips = order
    .map((who) => `<span class="fc-chip ${who === "player" ? "you" : "foe"}">${who === "player" ? "Toi" : "Adv."}</span>`)
    .join("");
  return `<span class="muted small">Ordre probable :</span> ${chips}`;
}

// Intention télégraphiée du boss (prochaine action annoncée). Permet au joueur
// de se préparer (défendre, affaiblir, interrompre). Vide pour les non-boss.
export function renderIntent(combat) {
  const info = enemyIntentInfo(combat);
  if (!info) return "";
  const el = info.element ? getElement(info.element) : null;
  const dot = el ? `<span class="el-dot" style="background:${el.color}"></span>` : "";
  const phase = info.phase ? `<span class="intent-phase">${esc(info.phase)}</span>` : "";
  return `<div class="intent ${info.danger ? "danger" : ""}">
      <span class="intent-ico">${info.danger ? "⚠" : "◔"}</span>
      <span class="intent-txt">${combat.enemy.name} prépare : ${dot}<strong>${esc(info.name)}</strong></span>${phase}
    </div>`;
}

// Log de combat (texte seulement, mis à jour de façon ciblée).
export function renderBattleLog(combat) {
  return combat.log
    .slice(-40)
    .map((l) => `<div class="log-line ${l.kind}">${esc(l.text)}</div>`)
    .join("");
}

// Barre de ressource de classe (Mana, Rage, Garde, Concentration, Ombre).
export function renderResourceBar(res) {
  if (!res) return "";
  const w = Math.max(0, Math.min(100, (res.cur / res.max) * 100));
  return `
    <div class="res-bar" title="${esc(res.name)} : ${res.cur}/${res.max}">
      <span class="res-icon" style="color:${res.color}">${res.icon || ""}</span>
      <span class="res-name">${esc(res.name)}</span>
      <div class="res-track"><div class="res-fill" style="width:${w}%;background:${res.color}"></div></div>
      <span class="res-val">${res.cur}/${res.max}</span>
    </div>`;
}

// Contrôles : barre de compétences (combat actif) ou écran de fin (sans image).
export function renderBattleControls(state, combat) {
  if (combat.status === "active") {
    const res = combat.player.res;
    const btns = combat.player.skills
      .map((id) => {
        const s = getSkill(id);
        const cd = combat.player.cooldowns[id] || 0;
        const reason = whyCannotUse(combat, id);
        const cost = s.cost || 0;
        const costTag = cost > 0 ? ` <span class="sk-cost${reason === "resource" ? " lack" : ""}" style="${res ? `color:${res.color}` : ""}">${cost}</span>` : "";
        const tip = `${s.desc}${cost > 0 && res ? ` — Coût : ${cost} ${res.name}` : ""}${s.cooldown > 0 ? ` — Récup. ${s.cooldown}` : ""}`;
        return `<button class="btn skill-btn" data-act="skill" data-id="${id}" ${reason ? "disabled" : ""} title="${esc(tip)}">
            ${s.element ? elementDot(s.element) : ""}${esc(s.name)}${costTag}${cd > 0 ? ` <span class="cd">(${cd})</span>` : ""}
          </button>`;
      })
      .join("");
    return `${renderResourceBar(res)}<div class="skill-bar">${btns}</div>`;
  }
  const won = combat.status === "won";
  let rewardHtml = "";
  if (won && combat.rewards) {
    const drops = combat.rewards.drops
      .map((d) => {
        if (d.type === "equipment") {
          const r = getRarity(d.rarity);
          return `<li style="color:${r.color}">${esc(d.name)} <span class="tag rarity" style="border-color:${r.color};color:${r.color}">${r.name}</span></li>`;
        }
        return `<li>${esc(d.name)} ×${d.qty}</li>`;
      })
      .join("");
    rewardHtml = `
      <div class="reward-box">
        <p>+${combat.rewards.xp} XP · +${combat.rewards.gold} ${COIN}</p>
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

// Zone d'où provient l'ennemi (pour le décor d'arène). Data-driven, retombe
// sur la première zone si non trouvée.
function zoneForEnemy(enemyId) {
  for (const z of allZones()) {
    if (z.boss === enemyId || (z.enemies || []).includes(enemyId)) return z;
  }
  return allZones()[0];
}

// Image d'un combattant avec secours PNG -> SVG -> emoji.
// L'emoji n'est qu'un secours : dès que l'image charge, on le masque (classe
// `img-ok`) pour qu'UN SEUL visuel soit affiché (corrige les sprites empilés).
function fighterImg(path) {
  if (!path) return "";
  const svg = path.replace(/\.(png|jpe?g|webp)$/i, ".svg");
  const onload = "this.closest('.fighter-sprite').classList.add('img-ok')";
  const onerr =
    svg !== path
      ? `if(!this.dataset.alt){this.dataset.alt=1;this.src='${esc(svg)}';}else{this.remove();}`
      : "this.remove()";
  return `<img class="sprite-img" src="${esc(path)}" alt="" draggable="false" onload="${onload}" onerror="${onerr}" />`;
}

// Barre de vie rattachée à un combattant (au-dessus de sa tête).
// idbase : "player" / "enemy". Reste fixe pendant le dash (hors .fighter-move).
function renderHpBar(idbase, c) {
  return `
    <div class="fighter-hp ${idbase}">
      <div class="fighter-hp-track">
        <div class="fighter-hp-fill ${idbase}" id="bt-${idbase}-fill" style="width:${pct(c.hp, c.maxHp)}%"></div>
      </div>
      <span class="fighter-hp-text" id="bt-${idbase}-num">${fmt(c.hp)}/${fmt(c.maxHp)}</span>
    </div>`;
}

// Un combattant posé dans la scène. `side` : "hero" (gauche) / "enemy" (droite).
// Couches : .fighter (ancrage + barre de PV fixe) > .fighter-move (dash de
// l'attaquant) > .fighter-sprite (recul/flash) > .sprite-anim (idle).
// Le sprite « pose » les pieds sur le sol du décor ; une ombre suit ses pieds.
function renderFighter(side, spritePath, emoji, hpC, idbase, isBoss) {
  return `
    <div class="fighter ${side}${isBoss ? " boss" : ""}${hpC.enraged ? " enraged" : ""}" id="bt-${side}">
      ${renderHpBar(idbase, hpC)}
      <div class="fighter-states" id="bt-states-${idbase}">${renderStates(hpC)}</div>
      <div class="fighter-move">
        <div class="fighter-shadow"></div>
        <div class="fighter-sprite">
          <span class="sprite-emoji">${emoji || "❔"}</span>
          <div class="sprite-anim">${fighterImg(spritePath)}</div>
        </div>
      </div>
    </div>`;
}

// Familier équipé : petit sprite près du héros (Lot 11). Espacé, ne recrée rien.
function renderFamiliarSprite(fam) {
  return `
    <div class="fighter familiar-pet" id="bt-familiar">
      <div class="fighter-shadow small"></div>
      <div class="fighter-sprite">${fighterImg(fam.sprite)}</div>
    </div>`;
}

export function renderBattle(state, combat) {
  const p = combat.player;
  const e = combat.enemy;
  const zone = zoneForEnemy(combat.enemyId);
  const heroClass = getClass(state.character.classId);
  const bg = zone.arena || zone.image; // décor de biome (image statique, swappable)

  // Décor + sprites créés UNE FOIS ici ; barres/log/contrôles/anims mis à jour
  // ensuite de façon ciblée (jamais de recréation -> pas de scintillement).
  return `
    <section class="panel battle">
      <div class="arena-header">
        <span class="arena-zone">${zone.icon} ${esc(zone.name)}</span>
        ${e.enraged ? '<span class="enrage-badge">⚡ ENRAGÉ</span>' : ""}
        <span class="arena-turn">Tour <strong id="bt-turn">${combat.turn}</strong></span>
      </div>
      <div class="turn-forecast" id="bt-forecast">${renderForecast(combat)}</div>
      <div id="bt-intent">${renderIntent(combat)}</div>
      <div class="arena" id="bt-arena">
        ${chainImg(bg, "arena-bg-img", "this.remove()")}
        <div class="arena-stage">
          ${renderFighter("hero", heroClass.sprite, classEmoji(heroClass.id), p, "player", false)}
          ${p.familiar ? renderFamiliarSprite(p.familiar) : ""}
          ${renderFighter("enemy", e.sprite, e.icon, e, "enemy", e.isBoss)}
        </div>
      </div>
      <div id="bt-controls">${renderBattleControls(state, combat)}</div>
      <details class="battle-log-wrap" id="bt-log-wrap">
        <summary>📜 Journal de combat</summary>
        <div class="battle-log" id="battle-log">${renderBattleLog(combat)}</div>
      </details>
    </section>`;
}
