// Interface du MODE COOP LOCAL (hotseat duo) : deux joueurs sur le même écran.
// Branchée directement sur le moteur autoritaire (js/coop/duoCombat.js +
// duoDungeon.js) — aucune dépendance réseau. Le siège A est le héros courant ; le
// siège B est un partenaire local (classe choisie, même niveau).
//
// UX : à chaque manche, le joueur actif choisit une cible puis une compétence ;
// quand les deux ont choisi, on résout et on affiche le résultat. Sombre, tactile.

import { CLASSES } from "../data/classes.js";
import { getSkill } from "../data/skills.js";
import { getEnemy } from "../data/enemies.js";
import { DUNGEONS } from "../data/dungeons.js";
import { validateIntent, livingEnemies, livingHeroes, SEATS } from "../coop/duoCombat.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
const pctw = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);

// Encadrés d'escarmouche (combats simples) proposés selon le niveau.
export const DUO_SKIRMISHES = {
  duo_pack_wolves: { id: "duo_pack_wolves", name: "Meute affamée", enemies: ["feral_wolf", "feral_wolf", "wild_boar"] },
  duo_bandits: { id: "duo_bandits", name: "Embuscade de bandits", enemies: ["forest_bandit", "goblin_raider", "goblin_raider"] },
  duo_warband: { id: "duo_warband", name: "Bande de guerre gobeline", enemies: ["goblin_chief_grok", "goblin_raider"] },
};

// --- Écran de configuration --------------------------------------------------
export function renderDuoSetup(state, setup) {
  const partner = setup.partnerClass || "mage";
  const classChips = Object.values(CLASSES).map((c) =>
    `<button class="zone-chip ${c.id === partner ? "active" : ""}" data-act="duo-partner" data-cls="${c.id}">${esc(c.name)}</button>`
  ).join("");
  const skirmishCards = Object.values(DUO_SKIRMISHES).map((s) =>
    `<button class="duo-content-card" data-act="duo-start" data-mode="skirmish" data-id="${s.id}">
       <strong>${esc(s.name)}</strong>
       <span class="muted small">${s.enemies.map((e) => esc(getEnemy(e)?.name || e)).join(" · ")}</span>
     </button>`
  ).join("");
  const dungeonCards = Object.values(DUNGEONS).map((d) =>
    `<button class="duo-content-card dungeon" data-act="duo-start" data-mode="dungeon" data-id="${d.id}">
       <strong>🏰 ${esc(d.name)}</strong>
       <span class="muted small">${d.waves.length} vagues · fuite impossible</span>
     </button>`
  ).join("");
  return `
    <section class="panel coop-setup">
      <h3 class="section-title">Coopération — Duo local</h3>
      <p class="muted small">Deux joueurs, un seul écran : à chaque manche, chacun choisit l'action de son héros. Le siège A est ton héros ; choisis la classe du partenaire (siège B).</p>
      <h4>Partenaire (siège B)</h4>
      <div class="tree-voies">${classChips}</div>
      <h4>Escarmouches</h4>
      <div class="duo-content-grid">${skirmishCards}</div>
      <h4>Donjons à vagues</h4>
      <div class="duo-content-grid">${dungeonCards}</div>
    </section>`;
}

// --- Écran de combat duo -----------------------------------------------------
function heroBar(h, seat, activeSeat) {
  const res = h.res ? `<div class="duo-res"><span style="color:${esc(h.res.color || "#5b8def")}">${esc(h.res.name || h.res.id)}</span> ${fmt(h.res.cur)}/${fmt(h.res.max)}</div>` : "";
  const guard = h.guardMax > 0 ? `<div class="duo-guard">Garde ${fmt(h.guardPool)}/${fmt(h.guardMax)}</div>` : "";
  return `
    <div class="duo-hero ${h.hp <= 0 ? "down" : ""} ${seat === activeSeat ? "active" : ""}">
      <div class="duo-hero-head"><strong>Siège ${seat}</strong> · ${esc(h.name)} ${h.taunt > 0 ? "🛡provoc." : ""}</div>
      <div class="bar"><div class="bar-fill hp" style="width:${pctw(h.hp, h.maxHp)}%"></div></div>
      <div class="muted small">${fmt(Math.max(0, h.hp))}/${fmt(h.maxHp)} PV</div>
      ${guard}${res}
      ${h.shield > 0 ? `<div class="muted small">🔰 Bouclier ${fmt(h.shield)}</div>` : ""}
    </div>`;
}

function enemyRow(e, focusRef) {
  return `
    <button class="duo-enemy ${e.uid === focusRef ? "focus" : ""} ${e.hp <= 0 ? "dead" : ""}" data-act="duo-target" data-ref="${e.uid}" ${e.hp <= 0 ? "disabled" : ""}>
      <span class="duo-enemy-name">${esc(e.icon || "")} ${esc(e.name)}</span>
      <div class="bar tiny"><div class="bar-fill enemy" style="width:${pctw(e.hp, e.maxHp)}%"></div></div>
      <span class="muted small">${fmt(Math.max(0, e.hp))}/${fmt(e.maxHp)}</span>
    </button>`;
}

