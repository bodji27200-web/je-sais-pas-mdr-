// Contrôleur principal : amorçage, navigation, boucle de jeu, gestion des clics.

import {
  load,
  save,
  newGame,
  resetSave,
  hasSave,
  getState,
} from "./core/state.js";
import {
  getDerivedStats,
  regenOutOfCombat,
  equip,
  unequip,
  chooseSpec,
  specUnlocked,
} from "./core/character.js";
import {
  startActivity,
  stopActivity,
  processActivity,
  processOffline,
  activityProgress,
  activityRemainingMs,
} from "./systems/jobs.js";
import { charXpToNext } from "./core/progression.js";
import { craft } from "./systems/crafting.js";
import { upgradeItem, dismantleItem, dismantleReward, needsDismantleConfirm } from "./systems/gear.js";
import { findEquipmentInstance } from "./core/state.js";
import { getRarity } from "./data/rarities.js";
import { startCombat, resolveRound } from "./systems/combat.js";
import { enemyUnlock } from "./systems/zoneprog.js";
import { hatchEgg, equipFamiliar, feedFamiliar } from "./systems/familiars.js";
import { checkNewAchievements } from "./systems/achievements.js";
import { getGuide } from "./data/guides.js";
import { updateObjectives, ensureObjectives, objectiveLabel } from "./systems/objectives.js";
import { setMuted, isMuted, playHit, playWin, playLose, playDing } from "./core/audio.js";
import { getResource } from "./data/resources.js";
import { getEquipment } from "./data/equipment.js";
import { getRecipe, STATIONS } from "./data/recipes.js";
import { $, toast, showModal, closeModal, esc, fmt, fmtDuration } from "./ui/dom.js";
import {
  renderCreation,
  renderTopbar,
  renderCharacter,
  renderJobs,
  renderCraft,
  renderCraftResults,
  defaultCraftFilters,
  renderInventory,
  renderFamiliars,
  renderZones,
  renderBattle,
  renderBattleLog,
  renderBattleControls,
  renderForecast,
  renderIntent,
  renderStates,
  renderObjectives,
  renderGuide,
  renderAchievements,
  topbarActivityInner,
} from "./ui/views.js";

const TABS = [
  { id: "character", label: "Héros", icon: "🧝" },
  { id: "jobs", label: "Métiers", icon: "🪓" },
  { id: "craft", label: "Atelier", icon: "🔥" },
  { id: "inventory", label: "Sac", icon: "🎒" },
  { id: "familiars", label: "Familiers", icon: "🐾" },
  { id: "combat", label: "Combat", icon: "⚔️" },
];

let currentTab = "jobs";
let currentCombat = null;
let selectedClassId = null;
let currentZoneId = null; // zone sélectionnée dans le menu Combat (défaut : 1re)
let familiarFilters = { element: "all", role: "all", rarity: "all" };
// Filtres de l'Atelier (persistants pendant la session).
let craftFilters = defaultCraftFilters();
let lastTick = Date.now();
let tickCount = 0;
// Pendant qu'une animation de tour joue, on bloque les clics (évite de
// superposer / casser les dash ; chaque perso revient pile à sa place).
let combatBusy = false;
let combatBusyTimer = null;

// --- Rendu ------------------------------------------------------------------

function renderScreen() {
  const state = getState();
  if (currentCombat) return renderBattle(state, currentCombat);
  switch (currentTab) {
    case "character":
      return renderCharacter(state);
    case "jobs":
      return renderJobs(state);
    case "craft":
      return renderCraft(state, craftFilters);
    case "inventory":
      return renderInventory(state);
    case "familiars":
      return renderFamiliars(state, familiarFilters);
    case "combat":
      return renderZones(state, currentZoneId);
    default:
      return renderJobs(state);
  }
}

function renderTabs() {
  return TABS.map(
    (t) =>
      `<button class="tab ${t.id === currentTab && !currentCombat ? "active" : ""}" data-act="nav" data-tab="${t.id}">
         <span class="tab-ico">${t.icon}</span><span class="tab-lbl">${t.label}</span>
       </button>`
  ).join("");
}

