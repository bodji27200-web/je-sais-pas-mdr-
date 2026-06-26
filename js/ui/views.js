// Rendu des écrans (HTML en chaîne). Les vues sont (presque) pures : elles lisent
// l'état et produisent du HTML ; les interactions passent par des attributs
// data-act gérés dans main.js.

import { esc, sigil, bar, fmt, fmtDuration, chainImg } from "./dom.js";
import { getClass, CLASSES } from "../data/classes.js";
import { getSkill } from "../data/skills.js";
import { JOBS, unlockedTiers, bestTier, nextTier } from "../data/jobs.js";
import { RESOURCES, getResource } from "../data/resources.js";
import { EQUIPMENT, getEquipment, SLOTS, ARMOR_FAMILIES } from "../data/equipment.js";
import { effectiveStats, MAX_UPGRADE } from "../core/items.js";
import { getRarity } from "../data/rarities.js";
import { upgradeCost, canUpgrade, dismantleReward } from "../systems/gear.js";
import { RECIPES, STATIONS } from "../data/recipes.js";
import { ENEMIES, getEnemy } from "../data/enemies.js";
import { ZONES, allZones } from "../data/zones.js";
import { enemyUnlock, zoneProgress } from "../systems/zoneprog.js";
import { getDerivedStats, canWieldWeapon, getActiveSpec, specUnlocked, nextRespecCost } from "../core/character.js";
import { specsForClass, SPEC_UNLOCK_LEVEL } from "../data/specializations.js";
import { charXpToNext, jobXpToNext } from "../core/progression.js";
import { activityProgress, activityRemainingMs, activeTier } from "../systems/jobs.js";
import { craftableTimes, canCraft } from "../systems/crafting.js";
import { OBJECTIVES } from "../systems/objectives.js";

const STAT_LABELS = { maxHp: "PV max", atk: "Attaque", def: "Défense", spd: "Vitesse", crit: "Critique" };
const STAT_ICONS = { maxHp: "❤️", atk: "⚔️", def: "🛡️", spd: "💨", crit: "🎯" };
const STAT_TIP = {
  maxHp: "Quantité totale de dégâts que tu peux encaisser.",
  atk: "Base de tes dégâts infligés.",
  def: "Réduit chaque attaque reçue (rendements décroissants, plafonné à 75 % : jamais 0 dégât).",
  spd: "La Vitesse détermine la fréquence des actions. Un personnage plus rapide peut agir davantage qu'un personnage lent (jusqu'à 2 fois d'affilée).",
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
    .map((k) => `<div class="stat" title="${esc(STAT_TIP[k])}"><span class="stat-ico">${STAT_ICONS[k]}</span><span class="stat-lbl">${STAT_LABELS[k]}</span><span class="stat-val">${k === "crit" ? ds[k] + " %" : fmt(ds[k])}</span></div>`)
    .join("");

  const slots = Object.keys(SLOTS)
    .map((slot) => {
      const inst = ch.equipment[slot];
      if (!inst) {
        return `<div class="slot empty"><span class="slot-name">${SLOTS[slot]}</span><span class="muted">— vide —</span></div>`;
      }
      const item = getEquipment(inst.baseId);
      const r = getRarity(inst.rarity);
      return `
        <div class="slot filled" style="border-left:3px solid ${r.color}">
          ${sigil(item.image, item.icon)}
          <div class="slot-info">
            <span class="slot-name">${SLOTS[slot]}</span>
            <div class="gear-title"><strong style="color:${r.color}">${esc(item.name)}</strong>${upgradeSuffix(inst)}${rarityTag(inst)}${familyTag(item)}</div>
            <span class="muted small">${statLine(effectiveStats(inst))}</span>
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
  else if (cost > 0) btn = `<button class="btn tiny" data-act="choose-spec" data-spec="${spec.id}">Changer · ${fmt(cost)} 🪙</button>`;
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
    part(state.gold, cost.gold, "🪙"),
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
      <p class="muted">Transforme tes ressources en équipement. Chaque métier de transformation gagne un niveau en fabriquant, ce qui débloque des recettes plus avancées.</p>
      ${renderProfessionsSummary(state)}
      ${renderCraftFilterBar(state, filters)}
      <div id="craft-results">${renderCraftResults(state, filters)}</div>
    </section>`;
}

// Liste filtrée des recettes, groupée par catégorie (mise à jour ciblée possible).
export function renderCraftResults(state, filters = defaultCraftFilters()) {
  const f = filters;
  let recipes = RECIPES.filter((r) => {
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
  const metaParts = [
    `${typeLabel}`,
    `${station ? station.icon + " " + esc(station.name) : ""} niv. ${profReq}`,
  ];
  if (out.type === "equipment" && outDef.slot === "weapon" && outDef.wtype) {
    const classes = classesForWtype(outDef.wtype).map((c) => esc(c.name));
    if (classes.length) metaParts.push("⚔ " + classes.join(", "));
  }
  if (recipe.levelReq) metaParts.push("Héros niv. " + recipe.levelReq);
  const meta = `<span class="recipe-meta muted small">${metaParts.filter(Boolean).join(" · ")}</span>`;

  const stats = out.type === "equipment" ? `<span class="muted small">${statLine(outDef.stats)} ${familyTag(outDef)}</span>` : `<span class="muted small">+${recipe.profXp || 0} XP ${esc(station ? station.name : "métier")}</span>`;

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
                <div class="gear-title"><strong style="color:${r.color}">${esc(item.name)}</strong>${upgradeSuffix(inst)}${rarityTag(inst)}${familyTag(item)}</div>
                <span class="muted small">${SLOTS[item.slot]} · ${statLine(effectiveStats(inst))}</span>
                <span class="muted small">${item.levelReq ? "Niv. " + item.levelReq : "Aucun prérequis"} · ${cmp}</span>
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
// Écran Combat — sélection de zone / d'ennemi
// ---------------------------------------------------------------------------
export function renderZones(state) {
  const zone = Object.values(ZONES)[0];
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
          <div class="enemy-info"><strong>${esc(e.name)}</strong><span class="muted small">${sub}</span></div>
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

  return `
    <section class="panel">
      <div class="zone-head">
        ${sigil(zone.image, zone.icon, "lg")}
        <div><h2>${esc(zone.name)}</h2><p class="muted">${esc(zone.desc)}</p><p class="muted small">Niveau conseillé : ${zone.recommendedLevel}+</p></div>
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
    <div class="fighter ${side}${isBoss ? " boss" : ""}" id="bt-${side}">
      ${renderHpBar(idbase, hpC)}
      <div class="fighter-move">
        <div class="fighter-shadow"></div>
        <div class="fighter-sprite">
          <span class="sprite-emoji">${emoji || "❔"}</span>
          <div class="sprite-anim">${fighterImg(spritePath)}</div>
        </div>
      </div>
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
        <span class="arena-turn">Tour <strong id="bt-turn">${combat.turn}</strong></span>
      </div>
      <div class="arena" id="bt-arena">
        ${chainImg(bg, "arena-bg-img", "this.remove()")}
        <div class="arena-stage">
          ${renderFighter("hero", heroClass.sprite, classEmoji(heroClass.id), p, "player", false)}
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
