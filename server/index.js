// Point d'entrée du serveur de coop : relie le transport WebSocket (server/ws.js)
// au hub autoritaire (server/coopServer.js). Démarrage : `node server/index.js`
// (variable d'env PORT, défaut 8080). Déployable tel quel sur Render / Railway /
// Fly.io (palier gratuit suffit pour du tour par tour ; voir server/README.md).

import { createWsServer } from "./ws.js";
import { CoopHub } from "./coopServer.js";

const PORT = Number(process.env.PORT) || 8080;

// Le hub envoie via le socket correspondant au connId.
const sockets = new Map(); // connId -> ws api
const hub = new CoopHub((connId, message) => {
  const ws = sockets.get(connId);
  if (ws) ws.send(message);
});

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
