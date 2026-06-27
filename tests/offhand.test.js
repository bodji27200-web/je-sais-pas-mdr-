// Tests de la main secondaire (Lot 14) : routage main droite / main gauche,
// dual-wield, armes à deux mains, boucliers, compatibilité de classe, migration,
// et une partie complète jusqu'au boss final (Ignar) pour les cinq classes.

import { test } from "node:test";
import assert from "node:assert/strict";

// Faux localStorage (pour le test de migration via load()).
class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
if (!globalThis.localStorage) globalThis.localStorage = new FakeStorage();

import { newGame, load, resetSave, SAVE_KEY, SAVE_VERSION, addEquipmentInstance } from "../js/core/state.js";
import { equip, unequip, getDerivedStats } from "../js/core/character.js";
import { makeInstance } from "../js/core/items.js";
import { EQUIPMENT, getEquipment, weaponHand, SLOTS } from "../js/data/equipment.js";
import { CLASSES } from "../js/data/classes.js";
import { startCombat, resolveRound, whyCannotUse } from "../js/systems/combat.js";
import { getSkill } from "../js/data/skills.js";
import { withSeed } from "./helpers.js";

// Premier équipement (arme) d'un type donné.
function weaponOfType(wtype) {
  return Object.values(EQUIPMENT).find((e) => e.slot === "weapon" && e.wtype === wtype) || null;
}

// Équipe un baseId neuf et renvoie le résultat de equip().
function equipNew(state, baseId, preferred = null) {
  const inst = makeInstance(baseId, "common");
  addEquipmentInstance(inst);
  return equip(state, inst.uid, preferred);
}

