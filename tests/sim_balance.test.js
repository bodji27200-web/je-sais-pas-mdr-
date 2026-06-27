// Tests Lot 8 — simulateur PvE (instr. 325-333). Le simulateur rejoue de VRAIS
// combats avec le moteur complet, pour mesurer des taux de victoire et détecter
// les valeurs absurdes. Ces tests vérifient surtout que l'OUTIL est fiable
// (déterminisme, discrimination, comparaison avec/sans familier) ; les chiffres
// d'équilibrage fins sont documentés dans docs/AUDIT-refonte-classes.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { simulatePvE } from "../js/systems/combat.js";
import { EQUIPMENT } from "../js/data/equipment.js";
import { SPECIALIZATIONS } from "../js/data/specializations.js";
import { makeInstance } from "../js/core/items.js";
import { mulberry32 } from "./helpers.js";

const FAMILY = { warrior: "metal", guardian: "metal", archer: "leather", assassin: "leather", mage: "cloth" };

function bestOf(pred, lvl) {
  let best = null;
  for (const e of Object.values(EQUIPMENT)) {
    if (pred(e) && (e.levelReq || 0) <= lvl && (!best || (e.levelReq || 0) > (best.levelReq || 0))) best = e;
  }
  return best;
}
function geared(cls, lvl) {
  const s = newGame("Sim", cls);
  s.character.level = lvl;
  const sp = Object.values(SPECIALIZATIONS).find((x) => x.classId === cls);
  if (sp) s.character.specId = sp.id;
  const wt = sp && sp.mastery ? sp.mastery.wtype : null;
  const w = wt ? bestOf((e) => e.slot === "weapon" && e.wtype === wt, lvl) : null;
  if (w) s.character.equipment.weapon = makeInstance(w.id, "rare");
  for (const slot of ["head", "chest", "legs", "hands", "feet"]) {
    const p = bestOf((e) => e.slot === slot && e.family === FAMILY[cls], lvl);
    if (p) s.character.equipment[slot] = makeInstance(p.id, "rare");
  }
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

// Helper : taux de victoire / no-hit sur N graines.
function rates(cls, lvl, enemyId, N, seedBase, mutate) {
  let wins = 0, noHit = 0;
  for (let k = 0; k < N; k++) {
    const orig = Math.random;
    Math.random = mulberry32(seedBase + k * 13);
    try {
      const s = geared(cls, lvl);
      if (mutate) mutate(s);
      s.character.hpCurrent = getDerivedStats(s).maxHp;
      const r = simulatePvE(s, enemyId);
      if (r.win) wins++;
      if (r.noHitWin) noHit++;
    } finally { Math.random = orig; }
  }
  return { winRate: wins / N, noHitRate: noHit / N };
}

test("simulatePvE renvoie un résultat bien formé", () => {
  const orig = Math.random; Math.random = mulberry32(1);
  try {
    const r = simulatePvE(geared("warrior", 6), "goblin_chief_grok");
    assert.equal(typeof r.win, "boolean");
    assert.ok(Number.isFinite(r.turns) && r.turns > 0);
    assert.ok(Number.isFinite(r.hpFrac));
    assert.equal(typeof r.noHitWin, "boolean");
  } finally { Math.random = orig; }
});

test("le simulateur PvE est déterministe sous une graine", () => {
  const run = () => {
    const orig = Math.random; Math.random = mulberry32(2024);
    try { return simulatePvE(geared("assassin", 8), "wild_boar"); }
    finally { Math.random = orig; }
  };
  assert.deepEqual(run(), run());
});

test("le simulateur DISCRIMINE (favorable -> victoires, défavorable -> défaites)", () => {
  // Joueur largement sur-équipé contre un ennemi de zone 1 : il gagne (souvent).
  const easy = rates("warrior", 12, "feral_wolf", 12, 100);
  assert.ok(easy.winRate >= 0.8, `matchup favorable: victoires attendues (${easy.winRate})`);
  // Joueur très sous-niveau contre le boss de fin : il perd (souvent).
  const hard = rates("warrior", 6, "ignar_emberheart", 12, 200);
  assert.ok(hard.winRate <= 0.2, `matchup défavorable: défaites attendues (${hard.winRate})`);
});

test("familier : compare avec / sans (instr. 328) — un familier léger ne décide pas seul", () => {
  // Sur un même matchup, équiper un familier léger ne doit pas transformer une
  // quasi-défaite en quasi-victoire (swing borné).
  const withFam = (s) => {
    s.familiars = { owned: { gale_finch: { level: s.character.level, xp: 0, link: 0 } }, eggs: {}, equipped: "gale_finch", essence: 0 };
  };
  const base = rates("archer", 9, "shale_golem", 16, 300);
  const fam = rates("archer", 9, "shale_golem", 16, 300, withFam);
  assert.ok(Math.abs(fam.winRate - base.winRate) <= 0.5, `le familier ne doit pas décider seul de l'issue (Δ=${(fam.winRate - base.winRate).toFixed(2)})`);
});

test("anti-absurdité : le boss de fin n'est pas un combat trivialement gagné par TOUTES les classes", () => {
  // Au moins une classe ne le gagne PAS systématiquement à niveau égal : il existe
  // un vrai mur (le détail par classe est suivi dans l'audit). Détecte un boss
  // de fin devenu gratuit pour tout le monde.
  let allTrivial = true;
  for (const cls of ["warrior", "guardian", "archer", "mage", "assassin"]) {
    const r = rates(cls, 15, "ignar_emberheart", 10, 400 + cls.length);
    if (r.winRate < 1) allTrivial = false;
  }
  assert.equal(allTrivial, false, "le boss de fin ne doit pas être gagné à 100 % par toutes les classes");
});
