// Vues de la coop EN LIGNE (à distance). L'état vient entièrement du serveur ;
// ce module ne fait que rendre du HTML. Toutes les actions utilisent data-act="net-*".

import { getSkill } from "../data/skills.js";
import { DUNGEONS } from "../data/dungeons.js";
import { DUO_SKIRMISHES } from "./coopViews.js";
import { CLASSES } from "../data/classes.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
const pctw = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);

// --- Accueil / connexion -----------------------------------------------------
export function renderOnlineHome(ol) {
  if (ol.phase === "connecting") {
    return `<section class="panel"><p class="muted" style="text-align:center;padding:2rem">Connexion au serveur…</p></section>`;
  }
  const serverUrl = ol.serverUrl || "ws://localhost:8080";
  const err = ol.error ? `<p class="net-error">${esc(ol.error)}</p>` : "";
  return `
    <section class="panel">
      <h3 class="section-title">Coop en ligne — À distance</h3>
      <p class="muted small">Joue avec un·e ami·e depuis n'importe où. Créez une partie ou rejoignez avec le code partagé.</p>
      <div class="net-server-row">
        <span class="muted small">Serveur :</span>
        <input id="net-server-url" class="net-url-input" type="text" value="${esc(serverUrl)}" placeholder="wss://ton-serveur.onrender.com">
      </div>
      ${err}
      <div class="duo-content-grid" style="margin-top:1rem">
        <button class="duo-content-card" data-act="net-create">
          <strong>Créer une partie</strong>
          <span class="muted small">Tu reçois un code à partager à ton ami·e</span>
        </button>
        <button class="duo-content-card" data-act="net-join-prompt">
          <strong>Rejoindre</strong>
          <span class="muted small">Entre le code reçu par ton ami·e</span>
        </button>
      </div>
      <p class="muted small" style="margin-top:1rem">La première connexion crée un compte invité. Ton token est sauvegardé automatiquement dans le navigateur.</p>
    </section>`;
}

// --- Lobby -------------------------------------------------------------------
export function renderOnlineLobby(ol, hasLocalSave) {
  const room = ol.room;
  if (!room) return `<section class="panel"><p class="muted">Chargement du salon…</p></section>`;
  const isHost = ol.seat === "A";
  const myReady = room.seats[ol.seat]?.ready;
  const bothReady = room.seats.A?.ready && room.seats.B?.ready;
  const hasBothPlayers = !!(room.seats.A && room.seats.B);
  const err = ol.error ? `<p class="net-error">${esc(ol.error)}</p>` : "";

  // Si le joueur n'a pas de sauvegarde locale, il choisit une classe de base.
  const needsClassPick = !hasLocalSave;
  const guestClass = ol.guestClass || "warrior";
  const classPicker = needsClassPick ? `
    <div class="net-class-pick">
      <p class="muted small">Tu n'as pas de personnage local. Choisis une classe pour jouer :</p>
      <div class="tree-voies" style="flex-wrap:wrap;gap:6px;margin:6px 0">
        ${Object.values(CLASSES).map((c) =>
          `<button class="zone-chip ${c.id === guestClass ? "active" : ""}" data-act="net-guest-class" data-cls="${c.id}">${esc(c.name)}</button>`
        ).join("")}
      </div>
    </div>` : "";

  const codeBlock = isHost ? `
    <div class="net-invite">
      <span class="muted small">Code à partager avec ton·ta partenaire :</span>
      <div class="net-code">${esc(room.inviteCode)}</div>
    </div>` : "";

  const seatRow = (seat) => {
    const s = room.seats[seat];
    const isMe = seat === ol.seat;
    if (!s) return `<div class="duo-hero"><span class="muted small">Siège ${seat} — en attente…</span></div>`;
    return `
      <div class="duo-hero ${s.ready ? "active" : ""}">
        <div class="duo-hero-head">
          <strong>${esc(s.handle)}</strong>${isMe ? " <span class='muted small'>(toi)</span>" : ""}
        </div>
        ${s.ready
          ? `<span class="muted small" style="color:var(--good,#5fcf95)">✓ Prêt·e</span>`
          : `<span class="muted small">⏳ Pas encore prêt·e</span>`}
      </div>`;
  };

  // Sélecteur de session (hôte uniquement, quand les deux sont prêts)
  let sessionPicker = "";
  if (isHost && bothReady && room.phase === "lobby") {
    const skirmCards = Object.values(DUO_SKIRMISHES).map((s) =>
      `<button class="duo-content-card" data-act="net-start" data-mode="skirmish" data-id="${s.id}">
         <strong>${esc(s.name)}</strong>
         <span class="muted small">Escarmouche</span>
       </button>`
    ).join("");
    const dungCards = Object.values(DUNGEONS).map((d) =>
      `<button class="duo-content-card dungeon" data-act="net-start" data-mode="dungeon" data-id="${d.id}">
         <strong>🏰 ${esc(d.name)}</strong>
         <span class="muted small">${d.waves.length} vagues · fuite impossible</span>
       </button>`
    ).join("");
    sessionPicker = `
      <div class="net-session-picker">
        <h4>Lance une session</h4>
        <div class="duo-content-grid">${skirmCards}${dungCards}</div>
      </div>`;
  } else if (hasBothPlayers && !myReady) {
    // Rien — on attend juste que le joueur se marque prêt
  } else if (hasBothPlayers && myReady && !bothReady) {
    sessionPicker = `<p class="muted small" style="text-align:center">En attente que l'autre joueur se marque prêt…</p>`;
  }

  return `
    <section class="panel">
      <h3 class="section-title">Salon — Coop en ligne</h3>
      ${codeBlock}
      ${err}
      <div class="duo-heroes" style="margin:0.75rem 0">
        ${seatRow("A")}
        ${seatRow("B")}
      </div>
      ${classPicker}
      ${!myReady
        ? `<button class="btn primary" data-act="net-ready">Je suis prêt·e ✓</button>`
        : `<p class="muted small">Tu es prêt·e. ${hasBothPlayers && isHost && bothReady ? "Lance la session ci-dessous." : "En attente…"}</p>`}
      ${sessionPicker}
      <div style="margin-top:1.5rem"><button class="btn tiny" data-act="net-leave">Quitter le salon</button></div>
    </section>`;
}

