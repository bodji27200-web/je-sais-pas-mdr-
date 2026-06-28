// Tests du moteur de COMBAT COOPÉRATIF EN DUO (Lot 4 coop).
// On vérifie : construction 2 héros + N ennemis, sélection simultanée, résolution
// ordonnée, soutien mutuel (cibler l'allié), ciblage IA (provocation), victoire/
// défaite, validations serveur, idempotence/anti-rejeu, action auto, déterminisme,
// absence de NaN.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import {
  createDuoCombat, submitIntent, validateIntent, resolveTurn, autoIntent,
  awaitingSeats, bothChosen, publicView, livingEnemies, livingHeroes, SEATS,
} from "../js/coop/duoCombat.js";
import { withSeed } from "./helpers.js";

function hero(cls, lvl = 20) {
  const s = newGame(cls === "mage" ? "Mage" : "Hero", cls);
  s.character.level = lvl;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}
function duo(enemies, opts = {}) {
  return createDuoCombat(hero("warrior"), hero("mage"), { enemies }, { noJitter: true, forceEnrage: false, ...opts });
}

test("duo : construction — 2 sièges, N ennemis, phase de sélection", () => {
  const c = duo(["feral_wolf", "goblin_raider"]);
  assert.deepEqual(Object.keys(c.heroes).sort(), ["A", "B"]);
  assert.equal(c.enemies.length, 2);
  assert.equal(c.heroes.A.seat, "A");
  assert.equal(c.phase, "selecting");
  assert.equal(c.heroes.A.fxId, "hero:A");
  assert.equal(c.enemies[0].side, "enemy");
});

test("duo : combat complet se termine sans NaN", () => {
  withSeed(42, () => {
    const c = duo(["feral_wolf", "goblin_raider"]);
    let n = 0;
    while (c.status === "active" && n < 80) {
      const e = livingEnemies(c)[0];
      submitIntent(c, "A", { skillId: "basic_attack", targetRef: e && e.uid });
      submitIntent(c, "B", { skillId: "basic_attack", targetRef: e && e.uid });
      resolveTurn(c);
      n++;
    }
    assert.ok(c.status === "won" || c.status === "lost", "le combat se termine");
    assert.ok(!Number.isNaN(c.heroes.A.hp) && !Number.isNaN(c.heroes.B.hp), "pas de NaN");
    for (const en of c.enemies) assert.ok(!Number.isNaN(en.hp));
  });
});

test("duo : soutien mutuel — un héros protège son allié (bouclier ciblé)", () => {
  withSeed(7, () => {
    const c = duo(["shale_golem"]);
    // Le mage (siège B) pose sa Barrière arcanique SUR l'allié A.
    assert.ok(c.heroes.B.skills.includes("arcane_barrier"), "le mage a la barrière");
    c.heroes.A.shield = 0;
    submitIntent(c, "A", { skillId: "defend", targetRef: "self" });
    const r = submitIntent(c, "B", { skillId: "arcane_barrier", targetRef: "ally" });
    assert.equal(r.ok, true);
    resolveTurn(c);
    assert.ok(c.heroes.A.shield > 0, "l'allié A a reçu le bouclier du mage B");
  });
});

test("duo : la provocation redirige le ciblage de l'IA vers le héros provocateur", () => {
  withSeed(3, () => {
    const c = duo(["feral_wolf"]);
    // On rend les deux héros identiques en vie, A provoque.
    c.heroes.A.taunt = 3;
    c.heroes.B.taunt = 0;
    let hitsA = 0, hitsB = 0;
    for (let i = 0; i < 8 && c.status === "active"; i++) {
      const hpA = c.heroes.A.hp, hpB = c.heroes.B.hp;
      c.heroes.A.taunt = 3; // maintenir la provocation
      submitIntent(c, "A", { skillId: "defend", targetRef: "self" });
      submitIntent(c, "B", { skillId: "defend", targetRef: "self" });
      resolveTurn(c);
      if (c.heroes.A.hp < hpA) hitsA++;
      if (c.heroes.B.hp < hpB) hitsB++;
    }
    assert.ok(hitsA >= hitsB, `la provocation attire les coups sur A (A=${hitsA}, B=${hitsB})`);
  });
});

test("duo : validations serveur (compétence non possédée, cible invalide, coût, recharge)", () => {
  const c = duo(["feral_wolf"]);
  assert.equal(validateIntent(c, "A", { skillId: "fireball" }).error, "SKILL_NOT_OWNED", "warrior n'a pas fireball");
  // soin/soutien sur un ennemi -> invalide
  assert.equal(validateIntent(c, "B", { skillId: "arcane_barrier", targetRef: c.enemies[0].uid }).error, "INVALID_TARGET");
  // recharge : on met une compétence POSSÉDÉE en cooldown
  c.heroes.B.cooldowns.arcane_bolt = 2;
  assert.equal(validateIntent(c, "B", { skillId: "arcane_bolt", targetRef: c.enemies[0].uid }).error, "ON_COOLDOWN");
  // ressource insuffisante
  c.heroes.B.cooldowns.arcane_bolt = 0;
  if (c.heroes.B.res) c.heroes.B.res.cur = 0;
  assert.equal(validateIntent(c, "B", { skillId: "arcane_bolt", targetRef: c.enemies[0].uid }).error, "NOT_ENOUGH_RESOURCE");
});