function renderAll() {
  const state = getState();
  if (!state) {
    $("#topbar").innerHTML = "";
    $("#tabs").innerHTML = "";
    $("#screen").innerHTML = renderCreation();
    return;
  }
  $("#topbar").innerHTML =
    renderTopbar(state); // les boutons Aide/Options sont dans le topbar (top-side)
  $("#tabs").innerHTML = renderTabs();
  $("#objectives").innerHTML = currentCombat ? "" : renderObjectives(state);
  $("#screen").innerHTML = renderScreen();

  if (currentCombat) {
    const lg = $("#battle-log");
    if (lg) lg.scrollTop = lg.scrollHeight;
    animateRound(currentCombat);
  }
}

// Ajoute une classe d'animation puis la retire (réamorçable au clic rapide).
function pulseClass(el, cls, ms) {
  el.classList.remove(cls);
  void el.offsetWidth; // force un reflow -> relance l'animation
  el.classList.add(cls);
  const key = "__t_" + cls;
  clearTimeout(el[key]);
  el[key] = setTimeout(() => el.classList.remove(cls), ms + 60);
}

// Anime le dernier tour : déplacement des attaquants (dash/heavy/buff),
// recul + flash des défenseurs, nombres flottants, son. N'ajoute/retire QUE des
// classes sur des éléments existants -> aucune image recréée, aucun scintillement.
function animateRound(combat) {
  if (!combat) return;
  const arena = document.getElementById("bt-arena");

  for (const a of combat.lastActions || []) {
    const f = document.getElementById(a.actor === "player" ? "bt-hero" : "bt-enemy");
    if (!f) continue;
    const move = f.querySelector(".fighter-move"); // couche de déplacement (dash)
    const dir = a.actor === "player" ? "right" : "left";
    if (a.isBuff || a.anim === "buff") {
      // Cri de guerre : aura + pulsation sur place (aucun déplacement).
      pulseClass(f, "anim-buff", 800);
    } else if (a.anim === "heavy") {
      if (move) pulseClass(move, "atk-heavy-" + dir, 620);
      if (arena) pulseClass(arena, "arena-shake", 340);
    } else if (move) {
      pulseClass(move, "atk-dash-" + dir, 500);
    }
  }

  for (const fx of combat.lastFx || []) {
    const f = document.getElementById(fx.target === "enemy" ? "bt-enemy" : "bt-hero");
    if (!f) continue;
    const num = document.createElement("span");
    num.className = "dmg-float" + (fx.crit ? " crit" : "");
    num.textContent = "-" + fx.dmg + (fx.crit ? " !" : "");
    f.appendChild(num);
    num.addEventListener("animationend", () => num.remove());
    const spr = f.querySelector(".fighter-sprite");
    const dir = fx.target === "enemy" ? "right" : "left";
    if (spr) pulseClass(spr, (fx.crit ? "crit-" : "hit-") + dir, fx.crit ? 500 : 320);
    playHit(fx.crit);
  }

  combat.lastActions = [];
  combat.lastFx = [];
}

// Verrouille les compétences le temps de l'animation du tour (anti-spam).
// Durée alignée sur l'anim la plus longue (frappe lourde + recul) ; quasi nulle
// si l'utilisateur a désactivé les animations.
function lockCombat() {
  const reduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ms = reduced ? 120 : 720;
  combatBusy = true;
  const bar = document.querySelector(".skill-bar");
  if (bar) bar.classList.add("locked");
  clearTimeout(combatBusyTimer);
  combatBusyTimer = setTimeout(() => {
    combatBusy = false;
    const b = document.querySelector(".skill-bar");
    if (b) b.classList.remove("locked");
  }, ms);
}

// Vérifie quêtes + succès et notifie ceux nouvellement accomplis.
function checkObjectives() {
  const state = getState();
  if (!state) return;
  const newly = updateObjectives(state);
  for (const id of newly) {
    toast("Quête accomplie : " + objectiveLabel(id), "good");
    playDing();
  }
  for (const ach of checkNewAchievements(state)) {
    toast((ach.badge ? "🏅 Badge : " : "★ Succès : ") + ach.name, "good");
    playDing();
  }
}

// Affiche le guide contextuel d'un système à sa PREMIÈRE ouverture (une fois).
function maybeShowGuide(tabId) {
  const state = getState();
  if (!state) return;
  const guide = getGuide(tabId);
  if (!guide) return;
  if (!state.tutorials) state.tutorials = { seen: {}, enabled: true };
  if (state.tutorials.enabled === false) return;
  if (state.tutorials.seen[tabId]) return;
  state.tutorials.seen[tabId] = true;
  save();
  showModal(renderGuide(tabId));
}

