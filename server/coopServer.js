// Serveur de coop AUTORITAIRE (cœur logique, pur et testable).
//
// Réutilise le moteur duo (js/coop/*) : le serveur est l'unique source de vérité
// (cf. docs/ARCHITECTURE-COOP-DUO.md). Le transport (WebSocket) est séparé
// (server/ws.js) ; ici tout passe par un callback `send(connId, message)` injecté,
// ce qui rend le hub entièrement testable sans réseau.
//
// Invariant fort « jamais trois » : deux sièges NOMMÉS (A/B), pas de tableau.

import { createDuoCombat, submitIntent, resolveTurn, bothChosen, awaitingSeats, publicView } from "../js/coop/duoCombat.js";
import { createDuoDungeon, syncDungeon, chooseBlessing, skipBlessing } from "../js/coop/duoDungeon.js";
import { DUO_SKIRMISHES } from "../js/ui/coopViews.js";

let _id = 0;
const uid = (p) => `${p}_${(++_id).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const SEATS = ["A", "B"];

export class CoopHub {
  constructor(send) {
    this.send = send || (() => {}); // send(connId, messageObject)
    this.tokens = new Map();   // token -> accountId
    this.accounts = new Map(); // accountId -> { handle }
    this.rooms = new Map();    // roomId -> room
    this.codes = new Map();    // inviteCode -> roomId
    this.conns = new Map();    // connId -> { accountId, roomId, seat }
  }

  // --- Comptes (mode invité MVP) --------------------------------------------
  createGuest(handle) {
    const accountId = uid("acc");
    const token = uid("tok");
    this.accounts.set(accountId, { handle: handle || "Invité" });
    this.tokens.set(token, accountId);
    return { token, accountId, handle: this.accounts.get(accountId).handle };
  }

  // --- Cycle d'une connexion -------------------------------------------------
  connect(connId) { this.conns.set(connId, { accountId: null, roomId: null, seat: null }); }
  disconnect(connId) {
    const c = this.conns.get(connId);
    if (c && c.roomId) this._leave(connId);
    this.conns.delete(connId);
  }

  _err(connId, code, message) { this.send(connId, { type: "error", payload: { code, message: message || code } }); }
  _ack(connId, commandId, status = "accepted") { if (commandId) this.send(connId, { type: "ack", payload: { commandId, status } }); }

  // Point d'entrée : un message client -> effets serveur.
  onMessage(connId, msg) {
    if (!this.conns.has(connId)) this.connect(connId);
    const conn = this.conns.get(connId);
    const { type, payload = {} } = msg || {};
    // commandId au niveau de l'enveloppe (protocole §5), avec repli sur le payload
    // pour tolérer les clients qui l'y placent.
    const commandId = (msg && msg.commandId !== undefined) ? msg.commandId : payload.commandId;
    // `hello` (jeton existant) et `guest` (création + auth immédiate) sont les seuls
    // messages acceptés sans authentification préalable.
    if (type === "hello") {
      const accountId = this.tokens.get(payload.token);
      if (!accountId) return this._err(connId, "BAD_TOKEN");
      conn.accountId = accountId;
      this._ack(connId, commandId);
      return this.send(connId, { type: "welcome", payload: { accountId, handle: this.accounts.get(accountId).handle } });
    }
    if (type === "guest") {
      const g = this.createGuest(payload.handle);
      conn.accountId = g.accountId;
      this._ack(connId, commandId);
      return this.send(connId, { type: "welcome", payload: { accountId: g.accountId, handle: g.handle, token: g.token } });
    }
    if (!conn.accountId) return this._err(connId, "NOT_AUTH");

    switch (type) {
      case "room/create": return this._create(connId, commandId);
      case "room/join": return this._join(connId, payload, commandId);
      case "room/ready": return this._ready(connId, payload, commandId);
      case "room/leave": this._leave(connId); return this._ack(connId, commandId);
      case "session/start": return this._start(connId, payload, commandId);
      case "combat/intent": return this._intent(connId, payload, commandId);
      case "combat/blessing": return this.chooseBlessing(connId, payload.blessingId, commandId);
      default: return this._err(connId, "UNKNOWN_TYPE", type);
    }
  }

  // --- Salons ----------------------------------------------------------------
  _create(connId, commandId) {
    const conn = this.conns.get(connId);
    if (conn.roomId) return this._err(connId, "ALREADY_IN_ROOM");
    const roomId = uid("room");
    const inviteCode = uid("AETH").toUpperCase().slice(0, 9);
    const room = {
      roomId, inviteCode, capacity: 2, phase: "lobby",
      seats: { A: this._seat(conn.accountId, connId), B: null },
      session: null, dungeon: null,
    };
    this.rooms.set(roomId, room);
    this.codes.set(inviteCode, roomId);
    conn.roomId = roomId; conn.seat = "A";
    this._ack(connId, commandId);
    this._broadcastRoom(room);
  }

  _seat(accountId, connId) {
    return { accountId, connId, handle: this.accounts.get(accountId)?.handle || "?", ready: false, loadout: null };
  }

  _join(connId, payload, commandId) {
    const conn = this.conns.get(connId);
    if (conn.roomId) return this._err(connId, "ALREADY_IN_ROOM");
    const roomId = this.codes.get((payload.inviteCode || "").toUpperCase());
    const room = roomId && this.rooms.get(roomId);
    if (!room) return this._err(connId, "ROOM_NOT_FOUND");
    // Prise de siège ATOMIQUE (mono-thread Node : pas de course) — sinon ROOM_FULL.
    if (room.seats.B) return this._err(connId, "ROOM_FULL");
    if (room.seats.A && room.seats.A.accountId === conn.accountId) return this._err(connId, "ALREADY_SEATED");
    room.seats.B = this._seat(conn.accountId, connId);
    conn.roomId = room.roomId; conn.seat = "B";
    this._ack(connId, commandId);
    this._broadcastRoom(room);
  }

  _leave(connId) {
    const conn = this.conns.get(connId);
    const room = conn && conn.roomId && this.rooms.get(conn.roomId);
    if (!room) return;
    if (conn.seat && room.seats[conn.seat]) room.seats[conn.seat] = null;
    conn.roomId = null; conn.seat = null;
    if (!room.seats.A && !room.seats.B) { this.codes.delete(room.inviteCode); this.rooms.delete(room.roomId); }
    else { room.phase = "lobby"; room.session = null; room.dungeon = null; this._broadcastRoom(room); }
  }

  _ready(connId, payload, commandId) {
    const { room, seat } = this._ctx(connId);
    if (!room) return this._err(connId, "NOT_IN_ROOM");
    room.seats[seat].ready = !!payload.ready;
    if (payload.loadout) room.seats[seat].loadout = payload.loadout; // sauvegarde poussée (§12)
    this._ack(connId, commandId);
    this._broadcastRoom(room);
  }

  // --- Démarrage d'une session ----------------------------------------------
  _start(connId, payload, commandId) {
    const { room, seat } = this._ctx(connId);
    if (!room) return this._err(connId, "NOT_IN_ROOM");
    if (seat !== "A") return this._err(connId, "NOT_LEADER"); // seul l'hôte lance
    if (!room.seats.A || !room.seats.B) return this._err(connId, "NEED_TWO_PLAYERS");
    if (!room.seats.A.ready || !room.seats.B.ready) return this._err(connId, "NOT_BOTH_READY");
    const la = room.seats.A.loadout, lb = room.seats.B.loadout;
    if (!la || !lb) return this._err(connId, "MISSING_LOADOUT");

    if (payload.mode === "dungeon") {
      room.dungeon = createDuoDungeon(la, lb, payload.id, { forceEnrage: false });
      if (!room.dungeon) return this._err(connId, "BAD_DUNGEON");
      room.session = room.dungeon.combat;
    } else {
      const sk = DUO_SKIRMISHES[payload.id];
      if (!sk) return this._err(connId, "BAD_SKIRMISH");
      room.session = createDuoCombat(la, lb, { enemies: sk.enemies }, { forceEnrage: false });
      room.dungeon = null;
    }
    room.phase = room.dungeon ? "in_dungeon" : "in_combat";
    this._ack(connId, commandId);
    this._broadcastSession(room, "session/started");
    this._broadcastAwaiting(room);
  }

  // --- Intentions de combat --------------------------------------------------
  _intent(connId, payload, commandId) {
    const { room, seat } = this._ctx(connId);
    if (!room || !room.session) return this._err(connId, "NO_SESSION");
    const r = submitIntent(room.session, seat, { skillId: payload.skillId, targetRef: payload.targetRef, commandId });
    if (!r.ok) return this._err(connId, r.error);
    this._ack(connId, commandId, r.status);
    if (bothChosen(room.session)) this._resolve(room);
    else this._broadcastAwaiting(room);
  }

  _resolve(room) {
    const res = resolveTurn(room.session);
    // Diffuse la résolution (journal + effets) puis l'état.
    for (const seat of SEATS) {
      const conn = room.seats[seat] && room.seats[seat].connId;
      if (conn) this.send(conn, { type: "combat/resolution", payload: { log: res.log, fx: res.fx } });
    }
    if (room.dungeon) {
      const s = syncDungeon(room.dungeon);
      room.session = room.dungeon.combat;
      if (s.status === "blessing_offered") {
        this._broadcastSession(room, "combat/blessing", { options: s.options });
        return; // on attend un choix de bénédiction (hôte)
      }
    }
    this._broadcastSession(room, "combat/view");
    const st = room.session.status;
    if (st === "won" || st === "lost") {
      this._broadcastSession(room, "combat/result", { outcome: st });
      room.phase = "lobby";
    } else {
      this._broadcastAwaiting(room);
    }
  }

  // --- Diffusion -------------------------------------------------------------
  _ctx(connId) {
    const conn = this.conns.get(connId);
    const room = conn && conn.roomId && this.rooms.get(conn.roomId);
    return { conn, room, seat: conn && conn.seat };
  }
  _roomState(room) {
    const pub = (s) => s ? { accountId: s.accountId, handle: s.handle, ready: s.ready, hasLoadout: !!s.loadout } : null;
    return { roomId: room.roomId, inviteCode: room.inviteCode, phase: room.phase, capacity: 2, seats: { A: pub(room.seats.A), B: pub(room.seats.B) } };
  }
  _broadcastRoom(room) {
    const state = this._roomState(room);
    for (const seat of SEATS) { const s = room.seats[seat]; if (s) this.send(s.connId, { type: "room/state", payload: state }); }
  }
  _broadcastSession(room, type, extra = {}) {
    if (!room.session) return;
    const view = publicView(room.session);
    for (const seat of SEATS) {
      const s = room.seats[seat];
      if (s) this.send(s.connId, { type, payload: { view, dungeon: room.dungeon ? { waveIndex: room.dungeon.waveIndex, status: room.dungeon.status } : null, ...extra } });
    }
  }
  _broadcastAwaiting(room) {
    const need = awaitingSeats(room.session);
    for (const seat of SEATS) { const s = room.seats[seat]; if (s) this.send(s.connId, { type: "combat/awaiting", payload: { needFrom: need } }); }
  }

  // Choix de bénédiction (hôte) en donjon.
  chooseBlessing(connId, blessingId, commandId) {
    const { room, seat } = this._ctx(connId);
    if (!room || !room.dungeon) return this._err(connId, "NO_DUNGEON");
    if (seat !== "A") return this._err(connId, "NOT_LEADER");
    const r = blessingId ? chooseBlessing(room.dungeon, blessingId) : skipBlessing(room.dungeon);
    if (!r.ok) return this._err(connId, r.error || "INVALID_BLESSING");
    room.session = room.dungeon.combat;
    this._ack(connId, commandId);
    this._broadcastSession(room, "combat/view");
    this._broadcastAwaiting(room);
  }
}