test("duo : idempotence — un même commandId n'est appliqué qu'une fois", () => {
  const c = duo(["feral_wolf"]);
  const cmd = "cmd_123";
  const r1 = submitIntent(c, "A", { skillId: "basic_attack", targetRef: c.enemies[0].uid, commandId: cmd });
  assert.equal(r1.status, "accepted");
  // un second envoi avec le MÊME commandId est ignoré (dupliqué)
  const r2 = submitIntent(c, "A", { skillId: "basic_attack", targetRef: c.enemies[0].uid, commandId: cmd });
  assert.equal(r2.status, "duplicate");
});

test("duo : attente des deux joueurs + action auto si un siège ne répond pas", () => {
  const c = duo(["feral_wolf"]);
  assert.deepEqual(awaitingSeats(c).sort(), ["A", "B"]);
  submitIntent(c, "A", { skillId: "basic_attack", targetRef: c.enemies[0].uid });
  assert.deepEqual(awaitingSeats(c), ["B"]);
  assert.equal(bothChosen(c), false);
  // résolution sans intention de B + autoFill:false -> on attend B
  const r = resolveTurn(c, { autoFill: false });
  assert.equal(r.error, "AWAITING");
  // action auto pour B : Défendre (sûre) ou attaque de base
  const auto = autoIntent(c, "B");
  assert.ok(auto && (auto.skillId === "defend" || auto.skillId === "basic_attack"));
  // avec autoFill (défaut), le tour se résout malgré B silencieux
  const r2 = resolveTurn(c);
  assert.equal(r2.ok, true);
});

test("duo : victoire = tous les ennemis morts", () => {
  withSeed(1, () => {
    const c = duo(["feral_wolf"]);
    c.enemies[0].hp = 1; // sur le point de tomber
    submitIntent(c, "A", { skillId: "basic_attack", targetRef: c.enemies[0].uid });
    submitIntent(c, "B", { skillId: "basic_attack", targetRef: c.enemies[0].uid });
    resolveTurn(c);
    assert.equal(c.status, "won");
  });
});

test("duo : défaite UNIQUEMENT si les DEUX héros sont K.O. (un seul K.O. continue)", () => {
  withSeed(9, () => {
    const c = duo(["ignar_emberheart"]);
    // A est à terre, B vivant : le combat continue (pas de défaite).
    c.heroes.A.hp = 0;
    submitIntent(c, "B", { skillId: "basic_attack", targetRef: c.enemies[0].uid });
    resolveTurn(c);
    assert.notEqual(c.status, "lost", "un seul héros K.O. ne perd pas le combat");
    assert.equal(livingHeroes(c).length >= 1, true);
    // Maintenant B tombe aussi -> défaite.
    c.heroes.A.hp = 0; c.heroes.B.hp = 1;
    let n = 0;
    while (c.status === "active" && n < 40) { resolveTurn(c); n++; }
    assert.equal(c.status, "lost");
  });
});

test("duo : la vue publique ne divulgue pas les sélections secrètes", () => {
  const c = duo(["feral_wolf"]);
  submitIntent(c, "A", { skillId: "basic_attack", targetRef: c.enemies[0].uid });
  const view = publicView(c);
  const v = JSON.stringify(view);
  // Le champ "pending" (intentions secrètes) ne doit pas apparaître dans la vue publique.
  assert.ok(!v.includes('"pending"'), "l'objet pending (intentions secrètes) n'est pas exposé");
  // La liste de compétences disponibles (skills) est publique et attendue dans la vue.
  assert.ok(view.heroes.A.skills && view.heroes.A.skills.length > 0, "la liste de compétences est exposée");
  assert.ok(v.includes("turnOrderPreview"), "l'ordre prévu (Clairvoyance) est exposé");
});

test("duo : déterminisme — même graine, même issue", () => {
  const run = () => withSeed(2024, () => {
    const c = duo(["feral_wolf", "goblin_raider"]);
    let n = 0;
    while (c.status === "active" && n < 80) {
      const e = livingEnemies(c)[0];
      submitIntent(c, "A", { skillId: "basic_attack", targetRef: e && e.uid });
      submitIntent(c, "B", { skillId: "basic_attack", targetRef: e && e.uid });
      resolveTurn(c);
      n++;
    }
    return { status: c.status, turn: c.turn, a: c.heroes.A.hp, b: c.heroes.B.hp };
  });
  assert.deepEqual(run(), run());
});