// Notifie une seule fois quand la spécialisation se débloque (niveau 10).
function checkSpecUnlock() {
  const state = getState();
  if (!state) return;
  if (!state.flags) state.flags = {};
  if (specUnlocked(state) && !state.character.specId && !state.flags.specPrompted) {
    state.flags.specPrompted = true;
    toast("Spécialisation débloquée ! Choisis ta voie dans l'onglet Héros.", "good");
    playDing();
    save();
  }
}

// Helpers de mise à jour ciblée du DOM (sans recréer d'éléments).
function setWidth(id, v, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0) + "%";
}
function setText(id, t) {
  const el = document.getElementById(id);
  if (el) el.textContent = t;
}

// Re-render de l'écran seul (et des objectifs), sans toucher au topbar.
function renderScreenOnly() {
  const state = getState();
  if (!state) return;
  $("#objectives").innerHTML = currentCombat ? "" : renderObjectives(state);
  $("#screen").innerHTML = renderScreen();
}

// Mise à jour CIBLÉE des valeurs qui changent dans le temps, SANS recréer
// le moindre <img> (sinon les illustrations clignotent à chaque tick).
function updateTick() {
  const state = getState();
  if (!state) return;
  const ds = getDerivedStats(state);

  // Barre supérieure
  setWidth("tb-hp-fill", state.character.hpCurrent, ds.maxHp);
  setText("tb-hp-num", fmt(state.character.hpCurrent) + "/" + fmt(ds.maxHp));
  const xpNext = charXpToNext(state.character.level);
  setWidth("tb-xp-fill", state.character.xp, xpNext);
  setText("tb-xp-num", fmt(state.character.xp) + "/" + fmt(xpNext));
  setText("tb-gold", "🪙 " + fmt(state.gold));
  const az = document.getElementById("tb-activity");
  if (az) az.innerHTML = topbarActivityInner(state); // sans <img> -> pas de clignotement

  // Compte à rebours de l'action de métier en cours (si onglet Métiers affiché)
  setWidth("job-active-fill", activityProgress(state), 1);
  setText("job-active-remain", fmtDuration(activityRemainingMs(state)));

  // Objectifs (texte seulement) hors combat
  if (!currentCombat) {
    const ob = document.getElementById("objectives");
    if (ob) ob.innerHTML = renderObjectives(state);
  }
}

// Mise à jour ciblée de l'arène pendant un combat actif (barres, log, contrôles)
// SANS recréer les portraits -> pas de flash à chaque attaque.
function updateBattle(state, combat) {
  setWidth("bt-enemy-fill", combat.enemy.hp, combat.enemy.maxHp);
  setText("bt-enemy-num", fmt(combat.enemy.hp) + "/" + fmt(combat.enemy.maxHp));
  setWidth("bt-player-fill", combat.player.hp, combat.player.maxHp);
  setText("bt-player-num", fmt(combat.player.hp) + "/" + fmt(combat.player.maxHp));
  setText("bt-turn", combat.turn);
  const fc = document.getElementById("bt-forecast");
  if (fc) fc.innerHTML = renderForecast(combat);
  const it = document.getElementById("bt-intent");
  if (it) it.innerHTML = renderIntent(combat);
  const sp = document.getElementById("bt-states-player");
  if (sp) sp.innerHTML = renderStates(combat.player);
  const se = document.getElementById("bt-states-enemy");
  if (se) se.innerHTML = renderStates(combat.enemy);
  const lg = document.getElementById("battle-log");
  if (lg) {
    lg.innerHTML = renderBattleLog(combat);
    lg.scrollTop = lg.scrollHeight;
  }
  const ctrl = document.getElementById("bt-controls");
  if (ctrl) ctrl.innerHTML = renderBattleControls(state, combat);
  animateRound(combat);
}

// --- Boucle de jeu ----------------------------------------------------------

