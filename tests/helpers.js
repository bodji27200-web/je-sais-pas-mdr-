// Utilitaires de test partagés.
//
// Aucune dépendance externe : on utilise uniquement le lanceur de tests natif de
// Node (`node --test`) et `node:assert`. Les modules de jeu sont des modules ES
// purs (la sauvegarde garde l'accès à `localStorage`), donc importables ici.

// --- RNG reproductible -----------------------------------------------------
// Beaucoup de systèmes appellent `Math.random()` directement. Pour rendre les
// tests déterministes sans réécrire le moteur, on remplace temporairement
// `Math.random` par un générateur à graine (mulberry32). À utiliser dans un
// bloc try/finally pour toujours restaurer l'original.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Exécute `fn` avec `Math.random` remplacé par un PRNG à graine, puis restaure.
export function withSeed(seed, fn) {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

// Statistiques utiles pour vérifier des distributions.
export function approxEqual(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(
      (message || "Valeur hors tolérance") +
        ` : attendu ${expected} ±${tolerance}, obtenu ${actual} (écart ${diff.toFixed(4)})`
    );
  }
}
