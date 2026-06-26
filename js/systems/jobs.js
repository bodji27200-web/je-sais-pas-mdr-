// Système de métiers idle : une activité de récolte chronométrée à la fois,
// avec répétition automatique et rattrapage hors-ligne.

import { getJob, getJobAction } from "../data/jobs.js";
import { addResource } from "../core/state.js";
import { applyXp, jobXpToNext, rollAmount } from "../core/progression.js";

// Plafond de rattrapage hors-ligne (8 h) : l'attente reste gratifiante sans devenir absurde.
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000;

// Lance une action de métier (remplace l'activité en cours).
export function startActivity(state, jobId, actionId) {
  const job = getJob(jobId);
  const action = getJobAction(jobId, actionId);
  if (!job || !action) return { ok: false, error: "Action inconnue." };
  if (state.jobs[jobId].level < action.levelReq)
    return { ok: false, error: `Niveau de métier ${action.levelReq} requis.` };

  state.activity = { jobId, actionId, cycleStart: Date.now() };
  return { ok: true };
}

export function stopActivity(state) {
  state.activity = null;
}

// Progression de l'action en cours sur [0,1].
export function activityProgress(state, now = Date.now()) {
  const act = state.activity;
  if (!act) return 0;
  const action = getJobAction(act.jobId, act.actionId);
  if (!action) return 0;
  const elapsed = now - act.cycleStart;
  return Math.max(0, Math.min(1, elapsed / action.durationMs));
}

// Temps restant (ms) avant la fin du cycle en cours.
export function activityRemainingMs(state, now = Date.now()) {
  const act = state.activity;
  if (!act) return 0;
  const action = getJobAction(act.jobId, act.actionId);
  if (!action) return 0;
  return Math.max(0, action.durationMs - (now - act.cycleStart));
}

// Octroie le butin d'un cycle terminé. Renvoie un agrégat { resources, xp, levels }.
function grantCycle(state, jobId, action, agg) {
  for (const drop of action.drops) {
    if (Math.random() <= drop.chance) {
      const qty = rollAmount(drop.min, drop.max);
      if (qty > 0) {
        addResource(drop.resource, qty);
        agg.resources[drop.resource] = (agg.resources[drop.resource] || 0) + qty;
        state.counters.harvested += qty;
      }
    }
  }
  const levels = applyXp(state.jobs[jobId], action.xp, jobXpToNext);
  agg.xp += action.xp;
  agg.levels += levels;
}

// Traite l'activité en cours : complète tous les cycles écoulés depuis cycleStart.
// `cap` limite le nombre de cycles (rattrapage hors-ligne).
// Renvoie null si rien n'a été récolté, sinon un résumé.
export function processActivity(state, now = Date.now(), cap = Infinity) {
  const act = state.activity;
  if (!act) return null;
  const action = getJobAction(act.jobId, act.actionId);
  if (!action) {
    state.activity = null;
    return null;
  }

  const agg = { jobId: act.jobId, actionId: act.actionId, resources: {}, xp: 0, levels: 0, cycles: 0 };
  let cycles = 0;
  while (now - act.cycleStart >= action.durationMs && cycles < cap) {
    grantCycle(state, act.jobId, action, agg);
    act.cycleStart += action.durationMs;
    cycles += 1;
  }
  agg.cycles = cycles;

  // En cas de rattrapage plafonné, on resynchronise le départ du cycle courant.
  if (cycles >= cap && now - act.cycleStart >= action.durationMs) {
    act.cycleStart = now;
  }

  return cycles > 0 ? agg : null;
}

// Rattrapage hors-ligne au chargement : traite le temps écoulé depuis lastSeen.
export function processOffline(state) {
  if (!state.activity) return null;
  const now = Date.now();
  const last = state.lastSeen || now;
  const elapsed = Math.min(now - last, MAX_OFFLINE_MS);
  const action = getJobAction(state.activity.jobId, state.activity.actionId);
  if (!action) return null;

  // On borne le départ pour ne rattraper que la fenêtre autorisée.
  const earliest = now - elapsed;
  if (state.activity.cycleStart < earliest) state.activity.cycleStart = earliest;

  const maxCycles = Math.floor(elapsed / action.durationMs) + 1;
  return processActivity(state, now, maxCycles);
}
