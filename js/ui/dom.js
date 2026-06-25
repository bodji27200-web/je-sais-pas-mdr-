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

// Médaillon illustré : l'emoji sert de secours tant que l'image n'existe pas.
// Si l'image se charge, elle recouvre l'emoji ; si elle est absente (404),
// l'<img> se masque et l'emoji reste visible.
export function sigil(imagePath, emoji, extraClass = "") {
  const img = imagePath
    ? `<img class="sigil-img" src="${esc(imagePath)}" alt="" loading="lazy" onerror="this.remove()" />`
    : "";
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
