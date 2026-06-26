// Tests de la sauvegarde : migrations de version et intégrité.
//
// `localStorage` n'existe pas sous Node : on en fournit un faux minimal AVANT
// d'importer le module d'état, afin de tester aussi la persistance.

import { test } from "node:test";
import assert from "node:assert/strict";

// Faux localStorage (suffisant pour les tests de persistance/migration).
class FakeStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}
globalThis.localStorage = new FakeStorage();

const { newGame, save, load, resetSave, SAVE_VERSION, BACKUP_KEY, SAVE_KEY } = await import(
  "../js/core/state.js"
);

test("newGame puis save/load conserve la progression", () => {
  resetSave();
  const s = newGame("Lara", "archer");
  s.gold = 123;
  s.character.level = 7;
  save();
  const loaded = load();
  assert.equal(loaded.gold, 123);
  assert.equal(loaded.character.level, 7);
  assert.equal(loaded.character.classId, "archer");
  assert.equal(loaded.version, SAVE_VERSION);
});

test("une sauvegarde v1 (équipement empilé) migre sans perte vers la version courante", () => {
  resetSave();
  // Forme v1 : inventory.equipment = { id: qty }, slots = id (string).
  const v1 = {
    version: 1,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    character: {
      name: "Vieux",
      classId: "warrior",
      level: 3,
      xp: 0,
      hpCurrent: 100,
      equipment: { weapon: "copper_sword", head: null, chest: null, legs: null, accessory: null },
    },
    jobs: { woodcutting: { level: 1, xp: 0 }, mining: { level: 1, xp: 0 } },
    activity: null,
    inventory: { resources: { soft_wood: 5 }, equipment: { iron_sword: 2 } },
    gold: 50,
    counters: { kills: 0, bossKills: 0, crafted: 0, harvested: 0 },
    flags: { bossDefeated: false },
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(v1));
  const loaded = load();
  assert.ok(loaded, "la migration doit réussir");
  assert.equal(loaded.version, SAVE_VERSION);
  // L'arme équipée est devenue une instance.
  assert.equal(typeof loaded.character.equipment.weapon, "object");
  assert.equal(loaded.character.equipment.weapon.baseId, "copper_sword");
  // Les 2 épées de fer empilées sont devenues 2 instances.
  assert.ok(Array.isArray(loaded.inventory.equipment));
  const ironSwords = loaded.inventory.equipment.filter((i) => i.baseId === "iron_sword");
  assert.equal(ironSwords.length, 2);
  // L'or et les ressources sont préservés.
  assert.equal(loaded.gold, 50);
  assert.equal(loaded.inventory.resources.soft_wood, 5);
});

test("une migration crée une copie de sécurité de la sauvegarde d'origine", () => {
  resetSave();
  const v1 = {
    version: 1,
    character: { name: "Sauve", classId: "mage", level: 1, xp: 0, hpCurrent: 50, equipment: {} },
    jobs: { woodcutting: { level: 1, xp: 0 }, mining: { level: 1, xp: 0 } },
    activity: null,
    inventory: { resources: {}, equipment: {} },
    gold: 0,
    counters: { kills: 0, bossKills: 0, crafted: 0, harvested: 0 },
    flags: {},
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(v1));
  load();
  const backup = localStorage.getItem(BACKUP_KEY);
  assert.ok(backup, "une copie de sécurité doit exister");
  const parsed = JSON.parse(backup);
  assert.equal(parsed.version, 1, "la copie de sécurité conserve la version d'origine");
});

test("migration v3 -> v4 : l'activité passe de actionId à tierId + auto", () => {
  resetSave();
  const v3 = {
    version: 3,
    character: {
      name: "Bucheron",
      classId: "warrior",
      level: 5,
      xp: 0,
      hpCurrent: 100,
      equipment: { weapon: null, head: null, chest: null, legs: null, accessory: null },
      specId: null,
      specChanges: 0,
    },
    jobs: { woodcutting: { level: 3, xp: 0 }, mining: { level: 1, xp: 0 } },
    activity: { jobId: "woodcutting", actionId: "chop_oak", cycleStart: Date.now() },
    inventory: { resources: {}, equipment: [] },
    gold: 0,
    counters: { kills: 0, bossKills: 0, crafted: 0, harvested: 0 },
    flags: {},
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(v3));
  const loaded = load();
  assert.ok(loaded);
  assert.equal(loaded.version, SAVE_VERSION);
  assert.equal(loaded.activity.tierId, "chop_oak");
  assert.equal(loaded.activity.auto, true);
  assert.equal(loaded.activity.actionId, undefined, "l'ancien champ actionId doit être retiré");
});

test("une sauvegarde corrompue ne casse pas et n'écrase pas l'original", () => {
  resetSave();
  localStorage.setItem(SAVE_KEY, "{ ceci n'est pas du JSON valide");
  const loaded = load();
  assert.equal(loaded, null, "le chargement échoue proprement (null)");
  // L'original est toujours là (non écrasé) : on peut tenter une récupération.
  assert.equal(localStorage.getItem(SAVE_KEY), "{ ceci n'est pas du JSON valide");
});
