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
} from "./core/character.js";
import {
  startActivity,
  stopActivity,
  processActivity,
  processOffline,
} from "./systems/jobs.js";
import { craft } from "./systems/crafting.js";
import { startCombat, resolveRound } from "./systems/combat.js";
import { getResource } from "./data/resources.js";
import { getEquipment } from "./data/equipment.js";
import { getRecipe } from "./data/recipes.js";
import { $, toast, showModal, closeModal, esc, fmt } from "./ui/dom.js";
import {
  renderCreation,
  renderTopbar,
  renderCharacter,
  renderJobs,
  renderCraft,
  renderInventory,
  renderZones,
  renderBattle,
} from "./ui/views.js";

const TABS = [
  { id: "character", label: "Héros", icon: "🧝" },
  { id: "jobs", label: "Métiers", icon: "🪓" },
  { id: "craft", label: "Atelier", icon: "🔥" },
  { id: "inventory", label: "Sac", icon: "🎒" },
  { id: "combat", label: "Combat", icon: "⚔️" },
];

let currentTab = "jobs";
let currentCombat = null;
let selectedClassId = null;
let lastTick = Date.now();
let tickCount = 0;

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
      return renderCraft(state);
    case "inventory":
      return renderInventory(state);
    case "combat":
      return renderZones(state);
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
    renderTopbar(state) + `<button class="gear-btn" data-act="open-options" title="Options">⚙</button>`;
  $("#tabs").innerHTML = renderTabs();
  $("#screen").innerHTML = renderScreen();

  if (currentCombat) {
    const lg = $("#battle-log");
    if (lg) lg.scrollTop = lg.scrollHeight;
  }
}

// --- Boucle de jeu ----------------------------------------------------------

function tick() {
  const state = getState();
  if (!state) return;
  const now = Date.now();
  const delta = now - lastTick;
  lastTick = now;

  // Les métiers tournent même pendant un combat.
  processActivity(state, now);

  if (currentCombat && currentCombat.status === "active") {
    // En combat : on ne rafraîchit que la barre supérieure pour ne pas écraser l'arène.
    $("#topbar").innerHTML =
      renderTopbar(state) + `<button class="gear-btn" data-act="open-options" title="Options">⚙</button>`;
  } else {
    regenOutOfCombat(state, delta);
    renderAll();
  }

  tickCount += 1;
  if (tickCount % 6 === 0) save();
}

// --- Résumé hors-ligne ------------------------------------------------------

function showOfflineSummary(summary) {
  const lines = Object.keys(summary.resources)
    .map((id) => `<li>${getResource(id)?.icon || ""} ${esc(getResource(id)?.name || id)} ×${fmt(summary.resources[id])}</li>`)
    .join("");
  showModal(`
    <h2>De retour !</h2>
    <p class="muted">Pendant ton absence, ${summary.cycles} cycle(s) de récolte se sont achevés.</p>
    ${lines ? `<ul class="drop-list">${lines}</ul>` : ""}
    <p class="muted small">+${fmt(summary.xp)} XP de métier</p>
    <button class="btn primary" data-act="close-modal">Continuer</button>
  `);
}

// --- Gestion des actions (délégation de clics) ------------------------------

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
  },
  "start-activity": (el) => {
    const r = startActivity(getState(), el.dataset.job, el.dataset.id);
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
    save();
    renderAll();
  },
  equip: (el) => {
    const r = equip(getState(), el.dataset.id);
    if (!r.ok) return toast(r.error, "warn");
    toast("Équipé : " + getEquipment(el.dataset.id).name, "good");
    save();
    renderAll();
  },
  unequip: (el) => {
    const r = unequip(getState(), el.dataset.slot);
    if (!r.ok) return toast(r.error, "warn");
    save();
    renderAll();
  },
  fight: (el) => {
    const state = getState();
    if (state.character.hpCurrent < 1) state.character.hpCurrent = 1;
    currentCombat = startCombat(state, el.dataset.id);
    renderAll();
  },
  skill: (el) => {
    if (!currentCombat || currentCombat.status !== "active") return;
    resolveRound(getState(), currentCombat, el.dataset.id);
    save();
    renderAll();
  },
  "leave-combat": () => {
    currentCombat = null;
    currentTab = "combat";
    save();
    renderAll();
  },
  "open-options": () => {
    showModal(`
      <h2>Options</h2>
      <p class="muted small">Sauvegarde automatique active (navigateur).</p>
      <div class="end-actions">
        <button class="btn danger" data-act="reset-save">Nouvelle partie</button>
        <button class="btn" data-act="close-modal">Fermer</button>
      </div>
    `);
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
  document.getElementById("app").addEventListener("click", onClick);
  // Entrée = valider la création.
  document.getElementById("app").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "hero-name") handlers["confirm-create"]();
  });

  if (hasSave() && load()) {
    const summary = processOffline(getState());
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
