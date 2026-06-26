// Montée de niveau : la logique vit ici, les COURBES (paramètres) dans
// js/data/curves.js (tunables, data-driven).

import { charXpAt, jobXpAt, MAX_LEVEL } from "../data/curves.js";

export { MAX_LEVEL };

// XP nécessaire pour passer du niveau `level` au suivant (personnage).
export function charXpToNext(level) {
  return charXpAt(level);
}

// XP nécessaire pour passer au niveau suivant (métier).
export function jobXpToNext(level) {
  return jobXpAt(level);
}

// Applique de l'XP à un objet { level, xp } et renvoie le nombre de niveaux gagnés.
// `xpToNext` est la fonction de courbe à utiliser.
export function applyXp(holder, amount, xpToNext) {
  holder.xp += amount;
  let gained = 0;
  let need = xpToNext(holder.level);
  while (holder.level < MAX_LEVEL && holder.xp >= need) {
    holder.xp -= need;
    holder.level += 1;
    gained += 1;
    need = xpToNext(holder.level);
  }
  // Au niveau maximum, l'XP excédentaire n'est plus accumulée.
  if (holder.level >= MAX_LEVEL) holder.xp = 0;
  return gained;
}

// Tirage d'une quantité aléatoire entière entre min et max (inclus).
export function rollAmount(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
