// Tests des instances d'objets et de la distribution des raretés.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeInstance, rollRarity, effectiveStats, enemyLuck } from "../js/core/items.js";
import { RARITY_ORDER, getRarity } from "../js/data/rarities.js";
import { withSeed } from "./helpers.js";

test("makeInstance produit une instance valide avec stats >= base", () => {
  const inst = makeInstance("iron_sword", "common");
  assert.ok(inst.uid);
  assert.equal(inst.baseId, "iron_sword");
  assert.equal(inst.rarity, "common");
  assert.equal(inst.lvl, 0);
  assert.ok(inst.stats.atk >= 1);
});

test("rollRarity sans chance : majorité de communs, distribution plausible", () => {
  const counts = {};
  const N = 50000;
  withSeed(12345, () => {
    for (let i = 0; i < N; i++) {
      const r = rollRarity(0);
      counts[r] = (counts[r] || 0) + 1;
    }
  });
  // Tous les crans existent dans le résultat OU sont très rares ; le commun domine.
  const commonShare = (counts.common || 0) / N;
  assert.ok(commonShare > 0.55 && commonShare < 0.75, `part de communs inattendue : ${commonShare}`);
  // L'ordre des fréquences décroît du commun vers le légendaire (monotone).
  let prev = Infinity;
  for (const r of RARITY_ORDER) {
    const share = (counts[r.id] || 0) / N;
    assert.ok(share <= prev + 0.001, `la rareté ${r.id} ne doit pas être plus fréquente que le cran inférieur`);
    prev = share;
  }
});

test("la chance (luck) augmente la part de raretés élevées", () => {
  const N = 40000;
  const high = (luck) => {
    let hi = 0;
    withSeed(999, () => {
      for (let i = 0; i < N; i++) {
        const r = rollRarity(luck);
        if (getRarity(r).rank >= 2) hi++;
      }
    });
    return hi / N;
  };
  const low = high(0);
  const boss = high(1.4);
  assert.ok(boss > low * 2, `un loot chanceux doit nettement augmenter les raretés (>=rare) : ${low} -> ${boss}`);
});

test("enemyLuck : un boss a une bien meilleure chance qu'un ennemi normal", () => {
  const normal = enemyLuck({ level: 3, isBoss: false });
  const boss = enemyLuck({ level: 6, isBoss: true });
  assert.ok(boss > normal * 2, `boss (${boss}) doit dépasser largement un ennemi normal (${normal})`);
});

test("effectiveStats applique le renforcement aux stats positives uniquement", () => {
  const inst = { baseId: "iron_greatsword", rarity: "common", stats: { atk: 20, spd: -3 }, lvl: 5 };
  const es = effectiveStats(inst);
  assert.ok(es.atk > 20, "l'attaque doit être renforcée");
  assert.equal(es.spd, -3, "le malus de vitesse ne doit jamais être aggravé par le renforcement");
});
