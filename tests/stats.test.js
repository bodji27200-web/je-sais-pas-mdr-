// Tests de lisibilité des stats, de la Vitesse (recharge) et de l'ordre des tours.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, addEquipmentInstance } from "../js/core/state.js";
import { getDerivedStats, getStatDetails, equip } from "../js/core/character.js";
import { makeInstance } from "../js/core/items.js";
import { startCombat, resolveRound, forecastTurns, cdFactor, CD_MIN_FACTOR } from "../js/systems/combat.js";

test("getStatDetails : base + équipement + bonus = total (exact)", () => {
  const s = newGame("Détail", "warrior");
  s.character.level = 5;
  const det = getStatDetails(s);
  for (const k of Object.keys(det)) {
    const d = det[k];
    assert.equal(d.base + d.equip + d.bonus, d.total, `la décomposition de ${k} doit sommer au total`);
  }
});

test("getStatDetails : l'équipement se reflète dans la composante 'équip'", () => {
  const s = newGame("Équip", "warrior");
  s.character.level = 5;
  const before = getStatDetails(s).atk.equip;
  const inst = makeInstance("iron_sword", "common"); // +ATK
  addEquipmentInstance(inst);
  equip(s, inst.uid);
  const after = getStatDetails(s).atk.equip;
  assert.ok(after > before, "l'attaque d'équipement doit augmenter après avoir équipé une épée");
});

test("cdFactor est plafonné (réduction de recharge max 20 %)", () => {
  assert.equal(cdFactor(10), 1, "à la vitesse de référence, aucune réduction");
  assert.ok(cdFactor(18) < 1, "au-dessus de la référence, la recharge est réduite");
  assert.equal(cdFactor(1000), CD_MIN_FACTOR, "la réduction est plafonnée à 20 %");
  assert.ok(cdFactor(1000) >= 0.8);
});

test("forecastTurns renvoie un ordre non vide pendant un combat actif", () => {
  const s = newGame("Init", "assassin"); // rapide
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const c = startCombat(s, "feral_wolf");
  const order = forecastTurns(c, 6);
  assert.equal(order.length, 6);
  assert.ok(order.every((x) => x === "player" || x === "enemy"));
});

test("un combattant plus rapide apparaît plus souvent dans l'aperçu", () => {
  const s = newGame("Rapide", "assassin"); // spd élevé
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const c = startCombat(s, "wild_boar"); // sanglier lent (spd 9)
  const order = forecastTurns(c, 8);
  const you = order.filter((x) => x === "player").length;
  const foe = order.filter((x) => x === "enemy").length;
  assert.ok(you >= foe, `le héros rapide doit agir au moins aussi souvent (${you} vs ${foe})`);
});
