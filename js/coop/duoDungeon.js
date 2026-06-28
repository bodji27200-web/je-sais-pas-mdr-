// Donjon coopératif en duo : enchaîne les VAGUES d'un donjon (§18) sur un MÊME
// combat duo (PV/Garde/ressource/recharges persistent — §19), gère les vagues de
// récupération, propose des BÉNÉDICTIONS persistantes (draft roguelite) et scelle
// les récompenses idempotentes à la victoire (§17). Fuite impossible (noFlee).
//
// S'appuie sur duoCombat.js (résolution de combat) ; module PUR et testable.

import { createDuoCombat, loadWave, recover, SEATS } from "./duoCombat.js";
import { getDungeon, getBlessing } from "../data/dungeons.js";
import { getEnemy } from "../data/enemies.js";
import { buildVictoryRewards } from "./rewards.js";

export function createDuoDungeon(stateA, stateB, dungeonId, opts = {}) {
  const def = getDungeon(dungeonId);
  if (!def) return null;
  const combat = createDuoCombat(stateA, stateB, { enemies: [] }, opts);
  const dungeon = {
    id: dungeonId, def, opts,
    waveIndex: -1,
    combat,
    blessingsTaken: [],
    pendingBlessing: null, // options proposées en attente de choix
    status: "active", // active | cleared | failed
    ledger: null,
    noFlee: !!def.noFlee,
  };
  enterNextWave(dungeon); // charge la première vague de combat
  return dungeon;
}

// Avance jusqu'à la prochaine vague de COMBAT (en traitant les vagues recover).
function enterNextWave(dungeon) {
  const waves = dungeon.def.waves;
  let i = dungeon.waveIndex + 1;
  while (i < waves.length && waves[i].type === "recover") {
    recover(dungeon.combat, waves[i].recover || {});
    i++;
  }
  if (i >= waves.length) { finishDungeon(dungeon, "cleared"); return; }
  dungeon.waveIndex = i;
  loadWave(dungeon.combat, waves[i].enemies || [], dungeon.opts);
}

// À appeler APRÈS chaque resolveTurn(dungeon.combat). Fait progresser le donjon :
// renvoie un statut lisible par l'appelant (UI/serveur).
export function syncDungeon(dungeon) {
  if (dungeon.status !== "active") return { status: dungeon.status };
  const c = dungeon.combat;
  if (c.status === "lost") { finishDungeon(dungeon, "failed"); return { status: "failed" }; }
  if (c.status !== "won") return { status: "in_wave", waveIndex: dungeon.waveIndex };

  // Vague nettoyée. Dernière vague ? -> donjon réussi.
  const waves = dungeon.def.waves;
  const isLast = !waves.slice(dungeon.waveIndex + 1).some((w) => w.type !== "recover");
  // Bénédiction proposée après cette vague ?
  if (!isLast && (dungeon.def.blessingsAfter || []).includes(dungeon.waveIndex) && !dungeon.pendingBlessing) {
    dungeon.pendingBlessing = rollBlessingOptions(dungeon);
    return { status: "blessing_offered", options: dungeon.pendingBlessing, waveCleared: dungeon.waveIndex };
  }
  if (isLast) { finishDungeon(dungeon, "cleared"); return { status: "cleared" }; }
  enterNextWave(dungeon);
  return { status: "next_wave", waveIndex: dungeon.waveIndex };
}

function rollBlessingOptions(dungeon) {
  const all = Object.keys({ bless_vigor: 1, bless_ward: 1, bless_might: 1, bless_renewal: 1 })
    .filter((id) => !dungeon.blessingsTaken.includes(id));
  // mélange déterministe-friendly (utilise Math.random, graine via les tests)
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all.slice(0, 3);
}

// Choix d'une bénédiction (appliquée aux DEUX héros, persiste tout le donjon).
export function chooseBlessing(dungeon, blessingId) {
  if (!dungeon.pendingBlessing || !dungeon.pendingBlessing.includes(blessingId)) return { ok: false, error: "INVALID_BLESSING" };
  const bless = getBlessing(blessingId);
  if (!bless) return { ok: false, error: "UNKNOWN_BLESSING" };
  for (const seat of SEATS) {
    const h = dungeon.combat.heroes[seat];
    (h.blessings || (h.blessings = [])).push(blessingId);
    bless.apply(h);
  }
  dungeon.blessingsTaken.push(blessingId);
  dungeon.pendingBlessing = null;
  enterNextWave(dungeon);
  return { ok: true, waveIndex: dungeon.waveIndex };
}

// Sauter la bénédiction proposée (continuer sans choisir).
export function skipBlessing(dungeon) {
  if (!dungeon.pendingBlessing) return { ok: false };
  dungeon.pendingBlessing = null;
  enterNextWave(dungeon);
  return { ok: true, waveIndex: dungeon.waveIndex };
}

function finishDungeon(dungeon, outcome) {
  dungeon.status = outcome;
  dungeon.combat.status = outcome === "cleared" ? "won" : "lost";
  if (outcome === "cleared") dungeon.ledger = buildDungeonRewards(dungeon);
}

// Récompenses du donjon (perso par siège + butin commun), idempotentes (§17).
function buildDungeonRewards(dungeon) {
  // XP/or = somme des ennemis du donjon, part personnelle par siège.
  let xp = 0, gold = 0;
  for (const w of dungeon.def.waves) for (const id of w.enemies || []) {
    const e = getEnemy(id); if (e) { xp += e.xp || 0; gold += e.gold || 0; }
  }
  const perSeat = { A: { xp, gold }, B: { xp, gold } };
  // Butin commun simple : le cœur du boss final (data libre).
  const last = [...dungeon.def.waves].reverse().find((w) => w.type === "boss" || w.enemies);
  const bossId = last && last.enemies ? last.enemies[last.enemies.length - 1] : null;
  const shared = bossId ? [{ baseId: bossId + "_trophy", rarity: "epic" }] : [];
  return buildVictoryRewards(`dgn_${dungeon.id}`, perSeat, shared);
}
