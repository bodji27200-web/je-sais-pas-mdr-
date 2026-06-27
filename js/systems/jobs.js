// Système de métiers idle : UNE activité principale par métier, qui évolue par
// paliers selon le niveau. Récolte chronométrée, répétition automatique,
// rattrapage hors-ligne plafonné.
//
// Forme de l'activité (state.activity) :
//   { jobId, tierId, cycleStart, auto }
//   - auto = true  : suit automatiquement le meilleur palier maîtrisé (la vue
//     principale évolue toute seule quand le métier monte de niveau).
//   - auto = false : le joueur a volontairement choisi un palier précis.

import { getJob, getJobTier, bestTier } from "../data/jobs.js";
import { addResource } from "../core/state.js";
import { applyXp, jobXpToNext, rollAmount } from "../core/progression.js";

// Plafond de rattrapage hors-ligne (8 h) : l'attente reste gratifiante sans devenir absurde.
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000;

// Lance l'activité principale d'un métier. `tierId` optionnel : si absent (ou si
// `auto`), on démarre sur le meilleur palier maîtrisé et on suit l'évolution.
export function startActivity(state, jobId, tierId = null, auto = null) {
  const job = getJob(jobId);
  if (!job) return { ok: false, error: "Métier inconnu." };
  const level = state.jobs[jobId].level;

  // Détermine le palier de départ.
  let tier = tierId ? getJobTier(jobId, tierId) : bestTier(jobId, level);
  if (!tier) return { ok: false, error: "Aucun palier disponible." };
  if (level < tier.minLevel) return { ok: false, error: `Niveau de métier ${tier.minLevel} requis.` };

  // Mode auto par défaut quand on prend le meilleur palier (ou rien de précisé).
  const best = bestTier(jobId, level);
  const isAuto = auto != null ? auto : !tierId || (best && tier.id === best.id);

  state.activity = { jobId, tierId: tier.id, cycleStart: Date.now(), auto: isAuto };
  return { ok: true, tierId: tier.id };
}

export function stopActivity(state) {
  state.activity = null;
}

// Palier actuellement actif (ou null).
export function activeTier(state) {
  const act = state.activity;
  if (!act) return null;
  return getJobTier(act.jobId, act.tierId);
}

// Progression de l'action en cours sur [0,1].
export function activityProgress(state, now = Date.now()) {
  const tier = activeTier(state);
  if (!tier) return 0;
  const elapsed = now - state.activity.cycleStart;
  return Math.max(0, Math.min(1, elapsed / tier.durationMs));
}

// Temps restant (ms) avant la fin du cycle en cours.
export function activityRemainingMs(state, now = Date.now()) {
  const tier = activeTier(state);
  if (!tier) return 0;
  return Math.max(0, tier.durationMs - (now - state.activity.cycleStart));
}

// Octroie le butin d'un cycle terminé. `efficiency` (0..1) réduit le butin et
// l'XP (récolte hors-ligne moins efficace que la récolte active).
function grantCycle(state, jobId, tier, agg, efficiency = 1) {
  for (const drop of tier.drops) {
    if (Math.random() <= drop.chance) {
      let qty = rollAmount(drop.min, drop.max);
      if (efficiency < 1) qty = Math.floor(qty * efficiency);
      if (qty > 0) {
        addResource(drop.resource, qty);
        agg.resources[drop.resource] = (agg.resources[drop.resource] || 0) + qty;
        state.counters.harvested += qty;
      }
    }
  }
  const job = getJob(jobId);
  const gainedXp = Math.max(1, Math.round(tier.xp * (job.xpMult || 1) * efficiency));
  const levels = applyXp(state.jobs[jobId], gainedXp, jobXpToNext);
  agg.xp += gainedXp;
  agg.levels += levels;
}

// Si l'activité est en mode auto et qu'un meilleur palier est désormais maîtrisé,
// fait évoluer l'activité principale. Renvoie le nouveau palier si changement.
function maybeEvolve(state) {
  const act = state.activity;
  if (!act || !act.auto) return null;
  const best = bestTier(act.jobId, state.jobs[act.jobId].level);
  if (best && best.id !== act.tierId) {
    act.tierId = best.id;
    return best;
  }
  return null;
}

// Traite l'activité en cours : complète tous les cycles écoulés depuis cycleStart.
// `cap` limite le nombre de cycles (rattrapage hors-ligne). `efficiency` module
// le butin/XP (récolte hors-ligne). Renvoie null si rien récolté, sinon un résumé.
export function processActivity(state, now = Date.now(), cap = Infinity, efficiency = 1) {
  const act = state.activity;
  if (!act) return null;
  let tier = getJobTier(act.jobId, act.tierId);
  if (!tier) {
    state.activity = null;
    return null;
  }

  const agg = { jobId: act.jobId, tierId: act.tierId, resources: {}, xp: 0, levels: 0, cycles: 0, evolved: null };
  let cycles = 0;
  while (now - act.cycleStart >= tier.durationMs && cycles < cap) {
    grantCycle(state, act.jobId, tier, agg, efficiency);
    act.cycleStart += tier.durationMs;
    cycles += 1;
    // Évolution automatique de palier (récolte active : durée du cycle suivant
    // recalculée). On garde le départ du cycle synchronisé.
    const evolved = maybeEvolve(state);
    if (evolved) {
      agg.evolved = evolved;
      tier = evolved;
    }
  }
  agg.cycles = cycles;
  agg.tierId = act.tierId;

  // En cas de rattrapage plafonné, on resynchronise le départ du cycle courant.
  if (cycles >= cap && now - act.cycleStart >= tier.durationMs) {
    act.cycleStart = now;
  }

  return cycles > 0 ? agg : null;
}

// Efficacité de la récolte hors-ligne (Lot 3 : volontairement < 100 % pour
// valoriser la présence active). Surchargeable plus tard par des améliorations.
export const OFFLINE_EFFICIENCY = 0.7;

// Rattrapage hors-ligne au chargement : traite le temps écoulé depuis lastSeen.
export function processOffline(state) {
  if (!state.activity) return null;
  const now = Date.now();
  const last = state.lastSeen || now;
  const elapsed = Math.min(now - last, MAX_OFFLINE_MS);
  const tier = getJobTier(state.activity.jobId, state.activity.tierId);
  if (!tier) return null;

  // On borne le départ pour ne rattraper que la fenêtre autorisée.
  const earliest = now - elapsed;
  if (state.activity.cycleStart < earliest) state.activity.cycleStart = earliest;

  const maxCycles = Math.floor(elapsed / tier.durationMs) + 1;
  const agg = processActivity(state, now, maxCycles, OFFLINE_EFFICIENCY);
  if (agg) agg.offline = true;
  return agg;
}
