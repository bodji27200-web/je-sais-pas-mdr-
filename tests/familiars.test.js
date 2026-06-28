// Tests Lot 16 — familiers COMBATTANTS (refonte) + invocations.
// Éclosion, doublons->essence, équipement, lien, XP plafonnée, familier sur le
// terrain (sans PV, IA propre), invocations limitées, plafonds, rôles distincts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { startCombat, resolveRound, buildPlayerCombatant, playerCanUse } from "../js/systems/combat.js";
import {
  rollFamiliar, hatchEgg, equipFamiliar, feedFamiliar,
  gainEquippedFamiliarXp, familiarLevelCap, addEgg,
  buildFamiliarCombatant, familiarCombatStats, chooseFamiliarSkill, buildSummonCombatant,
} from "../js/systems/familiars.js";
import { FAMILIARS, getFamiliar, FEED_ESSENCE_COST, LINK_MAX, familiarsByRarity, familiarStars, FAMILIAR_REGEN_CAP } from "../js/data/familiars.js";
import { withSeed } from "./helpers.js";

function fresh() {
  const s = newGame("Dompteur", "mage");
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

test("nouvelle partie : structure familiers + œuf commun offert", () => {
  const s = fresh();
  assert.equal(s.familiars.eggs.common, 1);
  assert.equal(s.familiars.equipped, null);
});

test("rollFamiliar reste borné aux raretés de l'œuf", () => {
  withSeed(7, () => {
    for (let i = 0; i < 300; i++) {
      const r = getFamiliar(rollFamiliar("rare")).rarity;
      assert.ok(["uncommon", "rare", "epic"].includes(r), `rareté inattendue: ${r}`);
    }
  });
});

test("éclosion : nouveau -> ajouté & équipé ; doublon -> Essence", () => {
  withSeed(4, () => {
    const s = fresh();
    const r = hatchEgg(s, "common");
    assert.equal(r.ok, true);
    assert.ok(s.familiars.owned[r.id]);
    assert.equal(s.familiars.equipped, r.id);
  });
  const s = fresh();
  for (const id of Object.keys(FAMILIARS)) s.familiars.owned[id] = { level: 1, xp: 0, link: 0 };
  addEgg(s, "epic", 1);
  const before = s.familiars.essence;
  const r = withSeed(2, () => hatchEgg(s, "epic"));
  assert.equal(r.duplicate, true);
  assert.ok(s.familiars.essence > before);
});

test("équiper bascule ; nourrir consomme l'Essence et monte le lien", () => {
  const s = fresh();
  s.familiars.owned["ember_sprite"] = { level: 1, xp: 0, link: 0 };
  assert.equal(equipFamiliar(s, "ember_sprite").ok, true);
  equipFamiliar(s, "ember_sprite");
  assert.equal(s.familiars.equipped, null);
  assert.equal(feedFamiliar(s, "ember_sprite").ok, false);
  s.familiars.essence = FEED_ESSENCE_COST;
  assert.equal(feedFamiliar(s, "ember_sprite").ok, true);
  assert.equal(s.familiars.owned["ember_sprite"].link, 1);
});

test("l'XP du familier est plafonnée au niveau du héros", () => {
  const s = fresh();
  s.character.level = 3;
  s.familiars.owned["spark_mote"] = { level: 1, xp: 0, link: 0 };
  s.familiars.equipped = "spark_mote";
  gainEquippedFamiliarXp(s, 100000);
  assert.ok(s.familiars.owned["spark_mote"].level <= familiarLevelCap(s));
});

test("au moins 3 familiers par rareté (Commun -> Légendaire)", () => {
  for (const r of ["common", "uncommon", "rare", "epic", "legendary"]) {
    assert.ok(familiarsByRarity(r).length >= 3, `rareté ${r} : ${familiarsByRarity(r).length} (< 3)`);
  }
});

test("familiers : compétences DISTINCTES (pas deux fois le même effet)", () => {
  const seen = new Map();
  for (const f of Object.values(FAMILIARS)) {
    const sig = JSON.stringify([...f.skills].sort());
    assert.ok(!seen.has(sig), `${f.id} a exactement les mêmes compétences que ${seen.get(sig)}`);
    seen.set(sig, f.id);
    assert.ok(f.skills && f.skills.length >= 1, `${f.id} doit avoir au moins une compétence`);
  }
});

test("étoiles : base de rareté, +1 au lien max (plafonné)", () => {
  assert.equal(familiarStars(getFamiliar("pebble_mite"), { link: 0 }), 1);
  assert.equal(familiarStars(getFamiliar("chaos_orbling"), { link: 0 }), 5);
  assert.equal(familiarStars(getFamiliar("chaos_orbling"), { link: LINK_MAX }), 6);
});

test("le familier équipé est un COMBATTANT (sans PV) qui agit via sa propre IA", () => {
  const s = fresh();
  s.character.level = 8;
  s.familiars.owned["ember_sprite"] = { level: 8, xp: 0, link: 5 };
  s.familiars.equipped = "ember_sprite";
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const c = startCombat(s, "feral_wolf", { forceEnrage: false });
  assert.equal(c.allies.length, 1);
  const ally = c.allies[0];
  assert.equal(ally.kind, "familiar");
  assert.equal(ally.hp, undefined, "un familier n'a pas de PV");
  assert.ok(ally.atk > 0 && ally.skills.length > 0);
  assert.ok(c.player.familiar && c.player.familiar.id === "ember_sprite");
  assert.ok(ally.skills.includes(chooseFamiliarSkill(ally, c)));
  resolveRound(s, c, "basic_attack");
  assert.ok(c.enemy.hp <= c.enemy.maxHp);
});

test("plafond : atk de familier bornée par rapport au niveau du héros", () => {
  const cs = familiarCombatStats(getFamiliar("chaos_orbling"), { level: 100, link: LINK_MAX }, 100);
  assert.ok(cs.atk <= 100 * 2.4 + 25 + 1, `atk plafonnée (${cs.atk})`);
});

test("invocation : Invocateur=1 temporaire, Nécromancien=2 permanents (sans PV)", () => {
  const s = newGame("Inv", "mage");
  s.character.level = 30;
  s.character.specId = "mage_summoner";
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const p = buildPlayerCombatant(s);
  assert.equal(p.summonCap, 1);
  assert.equal(p.summonPermanent, false);

  s.character.specId = "necromancer";
  const p2 = buildPlayerCombatant(s);
  assert.equal(p2.summonCap, 2);
  assert.equal(p2.summonPermanent, true);
  const skel = buildSummonCombatant("sm_skeleton", p2, 30);
  assert.equal(skel.ttl, Infinity);
  assert.equal(skel.hp, undefined);
});

test("invocation : le nombre d'invocations ne dépasse jamais la limite du nœud", () => {
  const s = newGame("Inv", "mage");
  s.character.level = 30;
  s.character.specId = "mage_summoner";
  s.character.library = { learned: [], equipped: [] };
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const c = startCombat(s, "feral_wolf", { forceEnrage: false });
  for (let i = 0; i < 12 && c.status === "active"; i++) {
    const id = playerCanUse(c, "summon_arcane_wisp") ? "summon_arcane_wisp" : "basic_attack";
    resolveRound(s, c, id);
  }
  const summons = c.allies.filter((a) => a.kind === "summon");
  assert.ok(summons.length <= 1, `invocations plafonnées à 1 (obtenu ${summons.length})`);
});

test("soin de familier plafonné très bas (instr.)", () => {
  assert.ok(FAMILIAR_REGEN_CAP <= 0.03 + 1e-9);
  const s = fresh();
  s.character.level = 20;
  s.familiars.owned["dawn_seraph"] = { level: 20, xp: 0, link: LINK_MAX };
  s.familiars.equipped = "dawn_seraph";
  s.character.hpCurrent = 1;
  const c = startCombat(s, "feral_wolf", { forceEnrage: false });
  const maxHp = c.player.maxHp;
  resolveRound(s, c, "basic_attack");
  assert.ok(c.player.hp - 1 <= Math.ceil(maxHp * FAMILIAR_REGEN_CAP) + 3, "soin de familier borné");
});