function tick() {
  const state = getState();
  if (!state) return;
  const now = Date.now();
  const delta = now - lastTick;
  lastTick = now;

  // Les métiers tournent même pendant un combat.
  const cycle = processActivity(state, now);
  // Notification une seule fois quand l'activité principale évolue de palier.
  if (cycle && cycle.evolved) {
    toast(`Nouveau palier : ${cycle.evolved.name} !`, "good");
    playDing();
  }
  checkObjectives();
  checkSpecUnlock();
  if (!(currentCombat && currentCombat.status === "active")) {
    regenOutOfCombat(state, delta);
  }

  // Mise à jour ciblée (pas de re-render complet -> aucune image recréée).
  updateTick();

  // Quand un cycle de récolte s'achève, on rafraîchit l'écran (jobs/inventaire,
  // qui n'ont que des emojis -> pas de clignotement) SANS reconstruire le topbar
  // (qui contient l'emblème SVG). Les autres onglets se mettent à jour au clic.
  if (cycle && !currentCombat && (currentTab === "inventory" || currentTab === "jobs")) {
    renderScreenOnly();
  }

  tickCount += 1;
  if (tickCount % 6 === 0) save();
}

// --- Résumé hors-ligne ------------------------------------------------------

function showOfflineSummary(summary) {
  const lines = Object.keys(summary.resources)
    .map((id) => `<li>${getResource(id)?.icon || ""} ${esc(getResource(id)?.name || id)} ×${fmt(summary.resources[id])}</li>`)
    .join("");
  const levelsLine = summary.levels > 0 ? `<p class="muted small">⬆ +${summary.levels} niveau(x) de métier</p>` : "";
  const evolvedLine = summary.evolved
    ? `<p class="lvlup">Nouveau palier débloqué : ${esc(summary.evolved.name)} !</p>`
    : "";
  showModal(`
    <h2>De retour !</h2>
    <p class="muted">Pendant ton absence, ${summary.cycles} cycle(s) de récolte se sont achevés (efficacité hors-ligne réduite).</p>
    ${lines ? `<ul class="drop-list">${lines}</ul>` : ""}
    <p class="muted small">+${fmt(summary.xp)} XP de métier</p>
    ${levelsLine}
    ${evolvedLine}
    <button class="btn primary" data-act="close-modal">Continuer</button>
  `);
}

// --- Gestion des actions (délégation de clics) ------------------------------

// Démantèle effectivement une pièce (après confirmation éventuelle).
function doDismantle(uid) {
  const r = dismantleItem(getState(), uid);
  if (!r.ok) return toast(r.error, "warn");
  toast(`Démantelé : +🪙${r.reward.gold} +✨${r.reward.essence}`, "good");
  save();
  renderAll();
}