// Panneau de sélection du siège actif : cibles + compétences jouables.
function selectionPanel(combat, activeSeat, focusRef) {
  const hero = combat.heroes[activeSeat];
  if (!hero || hero.hp <= 0) return `<p class="muted">Siège ${activeSeat} à terre — il passe son tour.</p>`;
  const allyRef = activeSeat === "A" ? "B" : "A";
  const targetChips = `
    <div class="duo-targets">
      <span class="muted small">Cible :</span>
      <button class="zone-chip tiny ${focusRef === "self" ? "active" : ""}" data-act="duo-target" data-ref="self">Soi</button>
      <button class="zone-chip tiny ${focusRef === "ally" ? "active" : ""}" data-act="duo-target" data-ref="ally">Allié (${allyRef})</button>
      ${livingEnemies(combat).map((e) => `<button class="zone-chip tiny ${focusRef === e.uid ? "active" : ""}" data-act="duo-target" data-ref="${e.uid}">${esc(e.name)}</button>`).join("")}
    </div>`;
  const skills = hero.skills.map((id) => {
    const sk = getSkill(id);
    if (!sk) return "";
    const v = validateIntent(combat, activeSeat, { skillId: id, targetRef: focusRef });
    const dis = v.ok ? "" : "disabled";
    const cost = sk.cost ? ` <span class="muted small">(${sk.cost})</span>` : "";
    const cd = (hero.cooldowns[id] || 0) > 0 ? ` <span class="muted small">⏳${hero.cooldowns[id]}</span>` : "";
    return `<button class="btn skill ${dis}" data-act="duo-skill" data-id="${id}" ${dis}>${esc(sk.name)}${cost}${cd}</button>`;
  }).join("");
  return `
    <div class="duo-selection">
      <div class="duo-active-banner">🎮 Au tour du <strong>Siège ${activeSeat}</strong> (${esc(hero.name)}) de choisir</div>
      ${targetChips}
      <div class="skill-bar">${skills}</div>
    </div>`;
}

export function renderDuoCombat(state, duo, ui) {
  const combat = duo.combat || duo; // duo peut être un donjon (a .combat) ou un combat direct
  const activeSeat = ui.activeSeat;
  const focusRef = ui.target || (livingEnemies(combat)[0] && livingEnemies(combat)[0].uid) || "self";
  const waveInfo = duo.def ? `<span class="muted small">Donjon : ${esc(duo.def.name)} — vague ${duo.waveIndex + 1}/${duo.def.waves.length}</span>` : "";

  let body;
  if (combat.status === "won" || duo.status === "cleared") {
    body = `<div class="duo-result win"><h3>Victoire du duo !</h3>${duo.ledger ? `<p class="muted">Récompenses distribuées aux deux héros (sans dispute).</p>` : ""}<button class="btn primary" data-act="duo-quit">Retour</button></div>`;
  } else if (combat.status === "lost" || duo.status === "failed") {
    body = `<div class="duo-result lose"><h3>Le duo est tombé...</h3><button class="btn primary" data-act="duo-quit">Retour</button></div>`;
  } else if (ui.pendingBlessing) {
    body = `
      <div class="duo-blessing">
        <h3>Bénédiction de donjon</h3>
        <p class="muted small">Choisissez une bénédiction (persiste tout le donjon) :</p>
        <div class="duo-content-grid">
          ${ui.pendingBlessing.map((id) => `<button class="duo-content-card" data-act="duo-bless" data-id="${id}">${esc(id)}</button>`).join("")}
          <button class="duo-content-card" data-act="duo-bless" data-id="">Passer</button>
        </div>
      </div>`;
  } else {
    body = `
      <div class="duo-enemies">${combat.enemies.map((e) => enemyRow(e, focusRef)).join("")}</div>
      ${selectionPanel(combat, activeSeat, focusRef)}`;
  }

  return `
    <section class="panel coop-combat">
      <div class="arena-header"><span class="arena-zone">⚔️ Combat duo</span>${waveInfo}<span class="arena-turn">Manche <strong>${combat.turn}</strong></span></div>
      <div class="duo-heroes">${SEATS.map((s) => heroBar(combat.heroes[s], s, activeSeat)).join("")}</div>
      ${body}
      <details class="battle-log-wrap" open><summary>📜 Journal</summary>
        <div class="battle-log">${(combat.log || []).slice(-12).map((l) => `<div class="log-line ${esc(l.kind || "info")}">${esc(l.text)}</div>`).join("")}</div>
      </details>
      <div class="duo-footer"><button class="btn tiny" data-act="duo-quit">Abandonner</button></div>
    </section>`;
}
