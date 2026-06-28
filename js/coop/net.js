// Client réseau de la coop en ligne. Le client est un TERMINAL : il envoie des
// intentions et affiche l'état AUTORITAIRE renvoyé par le serveur (server/*).
// Aucun calcul de jeu côté client (cf. docs/ARCHITECTURE-COOP-DUO.md §1).
//
// Usage :
//   const net = new CoopNet("wss://mon-serveur");
//   net.on("welcome", d => ...); net.on("room/state", d => ...); ...
//   net.connect().then(() => net.guest("Bodji"));
//   net.send("room/create");
//
// Le module n'a aucune dépendance ; il utilise l'API WebSocket du navigateur.

let _cmd = 0;
const newCommandId = () => `cmd_${Date.now().toString(36)}_${(++_cmd).toString(36)}`;

export class CoopNet {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.listeners = {};   // type -> [cb]
    this.token = null;
    this.accountId = null;
    this.connected = false;
  }

  on(type, cb) { (this.listeners[type] || (this.listeners[type] = [])).push(cb); return this; }
  _emit(type, payload) { for (const cb of this.listeners[type] || []) cb(payload); for (const cb of this.listeners["*"] || []) cb(type, payload); }

  connect() {
    return new Promise((resolve, reject) => {
      try { this.ws = new WebSocket(this.url); }
      catch (e) { return reject(e); }
      this.ws.onopen = () => { this.connected = true; resolve(); };
      this.ws.onerror = (e) => { this._emit("neterror", e); if (!this.connected) reject(e); };
      this.ws.onclose = () => { this.connected = false; this._emit("disconnected"); };
      this.ws.onmessage = (ev) => {
        let msg = null;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === "welcome" && msg.payload) { this.accountId = msg.payload.accountId; if (msg.payload.token) this.token = msg.payload.token; }
        this._emit(msg.type, msg.payload);
      };
    });
  }

  // Envoi d'une intention (enveloppe protocole §5 ; commandId pour l'idempotence).
  send(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify({ v: 1, type, commandId: newCommandId(), ts: Date.now(), payload }));
    return true;
  }

  // Raccourcis de haut niveau.
  guest(handle) { return this.send("guest", { handle }); }
  hello(token) { return this.send("hello", { token }); }
  createRoom() { return this.send("room/create"); }
  joinRoom(inviteCode) { return this.send("room/join", { inviteCode }); }
  ready(isReady, loadout) { return this.send("room/ready", { ready: isReady, loadout }); }
  leaveRoom() { return this.send("room/leave"); }
  startSession(mode, id) { return this.send("session/start", { mode, id }); }
  intent(skillId, targetRef) { return this.send("combat/intent", { skillId, targetRef }); }
  blessing(blessingId) { return this.send("combat/blessing", { blessingId }); }

  close() { try { this.ws && this.ws.close(); } catch {} }
}
