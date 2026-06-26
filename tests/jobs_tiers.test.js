// Tests de l'activité principale évolutive (paliers) et de l'efficacité hors-ligne.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { startActivity, processActivity, OFFLINE_EFFICIENCY } from "../js/systems/jobs.js";
import { bestTier, unlockedTiers, nextTier, getJobTier } from "../js/data/jobs.js";

test("bestTier suit le niveau du métier", () => {
  assert.equal(bestTier("woodcutting", 1).id, "chop_soft");
  assert.equal(bestTier("woodcutting", 2).id, "chop_soft");
  assert.equal(bestTier("woodcutting", 3).id, "chop_oak");
  assert.equal(bestTier("mining", 1).id, "mine_copper");
  assert.equal(bestTier("mining", 5).id, "mine_iron");
});

test("unlockedTiers liste du meilleur au moindre", () => {
  const ut = unlockedTiers("woodcutting", 5);
  assert.equal(ut.length, 2);
  assert.equal(ut[0].id, "chop_oak");
  assert.equal(ut[1].id, "chop_soft");
});

test("nextTier annonce le prochain palier verrouillé", () => {
  assert.equal(nextTier("woodcutting", 1).id, "chop_oak");
  assert.equal(nextTier("woodcutting", 3), null); // tout débloqué
});

test("démarrer en auto choisit le meilleur palier maîtrisé", () => {
  const s = newGame("Auto", "warrior");
  s.jobs.woodcutting.level = 3;
  const r = startActivity(s, "woodcutting"); // pas de tier -> auto/meilleur
  assert.equal(r.ok, true);
  assert.equal(s.activity.tierId, "chop_oak");
  assert.equal(s.activity.auto, true);
});

test("choisir un palier précis bascule en mode manuel", () => {
  const s = newGame("Manuel", "warrior");
  s.jobs.woodcutting.level = 5;
  const r = startActivity(s, "woodcutting", "chop_soft", false);
  assert.equal(r.ok, true);
  assert.equal(s.activity.tierId, "chop_soft");
  assert.equal(s.activity.auto, false);
});

test("en mode auto, l'activité évolue de palier quand le métier monte", () => {
  const s = newGame("Evo", "warrior");
  s.jobs.woodcutting.level = 2;
  startActivity(s, "woodcutting"); // auto -> chop_soft (best à niv 2)
  assert.equal(s.activity.tierId, "chop_soft");
  // Le métier atteint le niveau 3 (par une autre source) : le prochain cycle
  // complété doit faire évoluer l'activité principale vers le chêne.
  s.jobs.woodcutting.level = 3;
  const tier = getJobTier("woodcutting", "chop_soft");
  s.activity.cycleStart = Date.now() - tier.durationMs;
  const agg = processActivity(s, Date.now());
  assert.ok(agg.evolved, "un changement de palier aurait dû survenir");
  assert.equal(agg.evolved.id, "chop_oak");
  assert.equal(s.activity.tierId, "chop_oak");
});

test("en mode manuel, l'activité n'évolue pas automatiquement", () => {
  const s = newGame("Fixe", "warrior");
  s.jobs.woodcutting.level = 5; // chop_oak débloqué, mais on reste sur chop_soft
  startActivity(s, "woodcutting", "chop_soft", false);
  const tier = getJobTier("woodcutting", "chop_soft");
  s.activity.cycleStart = Date.now() - tier.durationMs;
  const agg = processActivity(s, Date.now());
  assert.equal(agg.evolved, null);
  assert.equal(s.activity.tierId, "chop_soft");
});

test("l'efficacité hors-ligne réduit l'XP et le butin par rapport à l'actif", () => {
  const tier = getJobTier("woodcutting", "chop_soft");
  const runOnce = (efficiency) => {
    const s = newGame("Eff", "warrior");
    startActivity(s, "woodcutting", "chop_soft", false);
    s.activity.cycleStart = Date.now() - tier.durationMs;
    return processActivity(s, Date.now(), Infinity, efficiency);
  };
  const active = runOnce(1);
  const offline = runOnce(OFFLINE_EFFICIENCY);
  assert.ok(offline.xp < active.xp, `XP hors-ligne (${offline.xp}) doit être < actif (${active.xp})`);
  assert.ok(OFFLINE_EFFICIENCY < 1 && OFFLINE_EFFICIENCY >= 0.6, "efficacité hors-ligne dans la fourchette voulue");
});
