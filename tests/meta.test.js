// Tests du Lot 12 — succès, quêtes de découverte (récompenses), guides, migration.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { evaluateAchievements, checkNewAchievements, unlockedCount } from "../js/systems/achievements.js";
import { updateObjectives, ensureObjectives, objectiveHint, rewardLabel, QUESTS } from "../js/systems/objectives.js";
import { getGuide, GUIDES } from "../js/data/guides.js";
import { ACHIEVEMENTS } from "../js/data/achievements.js";

test("INTÉGRITÉ : chaque succès a un id, un nom, une catégorie et un check", () => {
  const ids = new Set();
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.id && !ids.has(a.id), `id unique : ${a.id}`);
    ids.add(a.id);
    assert.ok(a.name && a.cat && typeof a.check === "function");
  }
});

test("un succès se débloque quand sa condition est remplie", () => {
  const s = newGame("Hér", "warrior");
  let list = evaluateAchievements(s);
  assert.equal(list.find((a) => a.id === "first_blood").unlocked, false);
  s.counters.kills = 1;
  list = evaluateAchievements(s);
  assert.equal(list.find((a) => a.id === "first_blood").unlocked, true);
  assert.ok(unlockedCount(s) >= 1);
});

test("checkNewAchievements ne notifie qu'une seule fois", () => {
  const s = newGame("Hér", "warrior");
  s.counters.kills = 1;
  const first = checkNewAchievements(s);
  assert.ok(first.some((a) => a.id === "first_blood"), "notifié la 1re fois");
  const second = checkNewAchievements(s);
  assert.equal(second.some((a) => a.id === "first_blood"), false, "plus notifié ensuite");
});

test("une quête accomplie octroie sa récompense UNE fois (or)", () => {
  const s = newGame("Hér", "warrior");
  const goldBefore = s.gold;
  s.counters.kills = 1; // accomplit la quête firstKill (récompense or)
  const newly1 = updateObjectives(s);
  assert.ok(newly1.includes("firstKill"));
  const reward = QUESTS.find((q) => q.id === "firstKill").reward.gold;
  assert.equal(s.gold, goldBefore + reward, "récompense versée");
  const goldAfter = s.gold;
  updateObjectives(s); // re-vérif : pas de double versement
  assert.equal(s.gold, goldAfter, "pas de double récompense");
});

test("la quête d'arme adapte son indice à la classe", () => {
  const sMage = newGame("M", "mage");
  ensureObjectives(sMage);
  const hintMage = objectiveHint(sMage, "equipWeapon");
  assert.match(hintMage, /baguette|bâton|orbe/i, "indice adapté au Mage");
  const sArcher = newGame("A", "archer");
  const hintArcher = objectiveHint(sArcher, "equipWeapon");
  assert.match(hintArcher, /arc|arbalète/i, "indice adapté à l'Archer");
});

test("rewardLabel formate les récompenses", () => {
  assert.match(rewardLabel({ gold: 50 }), /50 or/);
  assert.match(rewardLabel({ essence: 3 }), /3.*Essence/);
});

test("les 4 guides existent et contiennent des explications", () => {
  for (const id of ["jobs", "craft", "combat", "familiars"]) {
    const g = getGuide(id);
    assert.ok(g, `guide ${id} existe`);
    assert.ok(g.lines.length >= 3, `${id} : au moins 3 explications`);
  }
  assert.equal(Object.keys(GUIDES).length, 4);
});

test("nouvelle partie : tutoriels + succès initialisés", () => {
  const s = newGame("Hér", "warrior");
  assert.ok(s.tutorials && s.tutorials.seen && s.tutorials.enabled === true);
  assert.ok(s.achievements && s.achievements.seen);
});
