// Tests Lot 9 — QA de robustesse (instr. 338, 345-347) : démarrage d'une nouvelle
// partie pour chaque voie, combat complet sans NaN ni exception, combat mobilisant
// Garde, esquive, critique, élément et familier.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { startCombat, resolveRound } from "../js/systems/combat.js";
import { withSeed } from "./helpers.js";

const CLASSES = ["warrior", "guardian", "archer", "mage", "assassin"];

function ready(cls, lvl = 12) {
  const s = newGame("QA", cls);
  s.character.level = lvl;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

test("nouvelle partie : les 5 voies produisent des stats dérivées finies et valides", () => {
  for (const cls of CLASSES) {
    const ds = getDerivedStats(ready(cls, 20));
    for (const k of Object.keys(ds)) {
      assert.ok(Number.isFinite(ds[k]), `${cls}.${k} fini`);
      assert.ok(ds[k] >= 0, `${cls}.${k} >= 0`);
    }
  }
});

test("combat complet pour chaque voie : se résout, PV toujours finis (aucun NaN)", () => {
  for (const cls of CLASSES) {
    withSeed(17, () => {
      const s = ready(cls, 12);
      const c = startCombat(s, "shale_golem", { forceEnrage: false });
      let guard = 0;
      while (c.status === "active" && guard < 500) {
        const sk = c.player.skills.find((id) => (c.player.cooldowns[id] || 0) <= 0) || "basic_attack";
        resolveRound(s, c, sk);
        assert.ok(Number.isFinite(c.player.hp), `${cls} : PV joueur finis`);
        assert.ok(Number.isFinite(c.enemy.hp), `${cls} : PV ennemi finis`);
        guard++;
      }
      assert.notEqual(c.status, "active", `${cls} : le combat se termine`);
    });
  }
});

test("combat mobilisant Garde + élément + familier : pas d'erreur, valeurs finies", () => {
  withSeed(9, () => {
    const s = ready("guardian", 14); // démarre Garde active
    s.familiars = { owned: { ember_sprite: { level: 14, xp: 0, link: 3 } }, eggs: {}, equipped: "ember_sprite", essence: 0 };
    const c = startCombat(s, "ignar_emberheart", { forceEnrage: false }); // boss à élément Feu
    assert.ok(c.player.guardActive, "Garde active au départ (Gardien)");
    assert.ok(c.player.familiar && c.player.familiar.id === "ember_sprite", "familier attaché");
    let guard = 0;
    while (c.status === "active" && guard < 600) {
      const sk = c.player.skills.find((id) => (c.player.cooldowns[id] || 0) <= 0) || "basic_attack";
      resolveRound(s, c, sk);
      assert.ok(Number.isFinite(c.player.hp) && Number.isFinite(c.player.guardPool), "valeurs finies");
      guard++;
    }
    assert.notEqual(c.status, "active", "le combat se résout");
  });
});

test("le journal de combat ne contient jamais « NaN » ni « undefined »", () => {
  withSeed(3, () => {
    const s = ready("mage", 13);
    s.character.specId = "mage_pyromancer";
    const c = startCombat(s, "vorrak_collapse", { forceEnrage: false });
    let guard = 0;
    while (c.status === "active" && guard < 500) {
      const sk = c.player.skills.find((id) => (c.player.cooldowns[id] || 0) <= 0) || "basic_attack";
      resolveRound(s, c, sk);
      guard++;
    }
    for (const l of c.log) {
      assert.ok(!/NaN|undefined/.test(l.text), `entrée de journal saine : « ${l.text} »`);
    }
  });
});