const handlers = {
  "pick-class": (el) => {
    selectedClassId = el.dataset.id;
    document.querySelectorAll(".class-card").forEach((c) => c.classList.remove("selected"));
    el.classList.add("selected");
    const form = $("#creation-form");
    if (form) {
      form.hidden = false;
      const input = $("#hero-name");
      if (input) input.focus();
    }
  },
  "confirm-create": () => {
    if (!selectedClassId) {
      toast("Choisis d'abord une classe.", "warn");
      return;
    }
    const name = ($("#hero-name")?.value || "").trim() || "Aventurier";
    const state = newGame(name, selectedClassId);
    state.character.hpCurrent = getDerivedStats(state).maxHp;
    save();
    currentTab = "jobs";
    renderAll();
    toast("Bienvenue, " + name + " !", "good");
  },
  nav: (el) => {
    if (currentCombat && currentCombat.status === "active") {
      toast("Termine d'abord ton combat.", "warn");
      return;
    }
    currentCombat = null;
    currentTab = el.dataset.tab;
    renderAll();
    maybeShowGuide(currentTab); // guide contextuel à la première ouverture
  },
  "select-zone": (el) => {
    currentZoneId = el.dataset.zone;
    renderAll();
  },
  "familiar-filter": (el) => {
    familiarFilters = { ...familiarFilters, [el.dataset.key]: el.dataset.val };
    renderAll();
  },
  "hatch-egg": (el) => {
    const r = hatchEgg(getState(), el.dataset.egg);
    if (!r.ok) return toast(r.error, "warn");
    if (r.duplicate) toast(`Doublon : ${r.familiar.name} → +${r.essenceGain} ✦ Essence`, "good");
    else toast(`Nouveau familier : ${r.familiar.name} !`, "good");
    save();
    renderAll();
  },
  "equip-familiar": (el) => {
    const r = equipFamiliar(getState(), el.dataset.id);
    if (!r.ok) return toast(r.error, "warn");
    save();
    renderAll();
  },
  "feed-familiar": (el) => {
    const r = feedFamiliar(getState(), el.dataset.id);
    if (!r.ok) return toast(r.error, "warn");
    toast(`Lien renforcé (${r.link}/10)`, "good");
    save();
    renderAll();
  },
  "start-activity": (el) => {
    const tier = el.dataset.tier || null;
    // data-auto="1" (bouton Démarrer) -> suit le meilleur palier ; un palier
    // explicitement choisi (chip) -> mode manuel.
    const auto = el.dataset.auto === "1" ? true : tier ? false : true;
    const r = startActivity(getState(), el.dataset.job, tier, auto);
    if (!r.ok) return toast(r.error, "warn");
    save();
    renderAll();
  },
  "stop-activity": () => {
    stopActivity(getState());
    save();
    renderAll();
  },
  craft: (el) => {
    const r = craft(getState(), el.dataset.id);
    if (!r.ok) return toast(r.error, "warn");
    const recipe = getRecipe(el.dataset.id);
    const outDef = recipe.output.type === "equipment" ? getEquipment(recipe.output.id) : getResource(recipe.output.id);
    toast("Fabriqué : " + outDef.name, "good");
    // Montée de niveau du métier de transformation.
    if (r.profLevels > 0) {
      const st = STATIONS[r.station];
      toast(`${st ? st.name : "Métier"} niveau supérieur !`, "good");
      playDing();
    }
    save();
    renderAll();
  },
  equip: (el) => {
    const r = equip(getState(), el.dataset.uid);
    if (!r.ok) return toast(r.error, "warn");
    toast("Équipé : " + (r.name || "objet"), "good");
    save();
    renderAll();
  },
  unequip: (el) => {
    const r = unequip(getState(), el.dataset.slot);
    if (!r.ok) return toast(r.error, "warn");
    save();
    renderAll();
  },
  "choose-spec": (el) => {
    const r = chooseSpec(getState(), el.dataset.spec);
    if (!r.ok) return toast(r.error, "warn");
    toast(r.paid > 0 ? `Voie changée : ${r.name} (−${r.paid} or)` : `Voie choisie : ${r.name}`, "good");
    playDing();
    save();
    renderAll();
  },
  upgrade: (el) => {
    const r = upgradeItem(getState(), el.dataset.uid);
    if (!r.ok) return toast(r.error, "warn");
    toast("Renforcé : +" + r.lvl, "good");
    playDing();
    save();
    renderAll();
  },
  dismantle: (el) => {
    const uid = el.dataset.uid;
    const inst = findEquipmentInstance(uid);
    if (!inst) return toast("Objet introuvable.", "warn");
    // Confirmation pour les pièces rares et au-dessus.
    if (needsDismantleConfirm(inst)) {
      const item = getEquipment(inst.baseId);
      const rar = getRarity(inst.rarity);
      const dr = dismantleReward(inst);
      showModal(`
        <h2>Démanteler ?</h2>
        <p><strong style="color:${rar.color}">${esc(item.name)}${inst.lvl > 0 ? " +" + inst.lvl : ""}</strong> <span style="color:${rar.color}">(${rar.name})</span></p>
        <p class="muted">Cette pièce sera détruite définitivement.</p>
        <p>Tu obtiendras 🪙 ${dr.gold} et ✨ ${dr.essence}.</p>
        <div class="end-actions">
          <button class="btn" data-act="close-modal">Annuler</button>
          <button class="btn primary" data-act="dismantle-confirm" data-uid="${uid}">Démanteler</button>
        </div>`);
      return;
    }
    doDismantle(uid);
  },
  "dismantle-confirm": (el) => {
    closeModal();
    doDismantle(el.dataset.uid);
  },
  fight: (el) => {
    const state = getState();
    // Sécurité : on ne lance pas un combat verrouillé (progression de zone).
    const u = enemyUnlock(state, el.dataset.id);
    if (!u.unlocked) {
      toast("Verrouillé : " + u.reasons.join(" · "), "warn");
      return;
    }
    if (state.character.hpCurrent < 1) state.character.hpCurrent = 1;
    clearTimeout(combatBusyTimer);
    combatBusy = false; // repart propre (au cas où on relance pendant une anim)
    currentCombat = startCombat(state, el.dataset.id);
    renderAll();
  },
  skill: (el) => {
    if (!currentCombat || currentCombat.status !== "active") return;
    if (combatBusy) return; // une animation joue déjà : on ignore le clic
    resolveRound(getState(), currentCombat, el.dataset.id);
    checkObjectives();
    save();
    if (currentCombat.status === "active") {
      // Combat en cours : mise à jour ciblée (portraits intacts -> pas de flash).
      updateBattle(getState(), currentCombat);
      lockCombat();
    } else {
      // Fin du combat : transition vers l'écran de victoire/défaite (rendu complet).
      if (currentCombat.status === "won") playWin();
      else playLose();
      renderAll();
    }
  },
  "leave-combat": () => {
    currentCombat = null;
    currentTab = "combat";
    save();
    renderAll();
  },
  "open-options": () => {
    const state = getState();
    const tuto = !state || !state.tutorials || state.tutorials.enabled !== false;
    showModal(`
      <h2>Options</h2>
      <p class="muted small">Sauvegarde automatique active (navigateur).</p>
      <div class="end-actions">
        <button class="btn" data-act="open-achievements">★ Succès</button>
        <button class="btn" data-act="toggle-sound">${isMuted() ? "🔇 Son : coupé" : "🔊 Son : activé"}</button>
        <button class="btn" data-act="toggle-tutorials">${tuto ? "Guides : activés" : "Guides : désactivés"}</button>
        <button class="btn danger" data-act="reset-save">Nouvelle partie</button>
        <button class="btn" data-act="close-modal">Fermer</button>
      </div>
    `);
  },
  "open-achievements": () => {
    showModal(renderAchievements(getState()));
  },
  "open-guide": () => {
    // Rouvre le guide de l'onglet courant (ou explique qu'il n'y en a pas).
    const guide = getGuide(currentTab);
    if (guide) showModal(renderGuide(currentTab));
    else toast("Aucun guide pour cet écran.", "info");
  },
  "toggle-tutorials": () => {
    const state = getState();
    if (!state) return;
    if (!state.tutorials) state.tutorials = { seen: {}, enabled: true };
    state.tutorials.enabled = state.tutorials.enabled === false ? true : false;
    save();
    handlers["open-options"]();
  },
  "toggle-sound": () => {
    const state = getState();
    const muted = !isMuted();
    setMuted(muted);
    if (state) {
      if (!state.settings) state.settings = {};
      state.settings.muted = muted;
      save();
    }
    if (!muted) playDing();
    handlers["open-options"](); // ré-affiche avec le nouvel état
  },
  "reset-save": () => {
    showModal(`
      <h2>Effacer la progression ?</h2>
      <p class="muted">Cette action est irréversible.</p>
      <div class="end-actions">
        <button class="btn danger" data-act="confirm-reset">Oui, tout effacer</button>
        <button class="btn" data-act="close-modal">Annuler</button>
      </div>
    `);
  },
  "confirm-reset": () => {
    resetSave();
    closeModal();
    currentCombat = null;
    selectedClassId = null;
    renderAll();
  },
  "craft-filter": (el) => {
    const key = el.dataset.key;
    const val = el.dataset.val;
    if (key === "craftable") craftFilters.craftable = !craftFilters.craftable;
    else craftFilters[key] = val;
    renderScreenOnly(); // re-render l'écran Atelier (les chips reflètent l'état)
  },
  "close-modal": () => closeModal(),
};

