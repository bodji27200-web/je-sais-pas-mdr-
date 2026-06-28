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
import { startCombat, resolveRound, buildPlayerCombatant } from "./systems/combat.js";
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
import { renderDuoSetup, renderDuoCombat, renderOnlineConnect, renderOnlineLobby, renderOnlineCombat, DUO_SKIRMISHES } from "./ui/coopViews.js";
import { createDuoCombat, submitIntent, resolveTurn, bothChosen, awaitingSeats, livingHeroes, livingEnemies, SEATS } from "./coop/duoCombat.js";
import { createDuoDungeon, syncDungeon, chooseBlessing, skipBlessing } from "./coop/duoDungeon.js";
import { DUNGEONS } from "./data/dungeons.js";
import { CoopNet } from "./coop/net.js";
import { getSkill as getSkillDef } from "./data/skills.js";

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
// Coop EN LIGNE (à distance)
let coopNet = null;
let coopOnline = {
  active: false, url: "", handle: "", connected: false, connecting: false,
  room: null, mySeat: null, inSession: false, view: null, dungeon: null,
  awaiting: [], log: [], blessing: null, result: null, target: null, error: "",
};
function resetOnline() {
  coopOnline = { active: false, url: coopOnline.url, handle: coopOnline.handle, connected: false, connecting: false, room: null, mySeat: null, inSession: false, view: null, dungeon: null, awaiting: [], log: [], blessing: null, result: null, target: null, error: "" };
}
// Kit du joueur local (pour l'UI en ligne) : ids + noms + coûts.
function myOnlineKit() {
  try {
    const sk = buildPlayerCombatant(getState()).skills;
    return sk.map((id) => { const s = getSkillDef(id); return { id, name: (s && s.name) || id, cost: (s && s.cost) || 0 }; });
  } catch { return [{ id: "basic_attack", name: "Attaque", cost: 0 }]; }
}
// Branche les écouteurs réseau sur l'état + re-rendu.
function wireCoopNet(net) {
  net.on("welcome", (p) => { coopOnline.connected = true; coopOnline.connecting = false; coopOnline.error = ""; if (p && p.handle) coopOnline.handle = p.handle; renderAll(); });
  net.on("room/state", (p) => { coopOnline.room = p; coopOnline.error = ""; renderAll(); });
  net.on("session/started", (p) => { coopOnline.inSession = true; coopOnline.result = null; coopOnline.blessing = null; coopOnline.log = []; coopOnline.view = p.view; coopOnline.dungeon = p.dungeon; coopOnline.awaiting = (p.view && p.view.awaiting) || []; renderAll(); });
  net.on("combat/view", (p) => { coopOnline.view = p.view; coopOnline.dungeon = p.dungeon; coopOnline.blessing = null; coopOnline.awaiting = (p.view && p.view.awaiting) || []; renderAll(); });
  net.on("combat/awaiting", (p) => { coopOnline.awaiting = (p && p.needFrom) || []; renderAll(); });
  net.on("combat/resolution", (p) => { if (p && p.log) coopOnline.log = coopOnline.log.concat(p.log).slice(-60); renderAll(); });
  net.on("combat/blessing", (p) => { coopOnline.blessing = p.options; if (p.view) coopOnline.view = p.view; renderAll(); });
  net.on("combat/result", (p) => { coopOnline.result = p.outcome; coopOnline.inSession = true; renderAll(); });
  net.on("error", (p) => { coopOnline.error = (p && p.code) || "Erreur"; toast(coopOnline.error, "warn"); renderAll(); });
  net.on("disconnected", () => { coopOnline.connected = false; if (coopOnline.active) toast("Déconnecté du serveur", "warn"); renderAll(); });
  net.on("neterror", () => { coopOnline.connecting = false; coopOnline.error = "Connexion impossible (vérifie l'adresse / le serveur)"; renderAll(); });
}

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
    case "duo":
      if (coopOnline.active) {
        if (!coopOnline.connected) return renderOnlineConnect(coopOnline);
        if (coopOnline.inSession && coopOnline.view) return renderOnlineCombat(coopOnline, myOnlineKit());
        return renderOnlineLobby(coopOnline);
      }
      return currentDuo ? renderDuoCombat(state, currentDuo, duoUI) : renderDuoSetup(state, duoSetup);
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
  // --- Coop EN LIGNE ---
  "online-open": () => { coopOnline.active = true; renderAll(); },
  "online-back": () => { coopOnline.active = false; renderAll(); },
  "online-connect": () => {
    const url = (document.getElementById("online-url")?.value || "").trim();
    const handle = (document.getElementById("online-handle")?.value || "").trim() || "Invité";
    if (!url) { coopOnline.error = "Indique l'adresse du serveur."; return renderAll(); }
    coopOnline.url = url; coopOnline.handle = handle; coopOnline.connecting = true; coopOnline.error = "";
    try { coopNet && coopNet.close(); } catch {}
    coopNet = new CoopNet(url);
    wireCoopNet(coopNet);
    renderAll();
    coopNet.connect().then(() => coopNet.guest(handle)).catch(() => { coopOnline.connecting = false; coopOnline.error = "Connexion impossible (vérifie l'adresse / le serveur)."; renderAll(); });
  },
  "online-create": () => { coopOnline.mySeat = "A"; coopOnline.error = ""; coopNet && coopNet.createRoom(); },
  "online-join": () => {
    const code = (document.getElementById("online-code")?.value || "").trim();
    if (!code) { coopOnline.error = "Saisis le code du salon."; return renderAll(); }
    coopOnline.mySeat = "B"; coopOnline.error = ""; coopNet && coopNet.joinRoom(code);
  },
  "online-ready": (el) => {
    const ready = el.dataset.ready === "1";
    // On envoie son build (loadout) au serveur (§12) au moment d'être prêt.
    coopNet && coopNet.ready(ready, ready ? getState() : null);
  },
  "online-start": (el) => { coopNet && coopNet.startSession(el.dataset.mode, el.dataset.id); },
  "online-target": (el) => { coopOnline.target = el.dataset.ref; renderAll(); },
  "online-intent": (el) => {
    const v = coopOnline.view;
    const target = coopOnline.target || (v && v.enemies.find((e) => !e.down) || {}).id || "self";
    coopNet && coopNet.intent(el.dataset.id, target);
    coopOnline.target = null;
  },
  "online-bless": (el) => { coopNet && coopNet.blessing(el.dataset.id || null); coopOnline.blessing = null; },
  "online-return": () => { coopOnline.inSession = false; coopOnline.view = null; coopOnline.result = null; coopOnline.log = []; renderAll(); },
  "online-quit": () => { try { coopNet && coopNet.close(); } catch {} coopNet = null; resetOnline(); renderAll(); },
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
