// Équilibrage d'Ignar (Lot 16.4). On ne règle pas le problème en gonflant les PV :
// on ajoute de la RÉSISTANCE magique, une AURA inévitable (Fournaise) et un PLAFOND
// d'encaissement par coup (anti one-shot). Conséquences VÉRIFIABLES et stables :
//  - aucune frappe isolée ne tue Ignar (plus de burst « 1 tour ») ;
//  - le héros subit forcément des dégâts pendant le combat -> no-hit EXCEPTIONNELS.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { startCombat, resolveRound } from "../js/systems/combat.js";
import { getEnemy } from "../js/data/enemies.js";
import { withSeed } from "./helpers.js";

function fresh() {
  const s = newGame("Ignar", "mage");
  s.character.level = 30;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

test("Ignar : Résistance magique, Aura et plafond d'encaissement sont définis", () => {
  const e = getEnemy("ignar_emberheart");
  assert.ok(e.stats.res >= 100, "vraie Résistance magique");
  assert.ok(e.aura && e.aura.pctMaxHp > 0, "aura inévitable (Fournaise)");
  assert.ok(e.hitCap > 0 && e.hitCap < 0.5, "plafond d'encaissement par coup (< 50 %)");
});

test("Ignar : aucune frappe ne le tue d'un coup (plafond d'encaissement)", () => {
  withSeed(7, () => {
    const s = fresh();
    const c = startCombat(s, "ignar_emberheart", { forceEnrage: false });
    // Attaque démesurée : sans plafond, Ignar mourrait instantanément.
    c.player.atk = 100000;
    const maxHp = c.enemy.maxHp;
    resolveRound(s, c, "arcane_bolt");
    // Même avec ≤ 2 actions joueur dans la manche, Ignar survit au burst d'ouverture.
    assert.ok(c.enemy.hp > 0, "Ignar survit à un burst d'ouverture (pas de one-shot)");
    assert.notEqual(c.status, "won");
    // La perte d'une seule manche reste bornée par le plafond (× nb d'actions).
    assert.ok(maxHp - c.enemy.hp <= Math.ceil(maxHp * c.enemy.hitCap) * 2 + 5, "perte bornée par le plafond");
  });
});

test("Ignar : un burst de mage n'aboutit pas à un no-hit (l'aura mord)", () => {
  withSeed(7, () => {
    const s = fresh();
    const c = startCombat(s, "ignar_emberheart", { forceEnrage: false });
    c.player.atk = 100000; // tue Ignar en quelques manches
    const hp0 = c.player.hp;
    let took = false, n = 0;
    while (c.status === "active" && n < 50) {
      const before = c.player.hp;
      resolveRound(s, c, "arcane_bolt");
      if (c.player.hp < before) took = true;
      n++;
    }
    assert.equal(c.status, "won", "Ignar finit par tomber");
    assert.ok(took || c.player.hp < hp0, "le héros a forcément subi des dégâts (aura) — no-hit exceptionnel");
  });
});

test("Ignar : reste un vrai mur (ne tombe pas en une seule manche, même fort)", () => {
  withSeed(123, () => {
    const s = fresh();
    s.character.level = 60;
    s.character.hpCurrent = getDerivedStats(s).maxHp;
    const c = startCombat(s, "ignar_emberheart", { forceEnrage: false });
    c.player.atk = 100000;
    resolveRound(s, c, "fireball");
    assert.ok(c.turn >= 2 || c.enemy.hp > 0, "le combat dépasse la première manche");
  });
});
