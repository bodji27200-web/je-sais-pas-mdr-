// Génération de SPRITES PROCÉDURAUX (SVG) — illustrations originales calculées à
// la volée, déterministes à partir d'une graine (id/nom) et d'une palette
// (élément/rôle). Servent de fond derrière les portraits : si un vrai PNG existe,
// il s'affiche par-dessus ; sinon, ce sprite généré remplace l'emoji. Aucune image
// externe, rien de copyrighté — uniquement des formes générées.

import { ELEMENTS } from "../data/elements.js";

// Hash de chaîne -> entier 32 bits (déterministe).
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// PRNG déterministe à partir d'une graine.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// Palette par rôle (repli) ; un élément dominant la surcharge.
const ROLE_COLOR = {
  boss: "#c45cff", tank: "#5a9bd4", caster: "#9b6dc9", skirmisher: "#7ed957",
  brute: "#e8853a", bruiser: "#e8533a", default: "#8a7fae",
};

function clampHex(c) { return c && /^#?[0-9a-fA-F]{6}$/.test(c) ? (c[0] === "#" ? c : "#" + c) : null; }

// Détermine deux couleurs (claire/sombre) selon élément puis rôle.
function palette({ element, role } = {}) {
  let base = element && ELEMENTS[element] ? ELEMENTS[element].color : null;
  base = clampHex(base) || ROLE_COLOR[role] || ROLE_COLOR.default;
  return { base, dark: shade(base, -0.55), light: shade(base, 0.3) };
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  return `#${((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, "0")}`;
}

// Construit un « monstre » symétrique : corps en blob, cornes/épines, yeux luisants,
// halo pour les boss. Renvoie une chaîne SVG (100×100).
export function monsterSvg(seed, opts = {}) {
  const r = rng(hash(String(seed)) ^ 0x9e3779b9);
  const { base, dark, light } = palette(opts);
  const boss = !!opts.boss;
  const cx = 50;
  const bodyR = 26 + r() * 8;
  const cy = 56;
  // Épines/cornes symétriques.
  const spikes = 2 + Math.floor(r() * 4);
  let horns = "";
  for (let i = 0; i < spikes; i++) {
    const ang = -Math.PI / 2 + (i - (spikes - 1) / 2) * (0.5 + r() * 0.2);
    const len = 14 + r() * 16;
    const bx = cx + Math.cos(ang) * bodyR * 0.8;
    const by = cy + Math.sin(ang) * bodyR * 0.8;
    const tx = cx + Math.cos(ang) * (bodyR + len);
    const ty = cy + Math.sin(ang) * (bodyR + len);
    const w = 4 + r() * 4;
    horns += `<path d="M${bx - w} ${by} L${tx} ${ty} L${bx + w} ${by} Z" fill="${dark}"/>`;
  }
  // Corps : cercle déformé (blob) via path quadratique.
  const pts = 8;
  let d = "";
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rad = bodyR * (0.82 + r() * 0.3);
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad * 1.05;
    d += (i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` L${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  d += " Z";
  // Yeux.
  const eyeY = cy - 4 + r() * 4;
  const eyeDx = 7 + r() * 4;
  const eyeR = 2.6 + r() * 1.6;
  const eyes = `
    <circle cx="${cx - eyeDx}" cy="${eyeY}" r="${eyeR}" fill="${light}"/>
    <circle cx="${cx + eyeDx}" cy="${eyeY}" r="${eyeR}" fill="${light}"/>
    <circle cx="${cx - eyeDx}" cy="${eyeY}" r="${eyeR * 0.45}" fill="#0a0a12"/>
    <circle cx="${cx + eyeDx}" cy="${eyeY}" r="${eyeR * 0.45}" fill="#0a0a12"/>`;
  const aura = boss
    ? `<circle cx="${cx}" cy="${cy}" r="42" fill="none" stroke="${base}" stroke-opacity="0.5" stroke-width="2"/>
       <circle cx="${cx}" cy="${cy}" r="47" fill="none" stroke="${light}" stroke-opacity="0.25" stroke-width="1"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <radialGradient id="g" cx="50%" cy="42%" r="65%">
        <stop offset="0%" stop-color="${light}"/><stop offset="55%" stop-color="${base}"/><stop offset="100%" stop-color="${dark}"/>
      </radialGradient>
    </defs>
    <rect width="100" height="100" fill="#0e0b14"/>
    ${aura}
    ${horns}
    <path d="${d}" fill="url(#g)" stroke="${dark}" stroke-width="2"/>
    ${eyes}
  </svg>`;
}

// SVG -> data URI utilisable dans `background-image` / `src`.
export function spriteDataUri(seed, opts = {}) {
  return "data:image/svg+xml," + encodeURIComponent(monsterSvg(seed, opts));
}
