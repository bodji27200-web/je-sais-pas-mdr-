// Tests d'équilibrage (Lot 9) — simulateur de duel build-vs-build.
//
// On vérifie les INVARIANTS de design du cahier des charges, mesurés avec un
// ÉQUIPEMENT COMPARABLE (set « identité » par classe, arme de maîtrise, même
// rareté) au niveau où les spécialisations sont débloquées :
//   1. aucun build n'est universellement dominant (ne bat pas TOUTES les autres
//      voies > 60 % — il existe toujours un contre) ;
//   2. aucun build n'est inutile (chaque voie a au moins un affrontement
//      favorable et un taux de victoire global plancher) ;
//   3. au sein d'une même classe, les 3 voies restent comparables (écart borné)
//      — aucune voie ne rend ses sœurs obsolètes.
//
// Le duel est une lentille d'équilibrage RELATIF (PvP à la mort) ; il sous-estime
// volontairement les tanks dont la valeur (mitigation) s'exprime surtout en PvE.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { simulateDuel } from "../js/systems/combat.js";
import { SPECIALIZATIONS, getSpec } from "../js/data/specializations.js";
import { EQUIPMENT } from "../js/data/equipment.js";
import { makeInstance } from "../js/core/items.js";
import { mulberry32 } from "./helpers.js";

const LEVEL = 20;
const SEEDS = 10;
const RARITY = "rare";
const IDENTITY_FAMILY = { warrior: "metal", guardian: "metal", archer: "leather", assassin: "leather", mage: "cloth" };

function bestOf(pred) {
  let best = null;
  for (const e of Object.values(EQUIPMENT)) {
    if (pred(e) && (e.levelReq || 0) <= LEVEL && (!best || (e.levelReq || 0) > (best.levelReq || 0))) best = e;
  }
  return best;
}

function buildGearedState(classId, specId) {
  const s = newGame("Sim", classId);
  s.character.level = LEVEL;
  s.character.specId = specId;
  const spec = getSpec(specId);
  const fam = IDENTITY_FAMILY[classId];
  const wtype = spec && spec.mastery ? spec.mastery.wtype : null;
  const w = wtype ? bestOf((e) => e.slot === "weapon" && e.wtype === wtype) : null;
  if (w) s.character.equipment.weapon = makeInstance(w.id, RARITY);
  for (const slot of ["head", "chest", "legs", "hands", "feet"]) {
    const piece = bestOf((e) => e.slot === slot && e.family === fam);
    if (piece) s.character.equipment[slot] = makeInstance(piece.id, RARITY);
  }
  // Équilibrage « sans avantage élémentaire » (cahier des charges) : on neutralise
  // l'élément d'arme et les affixes aléatoires pour mesurer la classe/voie pure.
  for (const slot of Object.keys(s.character.equipment)) {
    const inst = s.character.equipment[slot];
    if (inst) { inst.element = null; inst.affixes = []; }
  }
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

// Construit les états (gear déterministe) puis lance le round-robin complet.
function runRoundRobin() {
  const specs = Object.values(SPECIALIZATIONS);
  const states = {};
  {
    const orig = Math.random;
    Math.random = mulberry32(777);
    try { for (const sp of specs) states[sp.id] = buildGearedState(sp.classId, sp.id); }
    finally { Math.random = orig; }
  }
  const wins = {}, games = {}, matrix = {};
  for (const sp of specs) { wins[sp.id] = 0; games[sp.id] = 0; matrix[sp.id] = {}; }
  for (let i = 0; i < specs.length; i++) {
    for (let j = i + 1; j < specs.length; j++) {
      const A = specs[i], B = specs[j];
      let awVsB = 0;
      for (let k = 0; k < SEEDS; k++) {
        const orig = Math.random;
        Math.random = mulberry32(1000 + k * 7 + i * 131 + j * 17);
        try {
          const swap = k % 2 === 1;
          const r = swap ? simulateDuel(states[B.id], states[A.id]) : simulateDuel(states[A.id], states[B.id]);
          const aWon = swap ? r.winner === "B" : r.winner === "A";
          games[A.id]++; games[B.id]++;
          if (r.winner === "draw") { wins[A.id] += 0.5; wins[B.id] += 0.5; awVsB += 0.5; }
          else if (aWon) { wins[A.id]++; awVsB++; }
          else wins[B.id]++;
        } finally { Math.random = orig; }
      }
      matrix[A.id][B.id] = awVsB / SEEDS;
      matrix[B.id][A.id] = 1 - awVsB / SEEDS;
    }
  }
  const overall = {};
  for (const sp of specs) overall[sp.id] = wins[sp.id] / games[sp.id];
  return { specs, matrix, overall };
}

const RESULT = runRoundRobin();

test("aucune spécialisation n'est universellement dominante (> 60 % contre toutes)", () => {
  for (const sp of RESULT.specs) {
    const cells = Object.values(RESULT.matrix[sp.id]);
    const dominatesAll = cells.every((w) => w > 0.6);
    assert.equal(dominatesAll, false, `${sp.id} bat toutes les autres voies > 60 % (build dominant)`);
    // Garde-fou supplémentaire : il existe un vrai contre (au moins un ≤ 50 %).
    assert.ok(cells.some((w) => w <= 0.5), `${sp.id} doit avoir au moins un mauvais affrontement`);
  }
});

test("aucune spécialisation n'est inutile (a un affrontement favorable + plancher)", () => {
  for (const sp of RESULT.specs) {
    const cells = Object.values(RESULT.matrix[sp.id]);
    const best = Math.max(...cells);
    assert.ok(best >= 0.5, `${sp.id} n'a aucun affrontement gagnable (meilleur ${(best * 100).toFixed(0)} %)`);
    assert.ok(RESULT.overall[sp.id] >= 0.1, `${sp.id} : taux global trop bas (${(RESULT.overall[sp.id] * 100).toFixed(0)} %)`);
  }
});

test("au sein d'une classe, les 3 voies restent comparables (écart borné)", () => {
  const byClass = {};
  for (const sp of RESULT.specs) (byClass[sp.classId] ||= []).push(RESULT.overall[sp.id]);
  for (const cls of Object.keys(byClass)) {
    const arr = byClass[cls];
    const spread = Math.max(...arr) - Math.min(...arr);
    assert.ok(spread <= 0.3, `${cls} : écart entre voies trop grand (${(spread * 100).toFixed(0)} pts) — une voie éclipse les autres`);
  }
});

test("le simulateur de duel est déterministe sous une graine", () => {
  const a = buildGearedState("warrior", "warrior_berserker");
  const b = buildGearedState("mage", "mage_pyromancer");
  const run = () => {
    const orig = Math.random;
    Math.random = mulberry32(2024);
    try { return simulateDuel(a, b); } finally { Math.random = orig; }
  };
  assert.deepEqual(run(), run());
});

test("chaque spécialisation modifie réellement le style (grant + passive distincts)", () => {
  // Anti « +20 % d'attaque » : chaque voie accorde une compétence ET un effet
  // dynamique (passive) ou une maîtrise — pas qu'un multiplicateur de stat.
  for (const sp of RESULT.specs) {
    assert.ok(sp.grants && sp.grants.length >= 1, `${sp.id} doit accorder une compétence`);
    const hasIdentity = (sp.passive && Object.keys(sp.passive).length > 0) || !!sp.mastery;
    assert.ok(hasIdentity, `${sp.id} doit avoir une passive ou une maîtrise (identité de jeu)`);
  }
});
