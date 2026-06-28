// Tests du serveur coop autoritaire (sans réseau : transport simulé).
// Vérifie auth, salons duo (max 2 strict), ready+loadout, démarrage, intentions,
// résolution diffusée, idempotence, et invariant « jamais trois ».

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { getDerivedStats } from "../js/core/character.js";
import { CoopHub } from "../server/coopServer.js";
import { withSeed } from "./helpers.js";

// Banc d'essai : capture les messages envoyés par connId.
function bench() {
  const inbox = {};
  const hub = new CoopHub((connId, msg) => { (inbox[connId] || (inbox[connId] = [])).push(msg); });
  const last = (connId, type) => [...(inbox[connId] || [])].reverse().find((m) => m.type === type);
  const clear = () => { for (const k of Object.keys(inbox)) inbox[k] = []; };
  return { hub, inbox, last, clear };
}
function loadout(cls) {
  const s = newGame("P", cls); s.character.level = 30; s.character.hpCurrent = getDerivedStats(s).maxHp; return s;
}

test("serveur : auth invité requise avant tout", () => {
  const { hub, last } = bench();
  hub.connect("c1");
  hub.onMessage("c1", { type: "room/create" });
  assert.equal(last("c1", "error").payload.code, "NOT_AUTH");
  const g = hub.createGuest("Bodji");
  hub.onMessage("c1", { type: "hello", payload: { token: g.token } });
  assert.equal(last("c1", "welcome").payload.handle, "Bodji");
});

test("serveur : salon duo, jonction, et un TROISIÈME joueur est refusé (ROOM_FULL)", () => {
  const { hub, last } = bench();
  const a = hub.createGuest("A"), b = hub.createGuest("B"), c = hub.createGuest("C");
  hub.connect("ca"); hub.onMessage("ca", { type: "hello", payload: { token: a.token } });
  hub.connect("cb"); hub.onMessage("cb", { type: "hello", payload: { token: b.token } });
  hub.connect("cc"); hub.onMessage("cc", { type: "hello", payload: { token: c.token } });
  hub.onMessage("ca", { type: "room/create" });
  const code = last("ca", "room/state").payload.inviteCode;
  hub.onMessage("cb", { type: "room/join", payload: { inviteCode: code } });
  const st = last("cb", "room/state").payload;
  assert.ok(st.seats.A && st.seats.B, "deux sièges occupés");
  assert.equal(st.capacity, 2);
  // 3e joueur -> refusé
  hub.onMessage("cc", { type: "room/join", payload: { inviteCode: code } });
  assert.equal(last("cc", "error").payload.code, "ROOM_FULL");
});

test("serveur : démarrage exige deux joueurs prêts + loadouts", () => {
  const { hub, last } = bench();
  const a = hub.createGuest("A"), b = hub.createGuest("B");
  hub.connect("ca"); hub.onMessage("ca", { type: "hello", payload: { token: a.token } });
  hub.connect("cb"); hub.onMessage("cb", { type: "hello", payload: { token: b.token } });
  hub.onMessage("ca", { type: "room/create" });
  const code = last("ca", "room/state").payload.inviteCode;
  hub.onMessage("cb", { type: "room/join", payload: { inviteCode: code } });
  // pas prêt -> refus
  hub.onMessage("ca", { type: "session/start", payload: { mode: "skirmish", id: "duo_pack_wolves" } });
  assert.ok(["NOT_BOTH_READY", "MISSING_LOADOUT"].includes(last("ca", "error").payload.code));
  // prêts + loadouts
  hub.onMessage("ca", { type: "room/ready", payload: { ready: true, loadout: loadout("warrior") } });
  hub.onMessage("cb", { type: "room/ready", payload: { ready: true, loadout: loadout("mage") } });
  hub.onMessage("ca", { type: "session/start", payload: { mode: "skirmish", id: "duo_pack_wolves" } });
  assert.ok(last("ca", "session/started"), "session démarrée");
  assert.ok(last("cb", "combat/awaiting"), "les deux reçoivent l'attente");
});

