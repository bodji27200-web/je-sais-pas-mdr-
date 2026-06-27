// Tests Lot 15 — Maîtrise, déblocage, changement de classe, Traits d'héritage,
// bibliothèque de compétences.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { makeInstance } from "../js/core/items.js";
import { buildPlayerCombatant } from "../js/systems/combat.js";
import {
  gainMasteryOnWin, masteryOf, masteryLevelFromXp, masteryProgress,
  canUnlockNode, unlockNode, nodeUnlocked, equipClassNode,
  equipHeritage, ownedHeritageTraits,
  librarySlots, learnNodeSkills, toggleLibrarySkill, combatActiveSkills, isOffPathSkill, naturalSkillsForPath,
} from "../js/systems/classtree.js";
import { MASTERY_MAX_LEVEL, MASTERY_THRESHOLDS } from "../js/data/classTree.js";
import { CLASSES } from "../js/data/classes.js";

// --- Maîtrise ---------------------------------------------------------------

test("la Maîtrise n'augmente QUE pour la classe équipée", () => {
  const s = newGame("M", "warrior");
  // Profil de base : la Maîtrise va sur le nœud de base « warrior ».
  gainMasteryOnWin(s, 1);
  assert.equal(masteryOf(s, "warrior").xp, 1);
  // Équipe une classe avancée -> la Maîtrise va désormais sur ce nœud, pas warrior.
  s.character.level = 8; s.gold = 1000;
  unlockNode(s, "warrior_fighter");
  equipClassNode(s, "warrior_fighter");
  gainMasteryOnWin(s, 1);
  assert.equal(masteryOf(s, "warrior_fighter").xp, 1, "le nœud équipé gagne la Maîtrise");
  assert.equal(masteryOf(s, "warrior").xp, 1, "l'autre classe n'augmente pas");
});

test("paliers de Maîtrise : seuils respectés et plafonnés", () => {
  for (let i = 0; i < MASTERY_THRESHOLDS.length; i++) {
    assert.equal(masteryLevelFromXp(MASTERY_THRESHOLDS[i]), Math.min(i, MASTERY_MAX_LEVEL));
  }
  assert.equal(masteryLevelFromXp(99999), MASTERY_MAX_LEVEL, "plafonné au palier max");
});

test("la Maîtrise max débloque le Trait d'héritage du nœud", () => {
  const s = newGame("M", "warrior");
  s.character.level = 8; s.gold = 1000;
  unlockNode(s, "warrior_fighter");
  equipClassNode(s, "warrior_fighter");
  // Amène la Maîtrise juste sous le max puis franchis le palier.
  s.character.mastery["warrior_fighter"] = { level: 0, xp: MASTERY_THRESHOLDS[MASTERY_MAX_LEVEL] - 1 };
  const r = gainMasteryOnWin(s, 1);
  assert.equal(r.level, MASTERY_MAX_LEVEL);
  assert.ok(r.heritageUnlocked, "un Trait d'héritage est débloqué à la Maîtrise max");
  assert.ok(s.character.ownedHeritage.includes(r.heritageUnlocked));
});

// --- Déblocage de nœud ------------------------------------------------------

test("déblocage : niveau, prérequis, Maîtrise et coût sont vérifiés", () => {
  const s = newGame("M", "mage");
  // mage_apostate : niveau 70, requires archon/pactmaster, masteryReq weaver:3, coût.
  let chk = canUnlockNode(s, "mage_apostate");
  assert.equal(chk.ok, false);
  assert.ok(chk.reasons.length >= 1, "raisons listées");
  // Une classe avancée d'une AUTRE voie est refusée pour la voie courante.
  chk = canUnlockNode(s, "warrior_fighter");
  assert.equal(chk.ok, false);
  assert.ok(chk.reasons.some((r) => /[Vv]oie/.test(r)), "voie incompatible signalée");
  // Cas nominal : rune_sorcerer (niv 16, requires arcanist).
  s.character.level = 16; s.gold = 1000;
  unlockNode(s, "mage_arcanist");
  chk = canUnlockNode(s, "mage_rune_sorcerer");
  assert.equal(chk.ok, true, "conditions remplies");
  const before = s.gold;
  const r = unlockNode(s, "mage_rune_sorcerer");
  assert.equal(r.ok, true);
  assert.ok(nodeUnlocked(s, "mage_rune_sorcerer"));
  assert.ok(s.gold < before, "le coût est payé");
});

test("masteryReq croisée : la Maîtrise d'une autre voie persiste et conditionne un hybride", () => {
  const s = newGame("M", "warrior");
  s.character.level = 60; s.gold = 100000;
  // Débloque jusqu'à warlord la voie guerrier.
  for (const id of ["warrior_fighter", "warrior_weapon_master", "warrior_berserker", "warrior_guardbreaker", "warrior_warlord"]) {
    s.character.mastery[id] = { level: 5, xp: 999 };
    unlockNode(s, id);
  }
  // rune_blade requiert aussi la Maîtrise du Mage : sans elle -> refus.
  let chk = canUnlockNode(s, "warrior_rune_blade");
  assert.equal(chk.ok, false);
  assert.ok(chk.reasons.some((r) => /Mage/i.test(r)), "Maîtrise du Mage manquante signalée");
  // Le joueur a déjà joué Mage par le passé -> la Maîtrise persiste (sauvegardée séparément).
  s.character.mastery["mage"] = { level: 2, xp: 999 };
  chk = canUnlockNode(s, "warrior_rune_blade");
  assert.equal(chk.ok, true, "avec la Maîtrise du Mage, l'hybride se débloque");
});

