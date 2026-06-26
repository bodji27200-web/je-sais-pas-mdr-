// État global du jeu + sauvegarde locale (localStorage).
// L'état est volontairement un objet JSON simple : facile à sauvegarder,
// à versionner et à étendre.

import { getClass } from "../data/classes.js";
import { STATIONS } from "../data/recipes.js";
import { makeInstance } from "./items.js";

// Métiers de transformation (Fonte, Forge, etc.) : niveau propre qui monte en
// fabriquant. Un par station de craft (data-driven). Niveau 1 au départ.
export function initProfessions(existing = {}) {
  const out = {};
  for (const id of Object.keys(STATIONS)) {
    out[id] = existing[id] || { level: 1, xp: 0 };
  }
  return out;
}

export const SAVE_KEY = "idle_rpg_save_v1";
// Copie de sécurité écrite AVANT toute migration : si une migration tournait mal
// dans une future version, on garde une trace de la sauvegarde d'origine.
export const BACKUP_KEY = "idle_rpg_save_backup";
export const SAVE_VERSION = 5;

let state = null;

export function getState() {
  return state;
}

function storageAvailable() {
  return typeof localStorage !== "undefined";
}

export function hasSave() {
  if (!storageAvailable()) return false;
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

// Crée une nouvelle partie pour une classe donnée.
export function newGame(name, classId) {
  const cls = getClass(classId);
  if (!cls || cls.locked) throw new Error("Classe indisponible : " + classId);

  const now = Date.now();
  state = {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    character: {
      name: (name || "Aventurier").slice(0, 20),
      classId,
      level: 1,
      xp: 0,
      hpCurrent: cls.baseStats.hp, // ajusté ensuite par les stats dérivées
      equipment: { weapon: null, head: null, chest: null, legs: null, accessory: null },
      specId: null, // voie de spécialisation (choisie au niveau 10)
      specChanges: 0, // nombre de changements de voie payés (coût croissant)
    },
    jobs: {
      woodcutting: { level: 1, xp: 0 },
      mining: { level: 1, xp: 0 },
    },
    // Métiers de transformation (montent en fabriquant) : un par station.
    professions: initProfessions(),
    // Une seule activité de récolte active à la fois :
    // { jobId, tierId, cycleStart, auto }. `auto` suit le meilleur palier.
    activity: null,
    inventory: {
      resources: {}, // { resourceId: qty }
      equipment: [], // liste d'instances uniques (voir core/items.js)
    },
    gold: 0,
    counters: { kills: 0, bossKills: 0, crafted: 0, harvested: 0 },
    flags: { bossDefeated: false },
    objectives: {
      woodcut: false,
      ingot: false,
      weapon: false,
      equipWeapon: false,
      firstKill: false,
    },
    settings: { muted: false },
  };
  save();
  return state;
}

// Migre une sauvegarde vers la version courante. Renvoie null si impossible.
function migrate(parsed) {
  if (!parsed) return null;
  // v1 -> v2 : l'équipement empilé { id: qty } devient une liste d'instances
  // uniques (rareté commune) ; les slots équipés deviennent des instances.
  if (parsed.version === 1) {
    const oldInv = parsed.inventory?.equipment || {};
    const list = [];
    for (const id of Object.keys(oldInv)) {
      const qty = oldInv[id] || 0;
      for (let i = 0; i < qty; i++) {
        const inst = makeInstance(id, "common");
        if (inst) list.push(inst);
      }
    }
    if (!parsed.inventory) parsed.inventory = { resources: {} };
    parsed.inventory.equipment = list;

    const slots = parsed.character?.equipment || {};
    for (const slot of Object.keys(slots)) {
      const val = slots[slot];
      if (typeof val === "string") slots[slot] = makeInstance(val, "common");
    }
    parsed.version = 2;
  }
  // v2 -> v3 : introduction des spécialisations (voie choisie au niveau 10).
  if (parsed.version === 2) {
    if (parsed.character) {
      if (parsed.character.specId === undefined) parsed.character.specId = null;
      if (parsed.character.specChanges === undefined) parsed.character.specChanges = 0;
    }
    parsed.version = 3;
  }
  // v3 -> v4 : métiers à activité principale évolutive. L'activité passe de
  // { jobId, actionId, cycleStart } à { jobId, tierId, cycleStart, auto }.
  // Les ids de palier sont identiques aux anciens ids d'action -> mapping direct.
  if (parsed.version === 3) {
    const act = parsed.activity;
    if (act) {
      if (act.tierId === undefined) act.tierId = act.actionId || null;
      delete act.actionId;
      if (act.auto === undefined) act.auto = true; // suit le meilleur palier par défaut
    }
    parsed.version = 4;
  }
  // v4 -> v5 : métiers de transformation à niveau propre (Fonte séparée de la
  // Forge). On initialise les professions manquantes sans rien écraser.
  if (parsed.version === 4) {
    parsed.professions = initProfessions(parsed.professions || {});
    parsed.version = 5;
  }
  return parsed.version === SAVE_VERSION ? parsed : null;
}

export function load() {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsedRaw = JSON.parse(raw);

    // Sécurité : si la sauvegarde est plus ancienne que la version courante, on
    // en écrit une copie de secours AVANT de migrer. La migration n'écrase
    // jamais l'original tant qu'elle n'a pas abouti (voir plus bas).
    if (parsedRaw && parsedRaw.version !== SAVE_VERSION) {
      try {
        localStorage.setItem(BACKUP_KEY, raw);
      } catch (e) {
        /* le manque d'espace ne doit pas bloquer le chargement */
      }
    }

    const parsed = migrate(parsedRaw);
    if (!parsed) return null; // migration impossible : l'original reste intact.
    state = parsed;
    // On ne réécrit la sauvegarde migrée que si la migration a réellement abouti.
    if (parsedRaw.version !== SAVE_VERSION) save();
    return state;
  } catch (e) {
    console.error("Échec du chargement de la sauvegarde", e);
    return null;
  }
}

export function save() {
  if (!state) return;
  if (state) state.lastSeen = Date.now();
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Échec de la sauvegarde", e);
  }
}

export function resetSave() {
  if (storageAvailable()) {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      /* ignore */
    }
  }
  state = null;
}

// --- Helpers d'inventaire ---

export function addResource(id, qty) {
  if (qty <= 0) return;
  const inv = state.inventory.resources;
  inv[id] = (inv[id] || 0) + qty;
}

export function removeResource(id, qty) {
  const inv = state.inventory.resources;
  inv[id] = (inv[id] || 0) - qty;
  if (inv[id] <= 0) delete inv[id];
}

export function resourceCount(id) {
  return state.inventory.resources[id] || 0;
}

// Équipement : liste d'instances uniques (plus de comptage par id).
export function addEquipmentInstance(inst) {
  if (inst) state.inventory.equipment.push(inst);
}

export function removeEquipmentInstance(uid) {
  const arr = state.inventory.equipment;
  const i = arr.findIndex((e) => e.uid === uid);
  if (i === -1) return null;
  return arr.splice(i, 1)[0];
}

export function findEquipmentInstance(uid) {
  return state.inventory.equipment.find((e) => e.uid === uid) || null;
}

export function equipmentList() {
  return state.inventory.equipment;
}

export function addGold(amount) {
  state.gold += amount;
}