function onClick(e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  if (!act || !handlers[act]) return;
  handlers[act](el);
}

// --- Amorçage ---------------------------------------------------------------

function boot() {
  // Sur `document` (pas seulement #app) pour couvrir aussi #modal, qui est un
  // sibling de #app : sinon les boutons des modales ne réagissent pas.
  document.addEventListener("click", onClick);
  // Entrée = valider la création.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "hero-name") handlers["confirm-create"]();
  });
  // Recherche de l'Atelier en direct : mise à jour CIBLÉE de la liste des
  // recettes (on ne recrée pas l'input -> le focus et le curseur sont préservés).
  document.addEventListener("input", (e) => {
    if (e.target.id === "craft-search") {
      craftFilters.search = e.target.value;
      const results = document.getElementById("craft-results");
      const state = getState();
      if (results && state) results.innerHTML = renderCraftResults(state, craftFilters);
    }
  });

  if (hasSave() && load()) {
    const state = getState();
    ensureObjectives(state); // compat anciennes sauvegardes
    if (!state.settings) state.settings = { muted: false };
    setMuted(!!state.settings.muted);
    const summary = processOffline(state);
    updateObjectives(state);
    save();
    renderAll();
    if (summary && summary.cycles > 0) showOfflineSummary(summary);
  } else {
    renderAll();
  }

  lastTick = Date.now();
  setInterval(tick, 500);
}

boot();