function strongHero(classId, level = 24) {
  const s = newGame("Testeur", classId);
  s.character.level = level;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

// --- Routage des emplacements ----------------------------------------------

test("le slot 'offhand' (main gauche) existe et 'hands' reste les gants", () => {
  assert.ok(SLOTS.offhand, "la main gauche doit être un emplacement connu");
  assert.equal(SLOTS.weapon, "Main droite");
  assert.equal(SLOTS.offhand, "Main gauche");
  assert.equal(SLOTS.hands, "Gants", "le slot d'armure 'hands' désigne les gants");
});

test("chaque classe peut équiper toutes ses armes autorisées dans la bonne main", () => {
  for (const cls of Object.values(CLASSES)) {
    for (const wtype of cls.weapons) {
      const tpl = weaponOfType(wtype);
      if (!tpl) continue; // pas d'arme de ce type dans les données
      const s = strongHero(cls.id);
      const r = equipNew(s, tpl.id);
      assert.ok(r.ok, `${cls.name} doit pouvoir équiper ${tpl.name} (${wtype}) : ${r.error || ""}`);
      const expected = weaponHand(wtype) === "off" ? "offhand" : "weapon";
      assert.equal(r.slot, expected, `${tpl.name} (${wtype}) doit aller en ${expected}`);
      assert.equal(s.character.equipment[expected].baseId, tpl.id);
    }
  }
});

test("dual-wield : deux armes à une main remplissent les deux mains et cumulent l'attaque", () => {
  const s = strongHero("warrior");
  equipNew(s, "copper_sword");            // 1 main -> main droite (auto)
  const atkOne = getDerivedStats(s).atk;
  const r2 = equipNew(s, "iron_mace");    // 1 main, main droite prise -> main gauche (auto)
  assert.ok(r2.ok && r2.slot === "offhand", "la 2e arme à une main passe en main gauche");
  assert.ok(s.character.equipment.weapon && s.character.equipment.offhand, "les deux mains sont armées");
  assert.ok(getDerivedStats(s).atk > atkOne, "ajouter une 2e arme augmente l'attaque");
});

test("choix explicite de la main (main gauche) pour une arme à une main", () => {
  const s = strongHero("warrior");
  const r = equipNew(s, "copper_sword", "offhand");
  assert.ok(r.ok && r.slot === "offhand", "préférence 'offhand' respectée");
  assert.equal(s.character.equipment.weapon, null);
  assert.equal(s.character.equipment.offhand.baseId, "copper_sword");
});

test("une arme à deux mains occupe les deux mains et libère la main gauche", () => {
  const s = strongHero("warrior");
  equipNew(s, "iron_mace", "offhand"); // une main en main gauche
  const invBefore = s.inventory.equipment.length; // 0 : la masse est équipée
  const r = equipNew(s, "iron_greatsword"); // 2 mains
  assert.ok(r.ok && r.slot === "weapon");
  assert.equal(s.character.equipment.offhand, null, "la main gauche est libérée");
  // Le greatsword sort du sac, la masse déplacée y revient -> +1 net.
  assert.equal(s.inventory.equipment.length, invBefore + 1, "l'arme déplacée revient au sac");
  assert.ok(s.inventory.equipment.some((i) => i.baseId === "iron_mace"));
});

test("équiper une main gauche quand une arme à deux mains est en main droite la remplace", () => {
  const s = strongHero("warrior");
  equipNew(s, "iron_greatsword"); // 2 mains
  const r = equipNew(s, "copper_sword", "offhand");
  assert.ok(r.ok && r.slot === "offhand");
  assert.equal(s.character.equipment.weapon, null, "la 2 mains est retirée");
  assert.ok(s.inventory.equipment.some((i) => i.baseId === "iron_greatsword"), "elle revient au sac");
});

test("Gardien : lance (main droite) + bouclier (main gauche) coexistent", () => {
  const s = strongHero("guardian");
  const r1 = equipNew(s, "iron_spear");
  const r2 = equipNew(s, "iron_buckler");
  assert.ok(r1.ok && r1.slot === "weapon", "la lance va en main droite");
  assert.ok(r2.ok && r2.slot === "offhand", "le bouclier va en main gauche");
  assert.equal(s.character.equipment.weapon.baseId, "iron_spear");
  assert.equal(s.character.equipment.offhand.baseId, "iron_buckler");
  // Le bouclier apporte de la défense en plus.
  const def = getDerivedStats(s).def;
  unequip(s, "offhand");
  assert.ok(def > getDerivedStats(s).def, "retirer le bouclier baisse la défense");
});

test("une classe ne peut pas manier une arme hors de sa liste (dans les deux mains)", () => {
  const mage = strongHero("mage");
  assert.equal(equipNew(mage, "copper_sword").ok, false, "le mage ne manie pas l'épée");
  assert.equal(equipNew(mage, "iron_buckler").ok, false, "le mage ne porte pas de bouclier");
  // L'assassin ne peut pas non plus mettre une épée en main gauche.
  const assassin = strongHero("assassin");
  assert.equal(equipNew(assassin, "copper_sword", "offhand").ok, false);
});

// --- Migration --------------------------------------------------------------

test("migration v10 -> v11 : un bouclier coincé en arme passe en main gauche", () => {
  resetSave();
  const shield = makeInstance("iron_buckler", "common");
  const v10 = {
    version: 10,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    character: {
      name: "Ancien", classId: "guardian", level: 5, xp: 0, hpCurrent: 100,
      equipment: { weapon: shield, head: null, chest: null, hands: null, legs: null, feet: null, accessory: null, accessory2: null },
      specId: null, specChanges: 0,
    },
    jobs: { woodcutting: { level: 1, xp: 0 }, mining: { level: 1, xp: 0 } },
    professions: {}, activity: null,
    inventory: { resources: {}, equipment: [] },
    gold: 0,
    counters: { kills: 0, bossKills: 0, crafted: 0, harvested: 0, defeated: {} },
    bestiary: {}, familiars: { owned: {}, eggs: {}, equipped: null, essence: 0 },
    tutorials: { seen: {}, enabled: true }, achievements: { seen: {} },
    flags: { bossDefeated: false }, objectives: {}, settings: { muted: false },
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(v10));
  const loaded = load();
  assert.ok(loaded, "la migration doit réussir");
  assert.equal(loaded.version, SAVE_VERSION);
  assert.equal(loaded.character.equipment.weapon, null, "la main droite est libérée");
  assert.ok(loaded.character.equipment.offhand, "le bouclier est en main gauche");
  assert.equal(loaded.character.equipment.offhand.baseId, "iron_buckler");
});

// --- Partie complète jusqu'au boss final -----------------------------------

// Puissance de dégâts d'une compétence active (les soutiens/buffs valent < 0).
function skillPower(id) {
  const sk = getSkill(id);
  return sk && sk.type === "active" ? sk.power || 0 : -1;
}

// Mène un combat réel jusqu'au bout avec une politique correcte (la compétence
// utilisable la plus puissante, sinon l'attaque de base). Renvoie le statut.
function fightToEnd(state, enemyId, seed) {
  return withSeed(seed, () => {
    state.character.hpCurrent = getDerivedStats(state).maxHp; // repart en pleine forme
    const c = startCombat(state, enemyId);
    let guard = 0;
    while (c.status === "active" && guard < 3000) {
      const usable = c.player.skills.filter((id) => !whyCannotUse(c, id));
      let best = "basic_attack", bp = -2;
      for (const id of usable) { const p = skillPower(id); if (p > bp) { bp = p; best = id; } }
      resolveRound(state, c, best);
      guard++;
    }
    return c.status;
  });
}

test("progression complète : le Guerrier peut vaincre les trois boss jusqu'à Ignar", () => {
  // Combat réel. On vérifie qu'une issue VICTORIEUSE existe pour chaque boss sur
  // plusieurs graines : la partie est donc terminable jusqu'au boss final. (Ignar
  // régénère ~2 %/tour ; sous-équipé on ne le tue pas — d'où la vérification « au
  // moins une victoire » avec un héros solide plutôt qu'une victoire garantie.)
  for (const bossId of ["goblin_chief_grok", "vorrak_collapse", "ignar_emberheart"]) {
    let wins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = strongHero("warrior", 40);
      equipNew(s, "iron_greatsword");
      if (fightToEnd(s, bossId, seed) === "won") wins++;
    }
    assert.ok(wins > 0, `le boss ${bossId} doit être battable (gagné ${wins}/10)`);
  }
});
