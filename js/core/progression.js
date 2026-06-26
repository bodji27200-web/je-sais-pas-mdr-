// Courbes d'XP et montée de niveau, centralisées et donc faciles à équilibrer.

// XP nécessaire pour passer du niveau `level` au suivant (personnage).
export function charXpToNext(level) {
  return Math.round(80 * Math.pow(level, 1.4));
}

// XP nécessaire pour passer au niveau suivant (métier).
export function jobXpToNext(level) {
  return Math.round(50 * Math.pow(level, 1.3));
}

// Applique de l'XP à un objet { level, xp } et renvoie le nombre de niveaux gagnés.
// `xpToNext` est la fonction de courbe à utiliser.
export function applyXp(holder, amount, xpToNext) {
  holder.xp += amount;
  let gained = 0;
  let need = xpToNext(holder.level);
  while (holder.xp >= need) {
    holder.xp -= need;
    holder.level += 1;
    gained += 1;
    need = xpToNext(holder.level);
  }
  return gained;
}

// Tirage d'une quantité aléatoire entière entre min et max (inclus).
export function rollAmount(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