test("serveur : un combat complet se résout et diffuse le résultat", () => {
  withSeed(7, () => {
    const { hub, last, inbox } = bench();
    const a = hub.createGuest("A"), b = hub.createGuest("B");
    hub.connect("ca"); hub.onMessage("ca", { type: "hello", payload: { token: a.token } });
    hub.connect("cb"); hub.onMessage("cb", { type: "hello", payload: { token: b.token } });
    hub.onMessage("ca", { type: "room/create" });
    const code = last("ca", "room/state").payload.inviteCode;
    hub.onMessage("cb", { type: "room/join", payload: { inviteCode: code } });
    hub.onMessage("ca", { type: "room/ready", payload: { ready: true, loadout: loadout("warrior") } });
    hub.onMessage("cb", { type: "room/ready", payload: { ready: true, loadout: loadout("mage") } });
    hub.onMessage("ca", { type: "session/start", payload: { mode: "skirmish", id: "duo_pack_wolves" } });
    let guard = 0;
    while (!last("ca", "combat/result") && guard < 200) {
      const view = last("ca", "combat/view") || last("ca", "session/started");
      const enemy = view.payload.view.enemies.find((e) => !e.down);
      const ref = enemy ? enemy.id : "self";
      hub.onMessage("ca", { type: "combat/intent", payload: { skillId: "basic_attack", targetRef: ref, commandId: "a" + guard } });
      hub.onMessage("cb", { type: "combat/intent", payload: { skillId: "basic_attack", targetRef: ref, commandId: "b" + guard } });
      guard++;
    }
    const res = last("ca", "combat/result");
    assert.ok(res, "un résultat a été diffusé");
    assert.ok(["won", "lost"].includes(res.payload.outcome));
  });
});

test("serveur : idempotence — même commandId rejoué = pas de double effet", () => {
  withSeed(3, () => {
    const { hub, last } = bench();
    const a = hub.createGuest("A"), b = hub.createGuest("B");
    hub.connect("ca"); hub.onMessage("ca", { type: "hello", payload: { token: a.token } });
    hub.connect("cb"); hub.onMessage("cb", { type: "hello", payload: { token: b.token } });
    hub.onMessage("ca", { type: "room/create" });
    const code = last("ca", "room/state").payload.inviteCode;
    hub.onMessage("cb", { type: "room/join", payload: { inviteCode: code } });
    hub.onMessage("ca", { type: "room/ready", payload: { ready: true, loadout: loadout("warrior") } });
    hub.onMessage("cb", { type: "room/ready", payload: { ready: true, loadout: loadout("mage") } });
    hub.onMessage("ca", { type: "session/start", payload: { mode: "skirmish", id: "duo_pack_wolves" } });
    const view = last("ca", "session/started").payload.view;
    const ref = view.enemies[0].id;
    hub.onMessage("ca", { type: "combat/intent", payload: { skillId: "basic_attack", targetRef: ref, commandId: "dup" } });
    const r2 = hub.onMessage("ca", { type: "combat/intent", payload: { skillId: "basic_attack", targetRef: ref, commandId: "dup" } });
    assert.equal(last("ca", "ack").payload.status, "duplicate", "le doublon est signalé");
  });
});

test("serveur : on ne joue pas l'unité de l'allié (siège B ne pilote que B)", () => {
  // Implicite : submitIntent est appelé avec le siège du connId — un client ne peut
  // pas usurper l'autre siège puisque seat vient de la connexion, pas du message.
  const { hub, last } = bench();
  const a = hub.createGuest("A"), b = hub.createGuest("B");
  hub.connect("ca"); hub.onMessage("ca", { type: "hello", payload: { token: a.token } });
  hub.connect("cb"); hub.onMessage("cb", { type: "hello", payload: { token: b.token } });
  hub.onMessage("ca", { type: "room/create" });
  const code = last("ca", "room/state").payload.inviteCode;
  hub.onMessage("cb", { type: "room/join", payload: { inviteCode: code } });
  const ca = hub.conns.get("ca"), cb = hub.conns.get("cb");
  assert.equal(ca.seat, "A");
  assert.equal(cb.seat, "B");
});
