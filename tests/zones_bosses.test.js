// Tests du Lot 10 — 2 nouvelles zones, ennemis verrouillés, boss à phases,
// intentions télégraphiées.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { startCombat, resolveRound, playerCanUse, enemyIntentInfo } from "../js/systems/combat.js";
import { enemyUnlock, zoneUnlocked } from "../js/systems/zoneprog.js";
import { ZONES } from "../js/data/zones.js";
import { ENEMIES, getEnemy } from "../js/data/enemies.js";
import { getSkill } from "../js/data/skills.js";
import { withSeed } from "./helpers.js";

function ready(classId = "warrior", level = 16) {
  const s = newGame("Héros", classId);
  s.character.level = level;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

test("les 2 nouvelles zones ont 5 ennemis + 1 boss, tous référencés", () => {
  for (const id of ["shadowstone_quarry", "pyrelake_ashes"]) {
    const z = ZONES[id];
    assert.ok(z, `zone ${id} existe`);
    assert.equal(z.enemies.length, 5, `${id} : 5 ennemis`);
    assert.ok(getEnemy(z.boss), `${id} : boss valide`);
    for (const e of [...z.enemies, z.boss]) assert.ok(getEnemy(e), `${id} : ennemi ${e} défini`);
    assert.equal(z.progression.length, 5, `${id} : progression à 5 paliers`);
  }
});

test("INTÉGRITÉ : chaque ennemi de zone a des compétences valides", () => {
  for (const e of Object.values(ENEMIES)) {
    for (const sid of e.skills || []) assert.ok(getSkill(sid), `${e.id} : compétence ${sid} définie`);
    if (e.secondPassive) assert.ok(getSkill(e.secondPassive), `${e.id} : 2e passive ${e.secondPassive}`);
    if (e.phases) for (const ph of e.phases) if (ph.grant) assert.ok(getSkill(ph.grant), `${e.id} : phase grant ${ph.grant}`);
  }
});

test("une zone est verrouillée tant que le boss précédent n'est pas vaincu", () => {
  const s = ready();
  // Zone 1 toujours ouverte.
  assert.equal(zoneUnlocked(s, "whispering_forest").unlocked, true);
  // Zone 2 verrouillée tant que Grôk n'est pas tombé.
  assert.equal(zoneUnlocked(s, "shadowstone_quarry").unlocked, false);
  assert.equal(zoneUnlocked(s, "pyrelake_ashes").unlocked, false);
  // On marque Grôk vaincu -> zone 2 ouverte, zone 3 toujours fermée.
  s.counters.defeated = { goblin_chief_grok: 1 };
  assert.equal(zoneUnlocked(s, "shadowstone_quarry").unlocked, true);
  assert.equal(zoneUnlocked(s, "pyrelake_ashes").unlocked, false);
  s.counters.defeated.vorrak_collapse = 1;
  assert.equal(zoneUnlocked(s, "pyrelake_ashes").unlocked, true);
});

test("les ennemis d'une zone se débloquent dans l'ordre", () => {
  const s = ready();
  s.character.level = 20;
  // Premier ennemi de la zone 2 dispo (niveau ok) ; le 2e exige des victoires.
  assert.equal(enemyUnlock(s, "dust_weaver").unlocked, true);
  assert.equal(enemyUnlock(s, "miner_wraith").unlocked, false);
  s.counters.defeated = { dust_weaver: 3 };
  assert.equal(enemyUnlock(s, "miner_wraith").unlocked, true);
});

test("aucun ennemi (boss inclus) n'annonce sa prochaine action (instr. 29-30, 272)", () => {
  const s = ready();
  const cBoss = startCombat(s, "vorrak_collapse");
  // La prochaine action n'est jamais télégraphiée : on ne révèle rien à l'avance.
  assert.equal(enemyIntentInfo(cBoss), null, "le boss ne télégraphie pas son action");
  const cNorm = startCombat(s, "dust_weaver");
  assert.equal(enemyIntentInfo(cNorm), null, "un ennemi normal ne télégraphie pas non plus");
  // Le journal ne contient aucune annonce du type « prépare ».
  assert.ok(!cBoss.log.some((l) => /prépare/i.test(l.text)), "le journal n'annonce aucune action à venir");
});

test("mémoire IA : l'historique du joueur est enregistré et borné (instr. 277)", () => {
  withSeed(11, () => {
    const c = startCombat(ready("warrior", 16), "shale_golem", { forceEnrage: false });
    const s2 = ready("warrior", 16);
    for (let i = 0; i < 10 && c.status === "active"; i++) resolveRound(s2, c, "basic_attack");
    assert.ok(Array.isArray(c.playerHistory), "l'historique du joueur existe");
    assert.ok(c.playerHistory.length <= 6, "fenêtre glissante bornée à 6 actions");
    assert.ok(c.playerHistory.every((id) => id === "basic_attack"), "l'historique reflète les actions réelles");
  });
});

test("les phases de boss se déclenchent sous les seuils de PV (règles + effets)", () => {
  const s = ready();
  const c = startCombat(s, "vorrak_collapse");
  // Avant tout : phase 0, pas de bonus.
  assert.equal(c.enemy.phaseIdx, 0);
  assert.equal(c.enemy.phaseAtkPct, 0);

  // On donne un bouclier au joueur et on amène le boss juste sous 60 %.
  c.player.shield = 200;
  c.player.shieldTurns = 3;
  c.enemy.hp = Math.floor(c.enemy.maxHp * 0.55);
  withSeed(1, () => resolveRound(s, c, "basic_attack")); // déclenche checkPhase

  assert.ok(c.enemy.phaseIdx >= 1, "la phase 1 doit être entrée");
  assert.ok(c.enemy.phaseAtkPct > 0, "l'attaque de phase augmente");
  assert.equal(c.enemy.element, "umbral", "l'élément de phase est posé");
  assert.equal(c.player.shield, 0, "la phase brise les barrières du joueur");

  // On l'amène sous 30 % : phase 2, octroi de la compétence signature.
  c.enemy.hp = Math.floor(c.enemy.maxHp * 0.25);
  withSeed(2, () => resolveRound(s, c, "basic_attack"));
  assert.ok(c.enemy.phaseIdx >= 2, "la phase finale doit être entrée");
  assert.ok(c.enemy.skills.includes("collapse"), "la compétence signature est accordée");
  assert.ok(c.enemy.phaseDefShred > 0, "la défense du joueur est percée en phase finale");
});

test("un combat de boss complet se résout (pas de boucle, pas de mur de régén)", () => {
  withSeed(7, () => {
    const s = ready("mage", 13);
    const c = startCombat(s, "vorrak_collapse");
    let g = 0;
    while (c.status === "active" && g < 600) {
      const sk = c.player.skills.find((id) => playerCanUse(c, id) && id !== "basic_attack") || "basic_attack";
      resolveRound(s, c, sk);
      g++;
    }
    assert.notEqual(c.status, "active", "le combat de boss doit se terminer");
    assert.ok(g < 600, "pas de boucle infinie");
  });
});
