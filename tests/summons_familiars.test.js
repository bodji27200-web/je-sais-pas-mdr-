// Tests des DEUX systèmes d'alliés (instr.) :
//  - FAMILIER autonome : sans PV, non ciblable, choisit/lance des compétences ;
//  - INVOCATIONS : vraies unités (PV, ciblables, peuvent mourir), emplacements
//    strictement limités par la classe, remplacement propre, durée de vie.
// On vérifie aussi l'absence de double résolution / d'action après la mort, et
// l'absence de NaN.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { startCombat, resolveRound } from "../js/systems/combat.js";
import {
  equipFamiliar, equippedFamiliarBattle, familiarPosture, setFamiliarPosture,
} from "../js/systems/familiars.js";
import { FAM_SKILLS, defaultPosture, defaultFamSkills } from "../js/data/famskills.js";
import { getFamiliar } from "../js/data/familiars.js";
import { getSummon, SUMMONS } from "../js/data/summons.js";

// Donne un familier précis et l'équipe (déterministe, sans tirage d'œuf).
function withFamiliar(s, famId) {
  s.familiars.owned[famId] = { level: 5, xp: 0, link: 4 };
  s.familiars.equipped = famId;
  return s;
}
function freshMage(name = "Héros") {
  const s = newGame(name, "mage");
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

// ===========================================================================
// FAMILIER AUTONOME
// ===========================================================================
test("familier : un combattant allié autonome est créé au démarrage du combat", () => {
  const s = withFamiliar(freshMage(), "ember_sprite"); // offensif (Feu)
  const c = startCombat(s, "feral_wolf", { forceEnrage: false });
  assert.ok(c.ally, "combat.ally présent");
  assert.equal(c.ally.isFamiliar, true);
  assert.equal(c.ally.role, "offensif");
  assert.ok(Array.isArray(c.ally.famSkills) && c.ally.famSkills.length > 0, "kit non vide");
});

test("familier : aucun allié si aucun familier équipé", () => {
  const s = freshMage();
  s.familiars.equipped = null;
  const c = startCombat(s, "feral_wolf", { forceEnrage: false });
  assert.equal(c.ally, null);
});

test("familier : le familier agit réellement (≥1 action) sans gagner seul ni boucler", () => {
  const s = withFamiliar(freshMage(), "ember_sprite");
  const c = startCombat(s, "ignar_emberheart", { forceEnrage: false });
  s.character.level = 20;
  let famActions = 0, rounds = 0;
  while (c.status === "active" && rounds < 60) {
    resolveRound(s, c, "basic_attack");
    famActions += c.lastActions.filter((a) => a.actor === "familiar").length;
    // un familier n'agit jamais plus d'une fois par manche (anti-boucle)
    assert.ok(c.lastActions.filter((a) => a.actor === "familiar").length <= 1, "≤1 action de familier/manche");
    rounds++;
  }
  assert.ok(famActions >= 1, "le familier a agi au moins une fois");
  assert.ok(!Number.isNaN(c.player.hp), "pas de NaN sur les PV du héros");
});

test("familier : sans PV, jamais ciblable, ne meurt pas (pas dans la file d'unités)", () => {
  const s = withFamiliar(freshMage(), "thorn_cub");
  const c = startCombat(s, "feral_wolf", { forceEnrage: false });
  // l'allié n'apparaît ni comme joueur, ni comme ennemi, ni comme invocation
  assert.notEqual(c.ally, c.player);
  assert.notEqual(c.ally, c.enemy);
  assert.ok(!c.summons.includes(c.ally));
});

test("familier : posture par défaut dérivée du rôle, modifiable", () => {
  const s = withFamiliar(freshMage(), "dawn_seraph"); // soutien
  assert.equal(defaultPosture(getFamiliar("dawn_seraph")), "soutien");
  assert.equal(familiarPosture(s, "dawn_seraph"), "soutien");
  const r = setFamiliarPosture(s, "dawn_seraph", "agressif");
  assert.equal(r.ok, true);
  assert.equal(familiarPosture(s, "dawn_seraph"), "agressif");
  assert.equal(setFamiliarPosture(s, "dawn_seraph", "n_importe_quoi").ok, false);
});

test("familier soutien : soigne le héros blessé (plafonné, pas de remplacement du joueur)", () => {
  const s = withFamiliar(freshMage(), "dawn_seraph"); // soutien -> posture soutien
  s.character.level = 30;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const c = startCombat(s, "ignar_emberheart", { forceEnrage: false });
  let healed = false;
  for (let i = 0; i < 16 && c.status === "active"; i++) {
    c.player.hp = Math.round(c.player.maxHp * 0.4); // héros maintenu blessé mais vivant
    resolveRound(s, c, "basic_attack");
    if (c.log.some((l) => /soigne le héros/.test(l.text))) { healed = true; break; }
  }
  assert.ok(healed, "le familier soutien a soigné le héros blessé");
  // Le soin reste PLAFONNÉ : jamais plus de ~8 % des PV max en une fois.
  const m = c.log.find((l) => /soigne le héros de (\d+) PV/.exec(l.text));
  if (m) {
    const amt = parseInt(/de (\d+) PV/.exec(m.text)[1], 10);
    assert.ok(amt <= Math.ceil(c.player.maxHp * 0.085), "soin plafonné");
  }
});

test("familier : tout familier produit un kit de compétences (défaut par rôle)", () => {
  for (const fam of Object.values({ a: getFamiliar("pebble_mite"), b: getFamiliar("spark_mote"), c: getFamiliar("grave_wisp") })) {
    const kit = defaultFamSkills(fam);
    assert.ok(kit.length > 0, `${fam.id} a un kit`);
    for (const id of kit) assert.ok(FAM_SKILLS[id], `${id} existe`);
  }
});

// ===========================================================================
// INVOCATIONS
// ===========================================================================
function summonerState(specId, level = 30) {
  const s = freshMage("Invocateur");
  s.character.specId = specId;
  s.character.level = level;
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  return s;
}

test("invocation : la capacité d'emplacements vient du nœud équipé", () => {
  assert.equal(startCombat(summonerState("mage_summoner"), "feral_wolf", { forceEnrage: false }).summonCap, 1);
  assert.equal(startCombat(summonerState("mage_pactmaster"), "feral_wolf", { forceEnrage: false }).summonCap, 2);
  assert.equal(startCombat(summonerState("lich", 84), "feral_wolf", { forceEnrage: false }).summonCap, 3);
  // une classe non-invocateur ne peut pas invoquer
  assert.equal(startCombat(freshMage(), "feral_wolf", { forceEnrage: false }).summonCap, 0);
});

test("invocation : une compétence pose une VRAIE unité (PV, ciblable)", () => {
  const s = summonerState("mage_summoner");
  const c = startCombat(s, "ignar_emberheart", { forceEnrage: false });
  resolveRound(s, c, "summon_arcane_wisp");
  assert.equal(c.summons.length, 1);
  const sm = c.summons[0];
  assert.ok(sm.maxHp > 0 && sm.hp > 0, "PV réels");
  assert.ok(sm.isSummon && sm.fxId.startsWith("summon:"), "marquée comme invocation ciblable");
  assert.equal(sm.summonId, "sm_arcane_wisp");
});

test("invocation : la limite d'emplacements est stricte (remplacement FIFO)", () => {
  const s = summonerState("mage_summoner"); // cap 1
  const c = startCombat(s, "ignar_emberheart", { forceEnrage: false });
  resolveRound(s, c, "summon_arcane_wisp");
  const uid1 = c.summons[0].uid;
  // rendre l'invocation immédiatement relançable (coût + recharge)
  c.player.cooldowns = {};
  c.player.res.cur = c.player.res.max;
  resolveRound(s, c, "summon_arcane_wisp");
  assert.equal(c.summons.length, 1, "jamais au-dessus de la capacité");
  assert.notEqual(c.summons[0].uid, uid1, "l'ancienne a été remplacée proprement");
});

test("invocation : peut subir des dégâts et mourir, retirée proprement (pas d'action après la mort)", () => {
  const s = summonerState("mage_pactmaster");
  const c = startCombat(s, "ignar_emberheart", { forceEnrage: false });
  resolveRound(s, c, "summon_bone_thrall");
  assert.equal(c.summons.length, 1);
  // on tue l'invocation directement, puis on déroule une manche
  c.summons[0].hp = 0;
  resolveRound(s, c, "basic_attack");
  assert.equal(c.summons.length, 0, "l'invocation morte est retirée");
  assert.ok(c.log.some((l) => /détruit|se dissipe/.test(l.text)), "journalisée");
  assert.equal(c.status === "active" || c.status === "won", true);
});

test("invocation : durée de vie limitée (l'invocation temporaire se dissipe)", () => {
  const s = summonerState("mage_summoner");
  s.character.level = 10; // ne tue pas Ignar en une manche
  s.character.hpCurrent = getDerivedStats(s).maxHp;
  const c = startCombat(s, "ignar_emberheart", { forceEnrage: false });
  resolveRound(s, c, "summon_arcane_wisp");
  const ttl0 = getSummon("sm_arcane_wisp").ttl;
  assert.ok(ttl0 > 0);
  let dissipated = false;
  for (let i = 0; i < ttl0 + 3 && c.status === "active"; i++) {
    resolveRound(s, c, "basic_attack");
    if (c.summons.length === 0) { dissipated = true; break; }
  }
  assert.ok(dissipated, "l'invocation temporaire a fini par se dissiper");
});

test("invocation : combat d'invocateur complet sans blocage ni NaN", () => {
  const s = summonerState("mage_pactmaster", 40);
  const c = startCombat(s, "ignar_emberheart", { forceEnrage: false });
  let safety = 0;
  while (c.status === "active" && safety < 400) {
    const id = safety % 7 === 0 ? "summon_bone_thrall" : "basic_attack";
    resolveRound(s, c, id);
    assert.ok(!Number.isNaN(c.player.hp) && !Number.isNaN(c.enemy.hp), "pas de NaN");
    for (const sm of c.summons) assert.ok(!Number.isNaN(sm.hp), "pas de NaN sur invocation");
    safety++;
  }
  assert.ok(c.status === "won" || c.status === "lost", "le combat se termine");
  assert.ok(safety < 400, "pas de boucle infinie");
});

test("données : chaque invocation référencée par les nœuds existe", () => {
  for (const id of ["sm_arcane_wisp", "sm_bone_thrall", "sm_skeleton"]) {
    assert.ok(getSummon(id), `${id} défini`);
    assert.ok(SUMMONS[id].stats, `${id} a des stats dérivées`);
  }
});