// --- Combat en ligne ---------------------------------------------------------
function onlineHeroBar(h, seat, mySeat) {
  if (!h) return `<div class="duo-hero"><span class="muted small">Siège ${seat}…</span></div>`;
  const res = h.res ? `<div class="duo-res"><span style="color:${esc(h.res.color || "#5b8def")}">${esc(h.res.name || h.res.id)}</span> ${fmt(h.res.cur)}/${fmt(h.res.max)}</div>` : "";
  const guard = h.guardMax > 0 ? `<div class="duo-guard">Garde ${fmt(h.guardPool)}/${fmt(h.guardMax)}</div>` : "";
  const isMe = seat === mySeat;
  return `
    <div class="duo-hero ${h.hp <= 0 ? "down" : ""} ${isMe ? "active" : ""}">
      <div class="duo-hero-head"><strong>Siège ${seat}${isMe ? " (toi)" : ""}</strong> · ${esc(h.name)}${h.taunt ? " 🛡" : ""}</div>
      <div class="bar"><div class="bar-fill hp" style="width:${pctw(h.hp, h.maxHp)}%"></div></div>
      <div class="muted small">${fmt(Math.max(0, h.hp))}/${fmt(h.maxHp)} PV</div>
      ${guard}${res}
      ${h.shield > 0 ? `<div class="muted small">🔰 Bouclier ${fmt(h.shield)}</div>` : ""}
    </div>`;
}

