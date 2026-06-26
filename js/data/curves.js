// Courbes de progression — centralisées et tunables (data-driven).
//
// Objectif métier : montée RAPIDE en début de partie (on comprend le système),
// investissement réel au milieu, longue spécialisation vers le niveau 100.
// Aucune valeur de niveau n'est codée en dur ailleurs : tout dérive d'ici.

// Niveau maximum atteignable (personnage et métiers).
export const MAX_LEVEL = 100;

// Personnage : XP pour passer de `level` à `level+1`.
export const CHAR_XP = { base: 80, exp: 1.4 };

// Métier : XP pour passer de `level` à `level+1`. L'exposant légèrement plus
// élevé étire la fin de courbe (le niveau 100 reste un objectif de long terme).
export const JOB_XP = { base: 50, exp: 1.35 };

export function charXpAt(level) {
  return Math.round(CHAR_XP.base * Math.pow(level, CHAR_XP.exp));
}

export function jobXpAt(level) {
  return Math.round(JOB_XP.base * Math.pow(level, JOB_XP.exp));
}
