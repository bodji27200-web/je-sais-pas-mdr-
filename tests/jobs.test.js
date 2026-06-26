// Tests du système de métiers : récolte, répétition de cycles, hors-ligne.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import {
  startActivity,
  stopActivity,
  processActivity,
  processOffline,
  activityRemainingMs,
  MAX_OFFLINE_MS,
} from "../js/systems/jobs.js";
import { getJobAction } from "../js/data/jobs.js";

function freshState() {
  return newGame("Testeur", "warrior");
}

test("startActivity refuse une action au-dessus du niveau requis", () => {
  const s = freshState();
  const r = startActivity(s, "woodcutting", "chop_oak"); // niveau 3 requis, joueur niv 1 métier
  assert.equal(r.ok, false);
  assert.ok(s.activity === null);
});

test("startActivity démarre une action disponible", () => {
  const s = freshState();
  const r = startActivity(s, "woodcutting", "chop_soft");
  assert.equal(r.ok, true);
  assert.equal(s.activity.jobId, "woodcutting");
});

test("processActivity octroie le butin d'un cycle écoulé", () => {
  const s = freshState();
  startActivity(s, "woodcutting", "chop_soft");
  const action = getJobAction("woodcutting", "chop_soft");
  // Avance le départ du cycle dans le passé d'exactement une durée.
  s.activity.cycleStart = Date.now() - action.durationMs;
  const agg = processActivity(s, Date.now());
  assert.ok(agg, "un cycle aurait dû se terminer");
  assert.equal(agg.cycles, 1);
  assert.ok((s.inventory.resources.soft_wood || 0) >= 1, "du bois tendre aurait dû être récolté");
  assert.equal(s.jobs.woodcutting.xp, action.xp);
});

test("processActivity respecte le plafond de cycles (cap)", () => {
  const s = freshState();
  startActivity(s, "woodcutting", "chop_soft");
  const action = getJobAction("woodcutting", "chop_soft");
  s.activity.cycleStart = Date.now() - action.durationMs * 100;
  const agg = processActivity(s, Date.now(), 5);
  assert.equal(agg.cycles, 5, "le cap de 5 cycles doit être respecté");
});

test("processOffline borne le rattrapage à MAX_OFFLINE_MS", () => {
  const s = freshState();
  startActivity(s, "woodcutting", "chop_soft");
  const action = getJobAction("woodcutting", "chop_soft");
  // Simule une absence de 48 h alors que le plafond est de 8 h.
  s.lastSeen = Date.now() - 48 * 60 * 60 * 1000;
  s.activity.cycleStart = s.lastSeen;
  const agg = processOffline(s);
  const maxPossible = Math.floor(MAX_OFFLINE_MS / action.durationMs) + 1;
  assert.ok(agg.cycles <= maxPossible, `cycles (${agg.cycles}) doivent rester sous le plafond (${maxPossible})`);
});

test("stopActivity arrête la récolte", () => {
  const s = freshState();
  startActivity(s, "woodcutting", "chop_soft");
  stopActivity(s);
  assert.equal(s.activity, null);
  assert.equal(activityRemainingMs(s), 0);
});
