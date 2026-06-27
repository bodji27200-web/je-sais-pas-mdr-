// États (effets de statut) — data-driven. Le moteur de combat (systems/combat.js)
// lit un petit ensemble de MÉCANIQUES génériques ; ajouter un état = une entrée
// ici, sans toucher au moteur.
//
// Mécaniques supportées (toutes optionnelles) :
//   dot:            { pctAtk }   dégâts sur la durée (basés sur l'ATK de la source)
//   damageTakenPct: number       la cible subit +X % de dégâts (toutes sources)
//   vuln:           { element: pct }  +X % de dégâts de CET élément
//   slow:           number       réduit la vitesse de la cible de X
//   healingTakenMod:number       modifie les soins REÇUS par la cible (ex. -0.3)
//   noRegen:        bool         empêche la régénération passive de la cible
//   charge:         { dischargeAt, pctAtk }  cumul -> décharge en dégâts
//
// duration : tours. maxStacks : cumul max (1 si absent). Toujours plafonnés.

export const STATES = {
  burn: {
    id: "burn", name: "Brûlure", element: "fire", icon: "🔥", color: "#ff6b3d",
    duration: 3, maxStacks: 3,
    dot: { pctAtk: 0.3 }, healingTakenMod: -0.3,
    desc: "Dégâts de feu sur la durée et soins reçus réduits de 30 %.",
  },
  wet: {
    id: "wet", name: "Trempé", element: "water", icon: "💧", color: "#4ea3ff",
    duration: 2, maxStacks: 1,
    vuln: { lightning: 0.3, fire: -0.2 },
    desc: "+30 % de dégâts de Foudre subis, -20 % de dégâts de Feu subis.",
  },
  unbalance: {
    id: "unbalance", name: "Déséquilibre", element: "wind", icon: "🌀", color: "#8fe3b0",
    duration: 2, maxStacks: 1,
    damageTakenPct: 0.15, slow: 0.15,
    desc: "+15 % de dégâts subis et vitesse réduite : la cible vacille.",
  },
  root: {
    id: "root", name: "Enracinement", element: "nature", icon: "🌿", color: "#7ec850",
    duration: 2, maxStacks: 1,
    dot: { pctAtk: 0.18 }, slow: 0.3,
    desc: "Poison naturel et fort ralentissement.",
  },
  charge: {
    id: "charge", name: "Charge", element: "lightning", icon: "⚡", color: "#f5d24e",
    duration: 3, maxStacks: 3,
    charge: { dischargeAt: 3, pctAtk: 0.9 },
    desc: "Se cumule ; à 3 charges, décharge un éclair puis se dissipe.",
  },
  expose: {
    id: "expose", name: "Exposé", element: "light", icon: "✨", color: "#ffe9a8",
    duration: 2, maxStacks: 1,
    damageTakenPct: 0.22,
    desc: "Défenses percées : +22 % de dégâts subis.",
  },
  unstable: {
    id: "unstable", name: "Instabilité", element: "chaos", icon: "🌌", color: "#c45cff",
    duration: 2, maxStacks: 1,
    damageTakenPct: 0.18,
    desc: "Altération chaotique : +18 % de dégâts subis.",
  },
  soulmark: {
    id: "soulmark", name: "Marque funéraire", element: "umbral", icon: "💀", color: "#8a7fae",
    duration: 3, maxStacks: 1,
    noRegen: true, damageTakenPct: 0.1,
    desc: "Empêche la régénération et accroît de 10 % les dégâts subis.",
  },
};

export function getState(id) {
  return STATES[id] || null;
}
