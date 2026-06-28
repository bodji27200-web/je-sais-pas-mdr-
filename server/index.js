// Point d'entrée du serveur de coop : relie le transport WebSocket (server/ws.js)
// au hub autoritaire (server/coopServer.js). Démarrage : `node server/index.js`
// (variable d'env PORT, défaut 8080). Déployable tel quel sur Render / Railway /
// Fly.io (palier gratuit suffit pour du tour par tour ; voir server/README.md).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createWsServer } from "./ws.js";
import { CoopHub } from "./coopServer.js";

const PORT = Number(process.env.PORT) || 8080;
const __dir = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dir, "session.json");

// Le hub envoie via le socket correspondant au connId.
const sockets = new Map(); // connId -> ws api
const hub = new CoopHub((connId, message) => {
  const ws = sockets.get(connId);
  if (ws) ws.send(message);
});

// --- Persistance légère des comptes (accounts + tokens) ----------------------
// Les salons sont éphémères (perdus au redémarrage), mais les comptes invité
// survivent : le client peut se reconnecter avec son token sauvegardé.
function saveSession() {
  try {
    writeFileSync(SESSION_FILE, JSON.stringify({
      accounts: Array.from(hub.accounts.entries()),
      tokens: Array.from(hub.tokens.entries()),
    }));
  } catch (e) { console.error("[coop] erreur sauvegarde session:", e.message); }
}

function loadSession() {
  try {
    const d = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
    if (d.accounts) for (const [k, v] of d.accounts) hub.accounts.set(k, v);
    if (d.tokens) for (const [k, v] of d.tokens) hub.tokens.set(k, v);
    console.log(`[coop] session restaurée : ${hub.accounts.size} compte(s)`);
  } catch { /* pas de fichier session, premier démarrage */ }
}

loadSession();
setInterval(saveSession, 60_000);
process.on("SIGINT", () => { saveSession(); process.exit(0); });
process.on("SIGTERM", () => { saveSession(); process.exit(0); });

// --- Transport WebSocket -----------------------------------------------------
createWsServer({
  port: PORT,
  onConnection(ws) {
    sockets.set(ws.id, ws);
    hub.connect(ws.id);
    ws.onMessage((msg) => {
      try { hub.onMessage(ws.id, msg); }
      catch (e) { ws.send({ type: "error", payload: { code: "SERVER_ERROR", message: String(e && e.message || e) } }); }
    });
    ws.onClose(() => { hub.disconnect(ws.id); sockets.delete(ws.id); });
  },
});

console.log(`[coop] serveur WebSocket autoritaire en écoute sur :${PORT} (health: /health)`);
