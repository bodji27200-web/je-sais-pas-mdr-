// Serveur WebSocket MINIMAL (RFC 6455), ZÉRO dépendance — suffisant pour un jeu
// tour par tour (messages JSON texte, faible débit). Gère le handshake, les trames
// texte (masquées côté client), le ping/pong et la fermeture. Pas de fragmentation
// ni de compression (inutile ici). Voir server/index.js pour le branchement au hub.

import http from "node:http";
import crypto from "node:crypto";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function accept(key) {
  return crypto.createHash("sha1").update(key + GUID).digest("base64");
}

// Encode une trame texte serveur->client (non masquée).
function encodeText(str) {
  const data = Buffer.from(str, "utf8");
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6);
  }
  return Buffer.concat([header, data]);
}

// Crée le serveur. `onConnection(socketApi)` reçoit { id, send, close, onMessage(cb), onClose(cb) }.
export function createWsServer({ port = 8080, onConnection, healthPath = "/health" } = {}) {
  let nextId = 0;
  const server = http.createServer((req, res) => {
    if (req.url === healthPath) { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok"); return; }
    res.writeHead(426, { "Content-Type": "text/plain" }); res.end("Upgrade Required");
  });

  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (!key) { socket.destroy(); return; }
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept(key)}\r\n\r\n`
    );

    const id = "conn_" + (++nextId);
    let buf = Buffer.alloc(0);
    const msgCbs = []; const closeCbs = [];
    const api = {
      id,
      send: (obj) => { try { socket.write(encodeText(typeof obj === "string" ? obj : JSON.stringify(obj))); } catch { /* socket fermé */ } },
      close: () => { try { socket.end(); } catch {} },
      onMessage: (cb) => msgCbs.push(cb),
      onClose: (cb) => closeCbs.push(cb),
    };

    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      // Décode autant de trames complètes que possible.
      while (buf.length >= 2) {
        const opcode = buf[0] & 0x0f;
        const masked = (buf[1] & 0x80) !== 0;
        let len = buf[1] & 0x7f;
        let offset = 2;
        if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); offset = 4; }
        else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); offset = 10; }
        const maskLen = masked ? 4 : 0;
        if (buf.length < offset + maskLen + len) break; // trame incomplète
        const mask = masked ? buf.slice(offset, offset + 4) : null;
        const payload = buf.slice(offset + maskLen, offset + maskLen + len);
        if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
        buf = buf.slice(offset + maskLen + len);

        if (opcode === 0x8) { closeCbs.forEach((cb) => cb()); try { socket.end(); } catch {} return; } // close
        if (opcode === 0x9) { socket.write(Buffer.from([0x8a, 0])); continue; } // ping -> pong
        if (opcode === 0xa) continue; // pong
        if (opcode === 0x1) { // texte
          let obj = null;
          try { obj = JSON.parse(payload.toString("utf8")); } catch { obj = null; }
          if (obj) msgCbs.forEach((cb) => cb(obj));
        }
      }
    });
    const onEnd = () => closeCbs.forEach((cb) => cb());
    socket.on("close", onEnd);
    socket.on("error", () => { try { socket.destroy(); } catch {} });

    if (onConnection) onConnection(api);
  });

  server.listen(port);
  return server;
}