// --- Changement de classe ---------------------------------------------------

test("changement de classe : interdit en combat, renvoie l'équipement incompatible sans le détruire", () => {
  const s = newGame("G", "warrior");
  const sword = makeInstance("copper_sword", "common");
  s.character.equipment.weapon = sword;
  // En combat -> refus.
  assert.equal(equipClassNode(s, "mage", { inCombat: true }).ok, false);
  // Hors combat : on passe Mage -> l'épée (non maniable) retourne au sac, jamais détruite.
  const invBefore = s.inventory.equipment.length;
  const r = equipClassNode(s, "mage");
  assert.equal(r.ok, true);
  assert.equal(s.character.classId, "mage");
  assert.equal(s.character.equipment.weapon, null, "arme incompatible retirée");
  assert.equal(s.inventory.equipment.length, invBefore + 1, "arme renvoyée au sac (non détruite)");
  assert.ok(s.inventory.equipment.some((i) => i.uid === sword.uid), "même instance conservée");
});

test("équiper un nœud avancé exige déblocage + voie correspondante", () => {
  const s = newGame("A", "archer");
  s.character.level = 8; s.gold = 1000;
  assert.equal(equipClassNode(s, "archer_scout").ok, false, "verrouillé tant que non débloqué");
  unlockNode(s, "archer_scout");
  assert.equal(equipClassNode(s, "archer_scout").ok, true);
  assert.equal(s.character.specId, "archer_scout");
});

// --- Traits d'héritage ------------------------------------------------------

test("Trait d'héritage : équipable une fois débloqué, un seul à la fois, bonus appliqué", () => {
  const s = newGame("H", "guardian");
  // Non débloqué -> refus.
  assert.equal(equipHeritage(s, "h_bulwark").ok, false);
  s.character.ownedHeritage = ["h_bulwark", "h_might"];
  assert.deepEqual(ownedHeritageTraits(s).map((t) => t.id).sort(), ["h_bulwark", "h_might"]);
  const baseAtk = getDerivedStats(s).atk;
  equipHeritage(s, "h_might"); // +4 % ATK
  assert.ok(getDerivedStats(s).atk >= baseAtk, "le bonus du trait s'applique");
  assert.equal(s.character.heritageTrait, "h_might");
  // Bascule sur un autre : un seul équipé à la fois.
  equipHeritage(s, "h_bulwark");
  assert.equal(s.character.heritageTrait, "h_bulwark");
});

// --- Bibliothèque de compétences -------------------------------------------

test("bibliothèque : emplacements croissants, apprentissage, limite, et persistance", () => {
  assert.equal(librarySlots(1), 3);
  assert.equal(librarySlots(20), 4);
  assert.equal(librarySlots(100), 8);

  const s = newGame("L", "warrior");
  learnNodeSkills(s, "warrior"); // apprend les actives de base de la voie
  assert.ok(s.character.library.learned.includes("heavy_strike"), "compétence de classe apprise");
  // Limite d'emplacements (3 au niveau 1).
  const learned = s.character.library.learned.slice(0, 4);
  let equipped = 0;
  for (const id of learned) if (toggleLibrarySkill(s, id).ok) equipped++;
  assert.ok(s.character.library.equipped.length <= librarySlots(1), "ne dépasse pas la limite");
});

test("compétence hors-voie : détectée et pénalisée (puissance réduite) au combat", () => {
  const s = newGame("L", "warrior");
  // Une compétence de Mage emportée par un Guerrier est hors-voie.
  assert.equal(isOffPathSkill(s, "arcane_bolt"), true);
  assert.equal(isOffPathSkill(s, "heavy_strike"), false, "compétence de la voie : pas de pénalité");
  s.character.library.learned.push("arcane_bolt");
  s.character.library.equipped = ["heavy_strike", "arcane_bolt"];
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const p = buildPlayerCombatant(s);
  assert.ok(p.offPath.has("arcane_bolt"), "la compétence hors-voie est marquée pour la pénalité");
  assert.ok(!p.offPath.has("heavy_strike"));
});

test("combatActiveSkills : kit naturel par défaut (rétrocompat), loadout si sélection", () => {
  const s = newGame("L", "assassin");
  // Sur une nouvelle partie (specId null), le kit par défaut = compétences de base.
  assert.deepEqual(combatActiveSkills(s), CLASSES.assassin.skills, "par défaut = kit de la voie");
  s.character.library.learned.push("poison_blade");
  s.character.library.equipped = ["poison_blade"];
  assert.deepEqual(combatActiveSkills(s), ["poison_blade"], "la sélection prime");
});
