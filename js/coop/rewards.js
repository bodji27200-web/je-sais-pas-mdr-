// Journal de récompenses COOP — idempotent (§13/§17). Une récompense ne peut être
// matérialisée qu'UNE fois : chaque entrée porte un `rewardId` déterministe
// (combatId + siège + clé), inséré dans un Set. Rejouer/recharger ne duplique
// rien. Les récompenses COMMUNES sont dupliquées proprement (une instance par
// joueur, jamais de propriété disputée). Module PUR (testable).

export function createLedger(combatId) {
  return { combatId, entries: [], ids: new Set(), sealed: false };
}

// Insertion idempotente. Renvoie l'entrée créée, ou null si doublon / scellé.
export function grant(ledger, key, payload) {
  if (ledger.sealed) return null;
  const rewardId = `${ledger.combatId}:${key}`;
  if (ledger.ids.has(rewardId)) return null; // déjà attribué -> aucun effet
  ledger.ids.add(rewardId);
  const entry = { rewardId, ...payload };
  ledger.entries.push(entry);
  return entry;
}

export function sealLedger(ledger) {
  ledger.sealed = true;
  return ledger;
}

// Construit les récompenses d'une victoire coop :
//  - perso : XP/or par siège (selon la progression de chaque joueur) ;
//  - commun : un même butin attribué SÉPARÉMENT à chaque siège (uid distincts).
// `perSeat` = { A: {xp,gold}, B: {xp,gold} } ; `shared` = [{ baseId, rarity }].
export function buildVictoryRewards(combatId, perSeat, shared = []) {
  const ledger = createLedger(combatId);
  for (const seat of ["A", "B"]) {
    const p = perSeat[seat] || { xp: 0, gold: 0 };
    grant(ledger, `${seat}:xp`, { seat, kind: "xp", amount: p.xp || 0 });
    grant(ledger, `${seat}:gold`, { seat, kind: "gold", amount: p.gold || 0 });
  }
  // Butin commun : une instance PROPRE par joueur (pas d'indivision, pas de roll).
  shared.forEach((item, i) => {
    for (const seat of ["A", "B"]) {
      grant(ledger, `${seat}:shared${i}`, {
        seat, kind: "item",
        instance: { uid: `${combatId}:${seat}:s${i}`, baseId: item.baseId, rarity: item.rarity },
      });
    }
  });
  return sealLedger(ledger);
}

// Vue des récompenses d'un siège (ce que le client de ce joueur affiche).
export function rewardsForSeat(ledger, seat) {
  return ledger.entries.filter((e) => e.seat === seat);
}
