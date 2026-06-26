// Tests des éléments, états, résistances et bestiaire.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { startCombat, resolveRound } from "../js/systems/combat.js";
import { ELEMENTS } from "../js/data/elements.js";
import { STATES } from "../js/data/states.js";
import { ENEMIES } from "../js/data/enemies.js";
import { withSeed } from "./helpers.js";

// Mage pyromancien (la spé accorde la Boule de feu : élément Feu, inflige Brûlure).
function fireMage() {
  const s = newGame("Pyro", "mage");
  s.character.level = 12;
  s.character.specId = "mage_pyromancer";
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

test("données : résistances d'ennemis et états réfèrent des éléments valides", () => {
  for (const e of Object.values(ENEMIES)) {
    for (const el of Object.keys(e.resist || {})) {
      assert.ok(ELEMENTS[el], `ennemi ${e.id}: élément de résistance inconnu ${el}`);
    }
  }
  for (const st of Object.values(STATES)) {
    if (st.element) assert.ok(ELEMENTS[st.element], `état ${st.id}: élément inconnu ${st.element}`);
    for (const el of Object.keys(st.vuln || {})) assert.ok(ELEMENTS[el], `état ${st.id}: vuln élément ${el}`);
  }
});

test("chaque ennemi possède au moins une résistance ou une faiblesse", () => {
  for (const e of Object.values(ENEMIES)) {
    assert.ok(Object.keys(e.resist || {}).length > 0, `ennemi ${e.id} devrait avoir une particularité élémentaire`);
  }
});

test("une compétence de Feu inflige l'état Brûlure", () => {
  withSeed(11, () => {
    const s = fireMage();
    const c = startCombat(s, "feral_wolf");
    c.enemy.hp = c.enemy.maxHp = 5000; // empêche la mort, on observe l'état
    resolveRound(s, c, "fireball");
    assert.ok(c.enemy.states.some((st) => st.id === "burn"), "la Brûlure doit être appliquée");
  });
});

test("la résistance élémentaire module réellement les dégâts", () => {
  const dmgWith = (factor) =>
    withSeed(77, () => {
      const s = fireMage();
      const c = startCombat(s, "feral_wolf");
      c.enemy.maxHp = c.enemy.hp = 100000;
      c.enemy.def = 0;
      c.enemy.resist = { fire: factor };
      const before = c.enemy.hp;
      resolveRound(s, c, "fireball");
      return before - c.enemy.hp;
    });
  const weak = dmgWith(2.0); // très vulnérable
  const resistant = dmgWith(0.5); // très résistant
  assert.ok(weak > resistant, `vulnérable (${weak}) doit subir plus que résistant (${resistant})`);
});

test("le bestiaire enregistre la rencontre puis révèle les résistances après combat", () => {
  withSeed(3, () => {
    const s = fireMage();
    assert.equal(s.bestiary.feral_wolf, undefined);
    const c = startCombat(s, "feral_wolf");
    assert.equal(s.bestiary.feral_wolf.seen, true);
    assert.equal(s.bestiary.feral_wolf.resistKnown, false, "résistances cachées avant la fin du combat");
    let g = 0;
    while (c.status === "active" && g < 300) {
      const sk = c.player.skills.find((id) => (c.player.cooldowns[id] || 0) <= 0) || "basic_attack";
      resolveRound(s, c, sk);
      g++;
    }
    assert.equal(s.bestiary.feral_wolf.resistKnown, true, "résistances révélées après une tentative");
  });
});

test("l'état Trempé augmente les dégâts de Foudre subis (vuln data)", () => {
  assert.ok(STATES.wet.vuln.lightning > 0, "Trempé doit augmenter les dégâts de Foudre");
  assert.ok(STATES.wet.vuln.fire < 0, "Trempé doit réduire les dégâts de Feu");
});
