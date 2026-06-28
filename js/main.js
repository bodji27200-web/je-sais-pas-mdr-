// Contrôleur principal : amorçage, navigation, boucle de jeu, gestion des clics.

import {
  load,
  save,
  newGame,
  resetSave,
  hasSave,
  getState,
  exportSave,
  importSave,
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
import { charXpToNext, jobXpToNext } from "./core/progression.js";
import { craft } from "./systems/crafting.js";
import { upgradeItem, dismantleItem, dismantleReward, needsDismantleConfirm } from "./systems/gear.js";
import { findEquipmentInstance } from "./core/state.js";
import { getRarity } from "./data/rarities.js";
import { startCombat, resolveRound } from "./systems/combat.js";
import { enemyUnlock, zoneUnlocked } from "./systems/zoneprog.js";
import { getClass } from "./data/classes.js";
import { getEnemy } from "./data/enemies.js";
import { ZONES } from "./data/zones.js";
import { hatchEgg, equipFamiliar, feedFamiliar, setFamiliarPosture } from "./systems/familiars.js";
import { unlockNode, equipClassNode, equipHeritage } from "./systems/classtree.js";
import { checkNewAchievements } from "./systems/achievements.js";
import { getGuide } from "./data/guides.js";
import { updateObjectives, ensureObjectives, objectiveLabel } from "./systems/objectives.js";
import { setMuted, isMuted, playHit, playWin, playLose, playDing } from "./core/audio.js";
import { getResource } from "./data/resources.js";
import { getEquipment } from "./data/equipment.js";
import { PRIMARY_STATS } from "./data/combatStats.js";
import { getRecipe, STATIONS } from "./data/recipes.js";
import { $, toast, showModal, closeModal, esc, fmt, fmtDuration } from "./ui/dom.js";
import {
  renderCreation,
  renderTopbar,
  renderCharacter,
  renderJobs,
  renderCraft,
  renderCraftResults,
  renderCraftDetail,
  defaultCraftFilters,
  renderInventory,
  renderFamiliars,
  renderClassTree,
  renderNodeDetail,
  renderZones,
  renderBattle,
  renderBattleLog,
  renderBattleControls,
  renderForecast,
  renderIntent,
  renderStates,
  renderSummons,
  renderObjectives,
  renderGuide,
  renderAchievements,
  topbarActivityInner,
} from "./ui/views.js";
import { renderDuoSetup, renderDuoCombat, DUO_SKIRMISHES } from "./ui/coopViews.js";
import { renderOnlineHome, renderOnlineLobby, renderOnlineCombat } from "./ui/onlineViews.js";
import { createDuoCombat, submitIntent, resolveTurn, bothChosen, awaitingSeats, livingHeroes, livingEnemies, SEATS } from "./coop/duoCombat.js";
import { createDuoDungeon, syncDungeon, chooseBlessing, skipBlessing } from "./coop/duoDungeon.js";
import { CoopNet } from "./coop/net.js";
import { DUNGEONS } from "./data/dungeons.js";

const TABS = [
  { id: "character", label: "Héros", icon: "🧝" },
  { id: "jobs", label: "Métiers", icon: "🪓" },
  { id: "craft", label: "Atelier", icon: "🔥" },
  { id: "inventory", label: "Sac", icon: "🎒" },
  { id: "tree", label: "Arbre", icon: "🌳" },
  { id: "familiars", label: "Familiers", icon: "🐾" },
  { id: "combat", label: "Combat", icon: "⚔️" },
  { id: "duo", label: "Duo", icon: "🤝" },
];

let currentTab = "jobs";
let currentCombat = null;
let currentTreeVoie = null; // voie affichée dans l'arbre (null = voie du héros)
let currentTreeNode = null; // classe sélectionnée pour consultation (fiche)
// Coop locale (hotseat duo)
let currentDuo = null;       // duoCombat (escarmouche) OU duoDungeon (a .combat)
let duoSetup = { partnerClass: "mage" };
let duoUI = { activeSeat: "A", target: null, pendingBlessing: null };
// Mode du panneau Duo : "local" ou "online"
let duoMode = "local";
// État de la coop en ligne
const onlineState = {
  phase: "idle",           // idle | connecting | lobby | in_combat
  net: null,               // instance CoopNet
  myAccountId: null,       // identifiant de notre compte
  seat: null,              // "A" | "B"
  room: null,              // état du salon (depuis serveur)
  combat: null,            // publicView du combat (depuis serveur)
  combatLog: [],           // entrées de journal accumulées
  dungeon: null,           // { waveIndex, status }
  awaiting: [],            // sièges encore en attente de sélection
  pendingBlessings: null,  // options de bénédiction proposées
  myTarget: null,          // cible sélectionnée localement
  error: null,             // message d'erreur affiché
  serverUrl: localStorage.getItem("coop_server_url") || "ws://localhost:8080",
  // Flags de flux d'initialisation
  _createAfterWelcome: false,
  _joinAfterWelcome: null,
};

// --- Helpers du mode coop local (hotseat) ---
function duoCombatOf() { return currentDuo && (currentDuo.combat || currentDuo); }
function duoFirstSeat() {
  const c = duoCombatOf();
  if (!c) return "A";
  const aw = awaitingSeats(c);
  return aw[0] || "A";
}
// Après le choix d'un siège : passer au siège restant, ou résoudre si les deux ont choisi.
function duoAfterChoice() {
  const c = duoCombatOf();
  if (!c) return;
  if (bothChosen(c)) {
    resolveTurn(c);
    if (currentDuo.def) { // donjon : faire progresser les vagues
      const s = syncDungeon(currentDuo);
      if (s.status === "blessing_offered") duoUI.pendingBlessing = s.options;
    }
    duoUI.target = null;
    duoUI.activeSeat = duoFirstSeat();
  } else {
    duoUI.activeSeat = awaitingSeats(c)[0] || duoFirstSeat();
    duoUI.target = null;
  }
}
function duoErrorLabel(code) {
  return ({
    SKILL_NOT_OWNED: "Compétence non disponible pour ce héros.",
    ON_COOLDOWN: "Compétence en recharge.",
    NOT_ENOUGH_RESOURCE: "Ressource insuffisante.",
    INVALID_TARGET: "Cible invalide pour cette compétence.",
    HERO_DOWN: "Ce héros est à terre.",
    OUT_OF_TURN: "Ce n'est pas le moment d'agir.",
  })[code] || "Action impossible.";
}
let selectedClassId = null;
let currentZoneId = null; // zone sélectionnée dans le menu Combat (défaut : 1re)
let familiarFilters = { element: "all", role: "all", rarity: "all" };
// Filtres de l'Atelier (persistants pendant la session).
let craftFilters = defaultCraftFilters();
// Recette sélectionnée dans l'Atelier (affichée dans le panneau de détail).
let craftSelectedId = null;
let lastTick = Date.now();
let tickCount = 0;
// Pendant qu'une animation de tour joue, on bloque les clics (évite de
// superposer / casser les dash ; chaque perso revient pile à sa place).
let combatBusy = false;
let combatBusyTimer = null;

// --- Préchargement des images de combat -------------------------------------
// Les images de combat (décor d'arène, sprites) sont en loading="lazy" : sans
// préchargement, elles n'arrivent qu'au moment où l'écran de combat s'affiche,
// d'où un « pop-in » visible et des animations qui jouent sur l'emoji de secours
// au tout premier combat (surtout mobile/Xbox, cache froid). On les met donc en
// cache À L'AVANCE, dès que le joueur consulte une zone -> écran de combat peint
// d'emblée. Idempotent : chaque image n'est préchargée qu'une fois.
const preloaded = new Set();
function preloadImage(path) {
  if (!path || preloaded.has(path)) return;
  preloaded.add(path);
  const img = new Image();
  img.src = path; // suffit à déclencher la mise en cache du navigateur
}

// Précharge le décor + le sprite du héros + les sprites des ennemis/boss d'une
// zone (l'un d'eux sera l'adversaire du prochain combat). Résout la zone comme
// la vue (zone par défaut si l'id est absent/verrouillé).
function preloadZoneCombatAssets(zoneId) {
  const state = getState();
  if (!state) return;
  const zones = Object.values(ZONES);
  let zone = zones.find((z) => z.id === zoneId) || zones[0];
  if (!zoneUnlocked(state, zone.id).unlocked) zone = zones[0];
  preloadImage(zone.arena || zone.image); // décor d'arène (grande image)
  const heroClass = getClass(state.character.classId);
  if (heroClass) preloadImage(heroClass.sprite); // sprite du héros
  for (const id of zone.enemies || []) preloadImage(getEnemy(id)?.sprite);
  preloadImage(getEnemy(zone.boss)?.sprite);
}

// --- Rendu ------------------------------------------------------------------

function renderModeSwitcher() {
  return `<div class="duo-mode-tabs">
    <button class="tab-pill ${duoMode === "local" ? "active" : ""}" data-act="duo-mode" data-m="local">🤝 Local</button>
    <button class="tab-pill ${duoMode === "online" ? "active" : ""}" data-act="duo-mode" data-m="online">🌐 En ligne</button>
  </div>`;
}

function renderScreen() {
  const state = getState();
  if (currentCombat) return renderBattle(state, currentCombat);
  switch (currentTab) {
    case "character":
      return renderCharacter(state);
    case "jobs":
      return renderJobs(state);
    case "craft":
      return renderCraft(state, craftFilters, craftSelectedId);
    case "inventory":
      return renderInventory(state);
    case "tree":
      return renderClassTree(state, currentTreeVoie, currentTreeNode);
    case "duo": {
      const sw = renderModeSwitcher();
      if (duoMode === "online") {
        const view = onlineState.phase === "in_combat"
          ? renderOnlineCombat(onlineState)
          : onlineState.phase === "lobby"
            ? renderOnlineLobby(onlineState)
            : renderOnlineHome(onlineState);
        return sw + view;
      }
      return sw + (currentDuo ? renderDuoCombat(state, currentDuo, duoUI) : renderDuoSetup(state, duoSetup));
    }
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
    // Cible de l'effet : ennemi, héros, ou une INVOCATION précise (summon:<uid>).
    let elId = "bt-hero";
    if (fx.target === "enemy") elId = "bt-enemy";
    else if (typeof fx.target === "string" && fx.target.startsWith("summon:")) elId = "bt-summon-" + fx.target.slice(7);
    const f = document.getElementById(elId);
    if (!f) continue;
    const num = document.createElement("span");
    const spr = f.querySelector(".fighter-sprite");
    const dir = fx.target === "enemy" ? "right" : "left";
    if (fx.evaded) {
      // Esquive : pas de chiffre de dégâts, pas de son d'impact (instr. 60).
      num.className = "dmg-float evade";
      num.textContent = "Esquive";
      if (spr) pulseClass(spr, "hit-" + dir, 200);
    } else if (fx.guard) {
      // Dégâts absorbés par la Garde-réserve : affichés à part (instr. 82).
      num.className = "dmg-float guard";
      num.textContent = "-" + fx.dmg + " Garde";
    } else {
      num.className = "dmg-float" + (fx.crit ? " crit" : "");
      num.textContent = "-" + fx.dmg + (fx.crit ? " !" : "");
      if (spr) pulseClass(spr, (fx.crit ? "crit-" : "hit-") + dir, fx.crit ? 500 : 320);
      playHit(fx.crit);
    }
    f.appendChild(num);
    num.addEventListener("animationend", () => num.remove());
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
// Met à jour la barre de Garde-réserve d'un combattant (largeur + surlignage actif).
function updateGuardBar(idbase, c) {
  if (!c || !c.guardMax) return;
  setWidth("bt-" + idbase + "-guard-fill", c.guardPool, c.guardMax);
  const wrap = document.getElementById("bt-" + idbase + "-guard");
  if (wrap) {
    wrap.classList.toggle("active", !!c.guardActive);
    wrap.title = "Garde " + fmt(c.guardPool) + "/" + fmt(c.guardMax);
  }
}

// Re-render de l'écran seul (et des objectifs), sans toucher au topbar.
function renderScreenOnly() {
  const state = getState();
  if (!state) return;
  $("#objectives").innerHTML = currentCombat ? "" : renderObjectives(state);
  $("#screen").innerHTML = renderScreen();
}

// Mise à jour CIBLÉE de l'écran Métiers à la fin d'un cycle de récolte : on ne
// réécrit que l'XP/le niveau, sans recréer les illustrations des métiers (sinon
// elles clignotent toutes les 5–20 s). Renvoie false si un rendu complet est
// nécessaire (montée de niveau -> les paliers/sélecteurs changent).
function updateJobsScreen(state) {
  const blocks = document.querySelectorAll(".job-block[data-job]");
  if (!blocks.length) return false;
  for (const block of blocks) {
    const jp = state.jobs[block.dataset.job];
    if (!jp) return false;
    if (String(jp.level) !== block.dataset.level) return false; // level-up -> full render
    const xpNext = jobXpToNext(jp.level);
    const fill = block.querySelector(".job-xp-fill");
    if (fill) fill.style.width = (xpNext > 0 ? Math.max(0, Math.min(100, (jp.xp / xpNext) * 100)) : 0) + "%";
    const num = block.querySelector(".job-xp-num");
    if (num) num.textContent = fmt(jp.xp) + "/" + fmt(xpNext);
  }
  return true;
}

// Mise à jour CIBLÉE des quantités de l'inventaire (ressources) sans recréer
// les illustrations. Renvoie false si l'ensemble des ressources a changé
// (nouvelle ressource ou ressource épuisée) -> rendu complet pour réordonner.
function updateInventoryResources(state) {
  const grid = document.querySelector(".inv-grid");
  if (!grid) return false;
  const ids = Object.keys(state.inventory.resources).filter((id) => state.inventory.resources[id] > 0);
  const nodes = grid.querySelectorAll(".inv-item[data-res]");
  if (nodes.length !== ids.length) return false; // composition changée
  for (const node of nodes) {
    const qty = state.inventory.resources[node.dataset.res];
    if (!qty || qty <= 0) return false; // une ressource a disparu
    const q = node.querySelector(".inv-qty");
    if (q) q.textContent = "×" + fmt(qty);
  }
  return true;
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
  setText("tb-gold-num", fmt(state.gold)); // l'icône (img) reste, on met à jour le nombre
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
  // Garde-réserve : largeur + état actif (surlignage), pour joueur et ennemi.
  updateGuardBar("player", combat.player);
  updateGuardBar("enemy", combat.enemy);
  setText("bt-turn", combat.turn);
  const fc = document.getElementById("bt-forecast");
  if (fc) fc.innerHTML = renderForecast(combat);
  const it = document.getElementById("bt-intent");
  if (it) it.innerHTML = renderIntent(combat);
  const sp = document.getElementById("bt-states-player");
  if (sp) sp.innerHTML = renderStates(combat.player);
  const se = document.getElementById("bt-states-enemy");
  if (se) se.innerHTML = renderStates(combat.enemy);
  // Invocations : conteneur ciblé (unités qui apparaissent/meurent en combat).
  const su = document.getElementById("bt-summons");
  if (su) su.innerHTML = renderSummons(combat);
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

  // Quand un cycle de récolte s'achève, on met à jour l'écran Métiers/Sac de
  // façon CIBLÉE (quantités, XP, palier) sans recréer les illustrations -> plus
  // de clignotement. On ne retombe sur un rendu complet que si la structure
  // change (montée de niveau, nouvelle ressource). Les autres onglets se mettent
  // à jour au clic.
  if (cycle && !currentCombat) {
    if (currentTab === "jobs") {
      if (!updateJobsScreen(state)) renderScreenOnly();
    } else if (currentTab === "inventory") {
      if (!updateInventoryResources(state)) renderScreenOnly();
    }
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

// --- Coop en ligne : connexion et gestion des événements serveur -----------

function setupOnlineNet(url) {
  // Ferme l'éventuelle connexion précédente proprement.
  if (onlineState.net) { try { onlineState.net.close(); } catch {} }
  onlineState.phase = "connecting";
  onlineState.error = null;
  onlineState.room = null;
  onlineState.combat = null;
  onlineState.combatLog = [];
  onlineState.seat = null;
  renderAll();

  const net = new CoopNet(url);
  onlineState.net = net;

  net.on("welcome", (d) => {
    onlineState.myAccountId = d.accountId;
    if (d.token) localStorage.setItem("coop_token_" + d.accountId, d.token);
    if (onlineState._createAfterWelcome) {
      onlineState._createAfterWelcome = false;
      net.createRoom();
    } else if (onlineState._joinAfterWelcome) {
      const code = onlineState._joinAfterWelcome;
      onlineState._joinAfterWelcome = null;
      net.joinRoom(code);
    }
  });

  net.on("room/state", (d) => {
    onlineState.room = d;
    // Détermine notre siège via accountId
    if (d.seats.A && d.seats.A.accountId === onlineState.myAccountId) onlineState.seat = "A";
    else if (d.seats.B && d.seats.B.accountId === onlineState.myAccountId) onlineState.seat = "B";
    if (d.phase === "lobby" || d.phase === "in_combat" || d.phase === "in_dungeon") {
      if (onlineState.phase === "connecting" || onlineState.phase === "idle") onlineState.phase = "lobby";
      if (d.phase === "lobby") { onlineState.phase = "lobby"; }
    }
    onlineState.error = null;
    renderAll();
  });

  net.on("session/started", (d) => {
    onlineState.combat = d.view;
    onlineState.dungeon = d.dungeon || null;
    onlineState.combatLog = (d.view && d.view.log) ? [...d.view.log] : [];
    onlineState.awaiting = (d.view && d.view.awaiting) || [];
    onlineState.pendingBlessings = null;
    onlineState.myTarget = null;
    onlineState.phase = "in_combat";
    renderAll();
  });

  net.on("combat/view", (d) => {
    onlineState.combat = d.view;
    onlineState.dungeon = d.dungeon || null;
    if (d.view && d.view.log) onlineState.combatLog = [...d.view.log];
    onlineState.awaiting = (d.view && d.view.awaiting) || [];
    onlineState.pendingBlessings = null;
    renderAll();
  });

  net.on("combat/resolution", (d) => {
    if (d.log) onlineState.combatLog.push(...d.log);
    renderAll();
  });

  net.on("combat/awaiting", (d) => {
    onlineState.awaiting = d.needFrom || [];
    renderAll();
  });

  net.on("combat/blessing", (d) => {
    if (d.view) { onlineState.combat = d.view; onlineState.dungeon = d.dungeon || null; }
    onlineState.pendingBlessings = d.options || [];
    renderAll();
  });

  net.on("combat/result", (d) => {
    if (d.view) onlineState.combat = d.view;
    // Le résultat final : on reste en in_combat pour afficher victoire/défaite,
    // puis l'utilisateur clique "Retour au salon" pour revenir en lobby.
    onlineState.awaiting = [];
    onlineState.pendingBlessings = null;
    renderAll();
  });

  net.on("error", (d) => {
    const code = (d && d.code) || "ERREUR";
    const msg = (d && d.message) || code;
    onlineState.error = msg;
    // Si l'erreur survient pendant la connexion, retourner à idle
    if (onlineState.phase === "connecting") onlineState.phase = "idle";
    renderAll();
    toast("Serveur : " + msg, "warn");
  });

  net.on("disconnected", () => {
    onlineState.phase = "idle";
    onlineState.error = "Déconnecté du serveur. Vérifie l'URL et réessaie.";
    onlineState.room = null;
    onlineState.combat = null;
    onlineState.net = null;
    renderAll();
  });

  net.connect().then(() => {
    const state = getState();
    const handle = state?.character?.name || "Aventurier";
    // Tente d'abord une reconnexion avec le token existant.
    const savedToken = onlineState.myAccountId
      ? localStorage.getItem("coop_token_" + onlineState.myAccountId)
      : null;
    if (savedToken) {
      net.hello(savedToken);
    } else {
      net.guest(handle);
    }
  }).catch(() => {
    onlineState.phase = "idle";
    onlineState.error = "Impossible de se connecter au serveur. Vérifie l'URL.";
    onlineState.net = null;
    renderAll();
  });
}

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
    // Onglet Combat ouvert : on précharge le décor + les sprites pour que le
    // premier combat s'affiche complet, sans pop-in.
    if (currentTab === "combat") preloadZoneCombatAssets(currentZoneId);
    maybeShowGuide(currentTab); // guide contextuel à la première ouverture
  },
  "select-zone": (el) => {
    currentZoneId = el.dataset.zone;
    renderAll();
    preloadZoneCombatAssets(currentZoneId); // précharge les images de la zone choisie
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
  "familiar-posture": (el) => {
    const r = setFamiliarPosture(getState(), el.dataset.id, el.dataset.posture);
    if (!r.ok) return toast(r.error, "warn");
    save();
    renderAll();
  },
  // --- Arbre de classes ---
  // Consultation : MISE À JOUR CIBLÉE de la fiche + surlignage (pas de rebuild complet).
  "tree-select": (el) => {
    currentTreeNode = el.dataset.id;
    const detail = document.getElementById("tree-detail");
    if (detail) detail.outerHTML = renderNodeDetail(getState(), currentTreeNode);
    document.querySelectorAll(".tree-node.selected").forEach((n) => {
      n.classList.remove("selected");
      n.setAttribute("aria-pressed", "false");
    });
    if (el.classList) { el.classList.add("selected"); el.setAttribute("aria-pressed", "true"); }
  },
  "tree-voie": (el) => {
    currentTreeVoie = el.dataset.voie;
    currentTreeNode = null; // recadre la fiche sur la voie affichée
    renderAll();
  },
  "unlock-node": (el) => {
    const r = unlockNode(getState(), el.dataset.id);
    if (!r.ok) return toast(r.error, "warn");
    toast(`${r.name} débloquée !`, "good");
    currentTreeNode = el.dataset.id;
    save();
    renderAll();
  },
  "equip-node": (el) => {
    const r = equipClassNode(getState(), el.dataset.id, { inCombat: !!currentCombat });
    if (!r.ok) return toast(r.error, "warn");
    toast(`Classe équipée : ${r.name}.`, "good");
    currentTreeNode = el.dataset.id;
    save();
    renderAll();
  },
  "equip-heritage": (el) => {
    const r = equipHeritage(getState(), el.dataset.id || null);
    if (!r.ok) return toast(r.error, "warn");
    save();
    renderAll();
  },
  // --- Sélecteur de mode du panneau Duo ---
  "duo-mode": (el) => { duoMode = el.dataset.m; renderAll(); },

  // --- Coop en ligne : helpers internes ------------------------------------
  // (setupOnlineNet est défini juste avant les handlers, après les imports)

  // Accueil : créer une partie
  "net-create": () => {
    const urlInput = document.getElementById("net-server-url");
    const url = (urlInput && urlInput.value.trim()) || onlineState.serverUrl;
    localStorage.setItem("coop_server_url", url);
    onlineState.serverUrl = url;
    onlineState._createAfterWelcome = true;
    onlineState._joinAfterWelcome = null;
    setupOnlineNet(url);
  },

  // Accueil : rejoindre (ouvre une modale pour le code)
  "net-join-prompt": () => {
    showModal(`
      <h2>Rejoindre une partie</h2>
      <p class="muted">Entre le code d'invitation reçu par ton ami·e :</p>
      <input id="net-join-code" class="net-url-input" type="text" placeholder="AETH7Q2P" maxlength="16" style="text-transform:uppercase">
      <div class="end-actions" style="margin-top:1rem">
        <button class="btn" data-act="close-modal">Annuler</button>
        <button class="btn primary" data-act="net-join">Rejoindre</button>
      </div>
    `);
    setTimeout(() => document.getElementById("net-join-code")?.focus(), 50);
  },

  // Modale de rejoindre → connexion
  "net-join": () => {
    const code = document.getElementById("net-join-code")?.value.trim().toUpperCase();
    if (!code) return toast("Entre un code d'invitation.", "warn");
    closeModal();
    const urlInput = document.getElementById("net-server-url");
    const url = (urlInput && urlInput.value.trim()) || onlineState.serverUrl;
    localStorage.setItem("coop_server_url", url);
    onlineState.serverUrl = url;
    onlineState._createAfterWelcome = false;
    onlineState._joinAfterWelcome = code;
    setupOnlineNet(url);
  },

  // Lobby : se marquer prêt (envoie le loadout = state complet)
  "net-ready": () => {
    if (!onlineState.net) return;
    const loadout = getState();
    if (!loadout) return toast("Aucune partie chargée.", "warn");
    onlineState.net.ready(true, loadout);
  },

  // Lobby (hôte) : lancer une session
  "net-start": (el) => {
    if (!onlineState.net) return;
    onlineState.net.startSession(el.dataset.mode, el.dataset.id);
  },

  // Combat : sélectionner une cible
  "net-target": (el) => { onlineState.myTarget = el.dataset.ref; renderAll(); },

  // Combat : envoyer une compétence
  "net-skill": (el) => {
    if (!onlineState.net) return;
    const target = onlineState.myTarget
      || ((onlineState.combat?.enemies || []).find((e) => !e.down && e.hp > 0)?.uid)
      || "self";
    onlineState.net.intent(el.dataset.id, target);
    // Retire notre siège de "awaiting" localement pour feedback immédiat
    onlineState.awaiting = (onlineState.awaiting || []).filter((s) => s !== onlineState.seat);
    renderAll();
  },

  // Combat donjon : choisir une bénédiction (hôte)
  "net-bless": (el) => {
    if (!onlineState.net) return;
    onlineState.net.blessing(el.dataset.id || null);
    onlineState.pendingBlessings = null;
    renderAll();
  },

  // Victoire / défaite : retour au lobby sans quitter le salon
  "net-back-lobby": () => {
    onlineState.phase = "lobby";
    onlineState.combat = null;
    onlineState.combatLog = [];
    onlineState.dungeon = null;
    onlineState.awaiting = [];
    onlineState.pendingBlessings = null;
    onlineState.myTarget = null;
    onlineState.error = null;
    renderAll();
  },

  // Quitter : ferme la connexion et retour à idle
  "net-leave": () => {
    if (onlineState.net) {
      try { onlineState.net.leaveRoom(); } catch {}
      try { onlineState.net.close(); } catch {}
      onlineState.net = null;
    }
    onlineState.phase = "idle";
    onlineState.seat = null;
    onlineState.room = null;
    onlineState.combat = null;
    onlineState.combatLog = [];
    onlineState.dungeon = null;
    onlineState.awaiting = [];
    onlineState.pendingBlessings = null;
    onlineState.myTarget = null;
    onlineState.error = null;
    onlineState._createAfterWelcome = false;
    onlineState._joinAfterWelcome = null;
    renderAll();
  },

  // --- Coop locale (hotseat duo) ---
  "duo-partner": (el) => { duoSetup.partnerClass = el.dataset.cls; renderAll(); },
  "duo-start": (el) => {
    const stateA = getState();
    const lvl = stateA.character.level;
    const stateB = newGame("Partenaire", duoSetup.partnerClass || "mage");
    stateB.character.level = lvl;
    stateB.character.hpCurrent = getDerivedStats(stateB).maxHp;
    const opts = { forceEnrage: false };
    if (el.dataset.mode === "dungeon") {
      currentDuo = createDuoDungeon(stateA, stateB, el.dataset.id, opts);
    } else {
      const sk = DUO_SKIRMISHES[el.dataset.id];
      currentDuo = createDuoCombat(stateA, stateB, { enemies: (sk && sk.enemies) || [] }, opts);
    }
    duoUI = { activeSeat: duoFirstSeat(), target: null, pendingBlessing: null };
    renderAll();
  },
  "duo-target": (el) => { duoUI.target = el.dataset.ref; renderAll(); },
  "duo-skill": (el) => {
    const c = duoCombatOf();
    if (!c) return;
    const seat = duoUI.activeSeat;
    const target = duoUI.target || (livingEnemies(c)[0] && livingEnemies(c)[0].uid) || "self";
    const r = submitIntent(c, seat, { skillId: el.dataset.id, targetRef: target });
    if (!r.ok) return toast(duoErrorLabel(r.error), "warn");
    duoAfterChoice();
    renderAll();
  },
  "duo-bless": (el) => {
    if (!currentDuo || !currentDuo.def) return;
    if (el.dataset.id) chooseBlessing(currentDuo, el.dataset.id);
    else skipBlessing(currentDuo);
    duoUI.pendingBlessing = null;
    duoUI.activeSeat = duoFirstSeat();
    duoUI.target = null;
    renderAll();
  },
  "duo-quit": () => { currentDuo = null; duoUI = { activeSeat: "A", target: null, pendingBlessing: null }; renderAll(); },
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
  // Sélection d'une recette dans la grille : met à jour le panneau de détail et
  // le surlignage SANS reconstruire la grille (pas d'images recréées).
  "craft-select": (el) => {
    craftSelectedId = el.dataset.recipe;
    const detail = document.getElementById("craft-detail");
    if (detail) detail.innerHTML = renderCraftDetail(getState(), craftSelectedId);
    document.querySelectorAll(".craft-tile.selected").forEach((t) => t.classList.remove("selected"));
    const tile = document.querySelector(`.craft-tile[data-recipe="${craftSelectedId}"]`);
    if (tile) tile.classList.add("selected");
  },
  craft: (el) => {
    const r = craft(getState(), el.dataset.id);
    if (!r.ok) return toast(r.error, "warn");
    craftSelectedId = el.dataset.id; // on garde l'objet sélectionné après fabrication
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
    // data-slot (optionnel) = main choisie pour une arme à une main.
    const r = equip(getState(), el.dataset.uid, el.dataset.slot || null);
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
        <button class="btn" data-act="export-save">⬇ Exporter la sauvegarde</button>
        <button class="btn" data-act="import-save">⬆ Importer une sauvegarde</button>
        <button class="btn danger" data-act="reset-save">Nouvelle partie</button>
        <button class="btn" data-act="close-modal">Fermer</button>
      </div>
      <p class="muted small">Ta progression est stockée dans ce navigateur. Exporte un fichier de secours au cas où les données seraient effacées.</p>
    `);
  },
  "export-save": () => {
    const data = exportSave();
    if (!data) return toast("Aucune partie à exporter.", "warn");
    const state = getState();
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = (state.character?.name || "heros").replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `idle-rpg-${safeName}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Sauvegarde exportée.", "good");
  },
  "import-save": () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const r = importSave(String(reader.result));
        if (!r.ok) return toast(r.error, "warn");
        closeModal();
        currentCombat = null;
        currentTab = "character";
        renderAll();
        toast("Sauvegarde importée !", "good");
        playDing();
      };
      reader.onerror = () => toast("Lecture du fichier impossible.", "warn");
      reader.readAsText(file);
    });
    input.click();
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
  "stat-info": (el) => {
    // Infobulle de statistique (accessible au toucher / clavier / Xbox, instr. 48).
    const sd = PRIMARY_STATS[el.dataset.stat];
    if (!sd) return;
    showModal(`
      <h2>${esc(sd.name)}</h2>
      <p>${esc(sd.tip)}</p>
      <div class="modal-actions"><button class="btn primary" data-act="close-modal">Fermer</button></div>
    `);
  },
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
    // Échap ferme la modale active (instr. 308).
    if (e.key === "Escape") {
      const m = $("#modal");
      if (m && m.classList.contains("open")) closeModal();
    }
  });
  // Recherche de l'Atelier en direct : mise à jour CIBLÉE de la liste des
  // recettes (on ne recrée pas l'input -> le focus et le curseur sont préservés).
  document.addEventListener("input", (e) => {
    if (e.target.id === "craft-search") {
      craftFilters.search = e.target.value;
      const results = document.getElementById("craft-results");
      const state = getState();
      if (results && state) results.innerHTML = renderCraftResults(state, craftFilters, craftSelectedId);
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
