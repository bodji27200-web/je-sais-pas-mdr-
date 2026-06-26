// Tests des courbes d'XP et de la montée de niveau.

import { test } from "node:test";
import assert from "node:assert/strict";
import { charXpToNext, jobXpToNext, applyXp } from "../js/core/progression.js";

test("charXpToNext croît strictement avec le niveau", () => {
  let prev = 0;
  for (let lvl = 1; lvl <= 100; lvl++) {
    const need = charXpToNext(lvl);
    assert.ok(Number.isFinite(need) && need > 0, `niveau ${lvl} doit être fini et positif`);
    assert.ok(need > prev, `niveau ${lvl} (${need}) doit demander plus que le précédent (${prev})`);
    prev = need;
  }
});

test("jobXpToNext croît strictement avec le niveau", () => {
  let prev = 0;
  for (let lvl = 1; lvl <= 100; lvl++) {
    const need = jobXpToNext(lvl);
    assert.ok(Number.isFinite(need) && need > 0);
    assert.ok(need > prev);
    prev = need;
  }
});

test("applyXp monte plusieurs niveaux d'un coup et conserve le reliquat", () => {
  const holder = { level: 1, xp: 0 };
  const need1 = jobXpToNext(1);
  const need2 = jobXpToNext(2);
  // Juste assez pour 2 niveaux + 5 d'XP résiduelle.
  const gained = applyXp(holder, need1 + need2 + 5, jobXpToNext);
  assert.equal(gained, 2);
  assert.equal(holder.level, 3);
  assert.equal(holder.xp, 5);
});

test("applyXp sans assez d'XP ne monte pas de niveau", () => {
  const holder = { level: 5, xp: 0 };
  const need = jobXpToNext(5);
  const gained = applyXp(holder, need - 1, jobXpToNext);
  assert.equal(gained, 0);
  assert.equal(holder.level, 5);
  assert.equal(holder.xp, need - 1);
});
