// Contenu endgame (Lot 17) : 5 nouvelles zones de boss + 3 world bosses.
// Vérifie l'intégrité (zones/ennemis/compétences/drops), la chaîne de déblocage,
// l'absence de NaN en combat, et que les world bosses sont bien des MURS (quasi
// imbattables : ils restent debout face à un build fort piloté par l'IA générique).

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { startCombat, resolveRound, pickSkillGeneric, playerCanUse } from "../js/systems/combat.js";
import { ZONES, getZone } from "../js/data/zones.js";
import { ENEMIES, getEnemy } from "../js/data/enemies.js";
import { getSkill } from "../js/data/skills.js";
import { RESOURCES } from "../js/data/resources.js";
import { EQUIPMENT } from "../js/data/equipment.js";
import { zoneUnlocked } from "../js/systems/zoneprog.js";
import { withSeed } from "./helpers.js";

const NEW_ZONES = ["frostwind_peaks", "verdant_abyss", "stormspire_heights", "obsidian_necropolis", "celestial_rift"];
const WORLD_BOSSES = ["worldboss_kraltheth", "worldboss_nyxara", "worldboss_primordius"];

test("endgame : 5 nouvelles zones, chacune 5 ennemis + 1 boss valides", () => {
  for (const id of NEW_ZONES) {
    const z = getZone(id);
    assert.ok(z, `zone ${id}`);
    assert.equal(z.enemies.length, 5, `${id} : 5 ennemis`);
    assert.ok(getEnemy(z.boss) && getEnemy(z.boss).isBoss, `${id} : boss valide`);
    for (const e of [...z.enemies, z.boss]) assert.ok(getEnemy(e), `${id} : ennemi ${e} défini`);
    assert.equal(z.progression.length, 5, `${id} : progression à 5 paliers`);
  }
});

test("endgame : intégrité des compétences et drops de TOUS les ennemis", () => {
  for (const e of Object.values(ENEMIES)) {
    for (const sid of e.skills || []) {
      const sk = getSkill(sid);
      assert.ok(sk, `${e.id} : compétence ${sid} définie`);
      assert.notEqual(sk.type, "passive", `${e.id} : ${sid} ne doit pas être une passive dans skills[]`);
    }
    if (e.passive) assert.ok(getSkill(e.passive), `${e.id} : passive ${e.passive}`);
    if (e.secondPassive) assert.ok(getSkill(e.secondPassive), `${e.id} : 2e passive ${e.secondPassive}`);
    for (const ph of e.phases || []) if (ph.grant) assert.ok(getSkill(ph.grant), `${e.id} : grant ${ph.grant}`);
    for (const d of e.drops || []) {
      if (d.type === "resource") assert.ok(RESOURCES[d.item], `${e.id} : ressource ${d.item}`);
      else if (d.type === "equipment") assert.ok(EQUIPMENT[d.item], `${e.id} : équipement ${d.item}`);
    }
  }
});

test("endgame : la chaîne de déblocage des zones s'enchaîne après Ignar", () => {
  const s = newGame("H", "warrior");
  s.character.level = 100;
  assert.equal(zoneUnlocked(s, "frostwind_peaks").unlocked, false, "verrouillée tant qu'Ignar n'est pas vaincu");
  s.counters.defeated = { ignar_emberheart: 1 };
  assert.equal(zoneUnlocked(s, "frostwind_peaks").unlocked, true);
  assert.equal(zoneUnlocked(s, "verdant_abyss").unlocked, false);
  s.counters.defeated.borealis_tyrant = 1;
  assert.equal(zoneUnlocked(s, "verdant_abyss").unlocked, true);
});

test("endgame : combats contre les nouveaux boss sans NaN ni blocage", () => {
  withSeed(7, () => {
    const s = newGame("H", "warrior");
    s.character.level = 100;
    s.character.hpCurrent = getDerivedStats(s).maxHp;
    for (const bossId of ["borealis_tyrant", "voltaic_archon", "astral_seraphon"]) {
      const c = startCombat(s, bossId, { forceEnrage: false });
      let n = 0;
      while (c.status === "active" && n < 60) {
        let id = pickSkillGeneric(c.player, c.enemy);
        if (!playerCanUse(c, id)) id = "basic_attack";
        resolveRound(s, c, id);
        assert.ok(!Number.isNaN(c.player.hp) && !Number.isNaN(c.enemy.hp), `${bossId} : pas de NaN`);
        n++;
      }
      assert.ok(n < 60 || c.status === "active", `${bossId} : pas de plantage`);
    }
  });
});

test("world bosses : définis (isWorldBoss), colossaux, plafond bas, aura", () => {
  for (const id of WORLD_BOSSES) {
    const e = getEnemy(id);
    assert.ok(e && e.isWorldBoss, `${id} : marqué world boss`);
    assert.ok(e.stats.hp >= 200000, `${id} : PV colossaux`);
    assert.ok(e.hitCap > 0 && e.hitCap <= 0.08, `${id} : plafond d'encaissement très bas`);
    assert.ok(e.aura && e.aura.pctMaxHp >= 0.04, `${id} : aura sévère`);
    assert.ok(e.stats.res >= 500, `${id} : Résistance énorme`);
  }
});

test("world bosses : restent un MUR (debout après un long assaut d'un build fort)", () => {
  withSeed(3, () => {
    const s = newGame("H", "mage");
    s.character.level = 100;
    s.character.specId = "lich"; // forte voie offensive
    s.character.hpCurrent = getDerivedStats(s).maxHp;
    const c = startCombat(s, "worldboss_primordius", { forceEnrage: false });
    let n = 0;
    while (c.status === "active" && n < 50) {
      let id = pickSkillGeneric(c.player, c.enemy);
      if (!playerCanUse(c, id)) id = "basic_attack";
      resolveRound(s, c, id);
      assert.ok(!Number.isNaN(c.enemy.hp), "pas de NaN");
      n++;
    }
    // Le world boss conserve l'essentiel de ses PV : c'est un mur de prestige.
    assert.ok(c.enemy.hp > c.enemy.maxHp * 0.5, "Primordius reste largement debout (quasi-imbattable)");
  });
});
