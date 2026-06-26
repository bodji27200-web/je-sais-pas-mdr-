// Petits utilitaires d'affichage partagés par les écrans.

export function $(sel, root = document) {
  return root.querySelector(sel);
}

// Échappe le texte destiné à du HTML.
export function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Médaillon illustré avec chaîne de secours : PNG -> SVG -> emoji.
// - Si le PNG existe (illustration générée plus tard), il s'affiche.
// - Sinon on tente le SVG de même nom (illustration vectorielle livrée).
// - Sinon l'emoji de secours reste visible.
// Déposer un PNG au même chemin que le SVG le remplacera donc automatiquement.
export function sigil(imagePath, emoji, extraClass = "") {
  let img = "";
  if (imagePath) {
    const svg = imagePath.replace(/\.(png|jpe?g|webp)$/i, ".svg");
    const onerr =
      svg !== imagePath
        ? `if(!this.dataset.alt){this.dataset.alt=1;this.src='${esc(svg)}';}else{this.remove();}`
        : "this.remove()";
    img = `<img class="sigil-img" src="${esc(imagePath)}" alt="" loading="lazy" onerror="${onerr}" />`;
  }
  return `<span class="sigil ${extraClass}"><span class="sigil-emoji">${emoji || "❔"}</span>${img}</span>`;
}

// Barre de jauge (PV, XP, progression...).
export function bar(value, max, cls = "") {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `<div class="bar ${cls}"><div class="bar-fill" style="width:${pct}%"></div></div>`;
}

// Notification éphémère.
let toastTimer = null;
export function toast(message, kind = "info") {
  const t = $("#toast");
  if (!t) return;
  t.textContent = message;
  t.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.className = "";
  }, 2200);
}

// Modale simple (résumé hors-ligne, confirmations...).
export function showModal(html) {
  const m = $("#modal");
  m.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box">${html}</div>`;
  m.classList.add("open");
}

export function closeModal() {
  const m = $("#modal");
  m.classList.remove("open");
  m.innerHTML = "";
}

export function fmt(n) {
  return Math.round(n).toLocaleString("fr-FR");
}

// <img> avec chaîne de secours PNG -> SVG (déposer un PNG remplace le SVG).
// `onfail` : code JS inline exécuté si PNG ET SVG échouent (défaut : retire l'img).
export function chainImg(path, className = "", onfail = "this.remove()") {
  if (!path) return "";
  const svg = path.replace(/\.(png|jpe?g|webp)$/i, ".svg");
  const onerr =
    svg !== path
      ? `if(!this.dataset.alt){this.dataset.alt=1;this.src='${esc(svg)}';}else{${onfail}}`
      : onfail;
  return `<img class="${className}" src="${esc(path)}" alt="" draggable="false" loading="lazy" onerror="${onerr}" />`;
}

// Durée lisible pour un compte à rebours : "12 s" ou "1 m 04 s".
export function fmtDuration(ms) {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec} s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m} m ${String(s).padStart(2, "0")} s`;
}
