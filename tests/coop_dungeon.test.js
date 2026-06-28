// Tests des donjons coop (vagues, persistance, bénédictions) + journal de
// récompenses idempotent.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { createDuoCombat, submitIntent, resolveTurn, loadWave, recover, livingEnemies } from "../js/coop/duoCombat.js";
import { createDuoDungeon, syncDungeon, chooseBlessing, skipBlessing } from "../js/coop/duoDungeon.js";
import { createLedger, grant, buildVictoryRewards, rewardsForSeat } from "../js/coop/rewards.js";
import { withSeed } from "./helpers.js";

function strong(cls) {
  const s = newGame("H", cls);
  s.character.level = 80; // sur-niveau pour nettoyer les vagues vite
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}
// Joue le combat courant jusqu'à son terme (héros surpuissants -> victoire).
function autoFight(combat, maxTurns = 200) {
  let n = 0;
  while (combat.status === "active" && n < maxTurns) {
    const e = livingEnemies(combat)[0];
    submitIntent(combat, "A", { skillId: "basic_attack", targetRef: e && e.uid });
    submitIntent(combat, "B", { skillId: "basic_attack", targetRef: e && e.uid });
    resolveTurn(combat);
    n++;
  }
  return combat.status;
}

test("vagues : PV/recharges persistent entre vagues, buffs/états nettoyés", () => {
  withSeed(5, () => {
    const c = createDuoCombat(strong("warrior"), strong("mage"), { enemies: ["feral_wolf"] }, { noJitter: true, forceEnrage: false });
    c.heroes.A.hp = Math.round(c.heroes.A.maxHp * 0.5);
    c.heroes.A.buffs.push({ type: "atk_buff", amount: 0.3, turns: 5 });
    c.heroes.A.states.push({ id: "burn", turns: 3, stacks: 1, dotDmg: 5 });
    c.heroes.A.cooldowns.fireball = 2;
    const hpBefore = c.heroes.A.hp;
    loadWave(c, ["goblin_raider"], { noJitter: true });
    assert.equal(c.heroes.A.hp, hpBefore, "les PV persistent");
    assert.equal(c.heroes.A.buffs.length, 0, "les buffs ordinaires sont nettoyés");
    assert.equal(c.heroes.A.states.length, 0, "les états sont nettoyés");
    assert.equal(c.heroes.A.cooldowns.fireball, 2, "les recharges persistent");
    assert.equal(c.enemies[0].enemyId, "goblin_raider", "nouvelle vague chargée");
  });
});

test("récupération : rend une part des PV/Garde/ressource sans plein gratuit", () => {
  const c = createDuoCombat(strong("guardian"), strong("mage"), { enemies: ["feral_wolf"] }, { noJitter: true, forceEnrage: false });
  c.heroes.A.hp = 10;
  if (c.heroes.A.res) c.heroes.A.res.cur = 0;
  recover(c, { hpPct: 0.25, guardPct: 0.5, resPct: 0.5 });
  assert.ok(c.heroes.A.hp > 10 && c.heroes.A.hp < c.heroes.A.maxHp, "PV partiellement restaurés");
});

test("donjon : se termine (cleared) en enchaînant les vagues + récompenses scellées", () => {
  withSeed(11, () => {
    const d = createDuoDungeon(strong("warrior"), strong("mage"), "shale_depths", { noJitter: true, forceEnrage: false });
    assert.equal(d.waveIndex, 0, "première vague de combat chargée");
    let guard = 0;
    while (d.status === "active" && guard < 30) {
      autoFight(d.combat);
      const s = syncDungeon(d);
      if (s.status === "blessing_offered") chooseBlessing(d, s.options[0]); // on prend la 1re
      guard++;
    }
    assert.equal(d.status, "cleared", "le donjon est terminé");
    assert.ok(d.ledger && d.ledger.sealed, "récompenses scellées");
    assert.ok(rewardsForSeat(d.ledger, "A").length > 0 && rewardsForSeat(d.ledger, "B").length > 0, "gains pour les 2 sièges");
  });
});

test("donjon : une bénédiction augmente durablement le héros (PV max)", () => {
  withSeed(2, () => {
    const d = createDuoDungeon(strong("warrior"), strong("mage"), "shale_depths", { noJitter: true, forceEnrage: false });
    autoFight(d.combat); // vague 0
    const s = syncDungeon(d);
    assert.equal(s.status, "blessing_offered", "bénédiction proposée après la vague 0");
    const maxA = d.combat.heroes.A.maxHp;
    // choisir Vigueur si proposée, sinon la première
    const pick = s.options.includes("bless_vigor") ? "bless_vigor" : s.options[0];
    chooseBlessing(d, pick);
    assert.ok(d.combat.heroes.A.blessings.includes(pick), "bénédiction enregistrée");
    if (pick === "bless_vigor") assert.ok(d.combat.heroes.A.maxHp > maxA, "PV max augmentés par la bénédiction");
  });
});

test("récompenses : idempotence — un même rewardId n'est attribué qu'une fois", () => {
  const l = createLedger("cbt_1");
  assert.ok(grant(l, "A:xp", { seat: "A", kind: "xp", amount: 100 }));
  assert.equal(grant(l, "A:xp", { seat: "A", kind: "xp", amount: 100 }), null, "doublon ignoré");
  assert.equal(l.entries.length, 1, "une seule entrée");
});

test("récompenses : butin commun dupliqué proprement (une instance par siège, uid distincts)", () => {
  const l = buildVictoryRewards("cbt_2", { A: { xp: 50, gold: 10 }, B: { xp: 60, gold: 10 } }, [{ baseId: "golem_core", rarity: "epic" }]);
  const aItems = rewardsForSeat(l, "A").filter((e) => e.kind === "item");
  const bItems = rewardsForSeat(l, "B").filter((e) => e.kind === "item");
  assert.equal(aItems.length, 1);
  assert.equal(bItems.length, 1);
  assert.notEqual(aItems[0].instance.uid, bItems[0].instance.uid, "uid distincts (pas d'indivision)");
  assert.equal(aItems[0].instance.baseId, bItems[0].instance.baseId, "même objet, deux instances");
  assert.equal(l.sealed, true, "scellé");
});