export function renderOnlineCombat(ol) {
  const view = ol.combat;
  if (!view) return `<section class="panel"><p class="muted" style="text-align:center;padding:2rem">Chargement du combat…</p></section>`;

  const mySeat = ol.seat;
  const myHero = view.heroes && view.heroes[mySeat];
  const enemies = view.enemies || [];
  const liveEnemies = enemies.filter((e) => !e.down && e.hp > 0);
  const focusRef = ol.myTarget || (liveEnemies[0] && liveEnemies[0].uid) || "self";
  const needMyAction = (view.awaiting || []).includes(mySeat);
  const waveInfo = ol.dungeon ? `<span class="muted small">Donjon — vague ${(ol.dungeon.waveIndex || 0) + 1}</span>` : "";
  const err = ol.error ? `<p class="net-error">${esc(ol.error)}</p>` : "";
  const allyRef = mySeat === "A" ? "B" : "A";

  let body;
  if (view.status === "won") {
    body = `<div class="duo-result win"><h3>Victoire !</h3><button class="btn primary" data-act="net-back-lobby">Retour au salon</button></div>`;
  } else if (view.status === "lost") {
    body = `<div class="duo-result lose"><h3>Le duo est tombé…</h3><button class="btn primary" data-act="net-back-lobby">Retour au salon</button></div>`;
  } else if (ol.pendingBlessings && mySeat === "A") {
    body = `
      <div class="duo-blessing">
        <h3>Bénédiction de donjon</h3>
        <p class="muted small">Choisis une bénédiction persistante pour toute la session :</p>
        <div class="duo-content-grid">
          ${ol.pendingBlessings.map((id) => `<button class="duo-content-card" data-act="net-bless" data-id="${id}">${esc(id)}</button>`).join("")}
          <button class="duo-content-card" data-act="net-bless" data-id="">Passer</button>
        </div>
      </div>`;
  } else if (ol.pendingBlessings && mySeat !== "A") {
    body = `<p class="muted" style="text-align:center;padding:1.5rem">⏳ L'hôte choisit une bénédiction…</p>`;
  } else if (!needMyAction) {
    // On a déjà soumis notre intention, on attend l'autre
    body = `
      <div class="duo-enemies">
        ${enemies.map((e) => `
          <div class="duo-enemy ${e.hp <= 0 ? "dead" : ""}">
            <span class="duo-enemy-name">${esc(e.name)}</span>
            <div class="bar tiny"><div class="bar-fill enemy" style="width:${pctw(Math.max(0,e.hp), e.maxHp)}%"></div></div>
            <span class="muted small">${fmt(Math.max(0, e.hp))}/${fmt(e.maxHp)}</span>
          </div>`).join("")}
      </div>
      <div class="net-awaiting">⏳ En attente de l'autre joueur…</div>`;
  } else {
    // Notre tour d'agir
    const targetChips = `
      <div class="duo-targets">
        <span class="muted small">Cible :</span>
        <button class="zone-chip tiny ${focusRef === "self" ? "active" : ""}" data-act="net-target" data-ref="self">Soi</button>
        <button class="zone-chip tiny ${focusRef === "ally" ? "active" : ""}" data-act="net-target" data-ref="ally">Allié</button>
        ${liveEnemies.map((e) =>
          `<button class="zone-chip tiny ${focusRef === e.uid ? "active" : ""}" data-act="net-target" data-ref="${e.uid}">${esc(e.name)}</button>`
        ).join("")}
      </div>`;

    const skills = myHero ? (myHero.skills || []).map((id) => {
      const sk = getSkill(id);
      if (!sk) return "";
      const cd = (myHero.cooldowns && myHero.cooldowns[id] > 0) ? ` <span class="muted small">⏳${myHero.cooldowns[id]}</span>` : "";
      const cost = sk.cost ? ` <span class="muted small">(${sk.cost})</span>` : "";
      const onCd = myHero.cooldowns && myHero.cooldowns[id] > 0;
      return `<button class="btn skill${onCd ? " disabled" : ""}" data-act="net-skill" data-id="${id}" ${onCd ? "disabled" : ""}>${esc(sk.name)}${cost}${cd}</button>`;
    }).join("") : "";

    body = `
      <div class="duo-enemies">
        ${enemies.map((e) => `
          <button class="duo-enemy ${e.uid === focusRef ? "focus" : ""} ${e.hp <= 0 ? "dead" : ""}"
            data-act="net-target" data-ref="${e.uid}" ${e.hp <= 0 ? "disabled" : ""}>
            <span class="duo-enemy-name">${esc(e.name)}</span>
            <div class="bar tiny"><div class="bar-fill enemy" style="width:${pctw(Math.max(0,e.hp), e.maxHp)}%"></div></div>
            <span class="muted small">${fmt(Math.max(0, e.hp))}/${fmt(e.maxHp)}</span>
          </button>`).join("")}
      </div>
      <div class="duo-selection">
        <div class="duo-active-banner">🎮 À toi de jouer (Siège ${mySeat})</div>
        ${targetChips}
        <div class="skill-bar">${skills}</div>
      </div>`;
  }

  const log = view.log || ol.combatLog || [];
  return `
    <section class="panel coop-combat">
      <div class="arena-header">
        <span class="arena-zone">⚔️ Coop en ligne</span>
        ${waveInfo}
        <span class="arena-turn">Manche <strong>${view.turn || 1}</strong></span>
      </div>
      ${err}
      <div class="duo-heroes">
        ${onlineHeroBar(view.heroes?.A, "A", mySeat)}
        ${onlineHeroBar(view.heroes?.B, "B", mySeat)}
      </div>
      ${body}
      <details class="battle-log-wrap"><summary>📜 Journal</summary>
        <div class="battle-log">
          ${log.slice(-15).map((l) => `<div class="log-line ${esc(l.kind || "info")}">${esc(l.text)}</div>`).join("")}
        </div>
      </details>
      <div class="duo-footer"><button class="btn tiny" data-act="net-leave">Abandonner</button></div>
    </section>`;
}
