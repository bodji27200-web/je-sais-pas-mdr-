// Système de succès (Lot 12) : évaluation en direct + détection des nouveaux
// succès débloqués (pour notifier une seule fois).

import { ACHIEVEMENTS } from "../data/achievements.js";

export function ensureAchievements(state) {
  if (!state.achievements) state.achievements = { seen: {} };
  if (!state.achievements.seen) state.achievements.seen = {};
  return state.achievements;
}

// Liste enrichie : { ...def, unlocked, progress:{cur,max}|null }.
export function evaluateAchievements(state) {
  return ACHIEVEMENTS.map((a) => ({
    id: a.id, name: a.name, desc: a.desc, cat: a.cat, badge: !!a.badge,
    unlocked: !!a.check(state),
    progress: a.progress ? a.progress(state) : null,
  }));
}

export function unlockedCount(state) {
  return ACHIEVEMENTS.reduce((n, a) => n + (a.check(state) ? 1 : 0), 0);
}

// Détecte les succès nouvellement débloqués (non encore notifiés) et les marque.
// Renvoie les définitions correspondantes (pour les toasts).
export function checkNewAchievements(state) {
  const a = ensureAchievements(state);
  const newly = [];
  for (const def of ACHIEVEMENTS) {
    if (def.check(state) && !a.seen[def.id]) {
      a.seen[def.id] = true;
      newly.push(def);
    }
  }
  return newly;
}
