// Tests de la Garde-réserve (Lot 3) : activation, absorption, rupture, restauration,
// conversion en dégâts, expiration — et vérification que l'axe magique (Magie /
// Résistance) inflige des dégâts RÉELS (régression NaN corrigée).

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import {
  startCombat, resolveRound,
  guardAbsorb, guardMaxFor, clampAbsorb,
  GUARD_ABSORB_MIN, GUARD_ABSORB_MAX,
} from "../js/systems/combat.js";
import { withSeed } from "./helpers.js";

function ready(cls, lvl = 8) {
  const s = newGame("G", cls);
  s.character.level = lvl;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

// --- Absorption pure (instr. 73-77) ------------------------------------------

test("Garde : absorbe une part des dégâts, le reste va aux PV", () => {
  const r = guardAbsorb({ absorb: 0.35 }, 50, 100);
  assert.equal(r.toGuard, 35, "35 % de 100 absorbés");
  assert.equal(r.remaining, 65, "le reste (65) ira aux PV");
  assert.equal(r.pool, 15, "la réserve perd la part absorbée");
  assert.equal(r.broken, false);
});

test("Garde : l'absorption est bornée 35 %..80 % (instr. 74-75)", () => {
  assert.equal(clampAbsorb(0.95), GUARD_ABSORB_MAX, "plafonnée à 80 %");
  assert.equal(clampAbsorb(0.1), GUARD_ABSORB_MIN, "plancher à 35 %");
  // Une Garde à 95 % d'absorption n'encaisse en réalité que 80 % des dégâts.
  assert.equal(guardAbsorb({ absorb: 0.95 }, 1000, 100).toGuard, 80);
});

test("Garde : réserve épuisée -> rupture (instr. 76-77)", () => {
  const r = guardAbsorb({ absorb: 0.5 }, 10, 100);
  assert.equal(r.toGuard, 10, "ne peut absorber plus que la réserve");
  assert.equal(r.pool, 0);
  assert.equal(r.broken, true, "la Garde se brise quand la réserve atteint 0");
});

test("Garde : pas de réserve / pas de Garde active -> rien n'est absorbé", () => {
  assert.equal(guardAbsorb(null, 50, 100).toGuard, 0);
  assert.equal(guardAbsorb({ absorb: 0.4 }, 0, 100).toGuard, 0);
});

// --- Réserve maximale selon la classe (instr. 71) ----------------------------

test("Garde max : le Gardien en a beaucoup plus que le Mage", () => {
  assert.ok(guardMaxFor("guardian", 20, 30) > guardMaxFor("mage", 20, 5) * 2,
    "le Gardien a une réserve bien supérieure");
  assert.ok(guardMaxFor("guardian", 30, 40) > guardMaxFor("guardian", 10, 20),
    "la réserve croît avec le niveau");
});

// --- Activation (instr. 79-80) -----------------------------------------------

test("Garde : le Gardien commence le combat avec la Garde active (instr. 79)", () => {
  const c = startCombat(ready("guardian", 8), "feral_wolf", { forceEnrage: false });
  assert.ok(c.player.guardActive, "Garde active dès le départ");
  assert.ok(c.player.guardActive.turns >= 1);
  assert.ok(c.player.guardPool > 0 && c.player.guardMax > 0);
});

test("Garde : l'action Défendre l'active et restaure de la Garde (instr. 78)", () => {
  const s = ready("warrior", 10);
  const c = startCombat(s, "feral_wolf", { forceEnrage: false });
  // On isole l'action du joueur : l'ennemi ne joue pas ce tour (nextAt très grand).
  c.player.guardActive = null;
  c.player.guardPool = 0;
  c.enemy.nextAt = 9999;
  c.player.nextAt = 0;
  resolveRound(s, c, "defend");
  assert.ok(c.player.guardActive, "Défendre lève la Garde");
  assert.equal(c.player.guardPool, Math.round(c.player.guardMax * 0.2), "Défendre restaure 20 % de la réserve");
});

// --- Conversion en dégâts (instr. 83) ----------------------------------------

test("Garde : conversion consomme une part RÉELLE de la réserve pour des dégâts", () => {
  const s = ready("guardian", 12);
  const c = startCombat(s, "shale_golem", { forceEnrage: false });
  c.player.skills.push("guard_breaker"); // outil de conversion (data/skills.js)
  if (c.player.res) c.player.res.cur = c.player.res.max; // couvrir le coût en ressource
  c.player.guardPool = c.player.guardMax;
  c.enemy.nextAt = 9999;
  c.player.nextAt = 0;
  const before = c.enemy.hp;
  const poolBefore = c.player.guardPool;
  resolveRound(s, c, "guard_breaker");
  assert.ok(c.player.guardPool < poolBefore, "la conversion dépense réellement de la Garde");
  assert.ok(c.enemy.hp < before, "la conversion inflige des dégâts supplémentaires");
});

// --- Expiration (instr. 77) --------------------------------------------------

test("Garde : la Garde active expire après ses tours", () => {
  const s = ready("warrior", 10);
  // Ennemi à PV élevés : l'attaque du joueur ne le tue pas -> l'entretien (upkeep)
  // s'exécute bien et décrémente la durée de la Garde active.
  const c = startCombat(s, "shale_golem", { forceEnrage: false });
  c.player.guardActive = { turns: 1, absorb: 0.4 };
  c.enemy.nextAt = 9999;
  c.player.nextAt = 0;
  resolveRound(s, c, "basic_attack"); // un tour passe -> upkeep décrémente
  assert.equal(c.player.guardActive, null, "la Garde active s'éteint à l'expiration");
});

// --- Régression : l'axe magique inflige des dégâts FINIS (pas NaN) -----------

test("magie : une compétence à élément inflige des dégâts finis (régression NaN)", () => {
  withSeed(5, () => {
    const s = ready("mage", 14);
    s.character.specId = "mage_pyromancer"; // accorde fireball (élément Feu)
    const c = startCombat(s, "shale_golem", { forceEnrage: false });
    const before = c.enemy.hp;
    resolveRound(s, c, "fireball");
    assert.ok(Number.isFinite(c.enemy.hp), "les PV de l'ennemi restent un nombre fini");
    assert.ok(c.enemy.hp < before, "le sort élémentaire inflige de vrais dégâts");
    assert.ok(Number.isFinite(c.player.hp), "les PV du joueur restent finis après riposte");
  });
});
