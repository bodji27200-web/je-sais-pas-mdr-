// Donjons à VAGUES pour la coop duo (§18). Pas de carte ni de couloirs : une
// suite de combats enchaînés, fuite impossible une fois engagé. Data-driven :
// réutilise les ennemis existants (enemies.js). Équilibrés pour DEUX héros.

export const DUNGEON_BLESSINGS = {
  bless_vigor: { id: "bless_vigor", name: "Bénédiction de Vigueur", desc: "PV max +12 % pour le reste du donjon.", apply: (h) => { const add = Math.round(h.maxHp * 0.12); h.maxHp += add; h.hp += add; } },
  bless_ward: { id: "bless_ward", name: "Bénédiction de Garde", desc: "Réserve de Garde +20 % pour le donjon.", apply: (h) => { if (h.guardMax > 0) { const add = Math.round(h.guardMax * 0.2); h.guardMax += add; h.guardPool += add; } } },
  bless_might: { id: "bless_might", name: "Bénédiction de Force", desc: "Attaque +8 % pour le donjon.", apply: (h) => { h.atk = Math.round(h.atk * 1.08); } },
  bless_renewal: { id: "bless_renewal", name: "Bénédiction de Renouveau", desc: "Régénère 2 % PV/tour pour le donjon.", apply: (h) => { h.pp.hpRegenPct = (h.pp.hpRegenPct || 0) + 0.02; } },
};

export function getBlessing(id) {
  return DUNGEON_BLESSINGS[id] || null;
}

export const DUNGEONS = {
  shale_depths: {
    id: "shale_depths", name: "Tréfonds de Schiste", noFlee: true,
    background: "assets/backgrounds/zone2.png",
    waves: [
      { type: "normal", enemies: ["feral_wolf", "goblin_raider"] },
      { type: "normal", enemies: ["wild_boar", "forest_bandit"] },
      { type: "elite", enemies: ["dust_weaver", "dust_weaver"] },
      { type: "recover", recover: { hpPct: 0.25, guardPct: 0.5, resPct: 0.4 } },
      { type: "boss", enemies: ["goblin_chief_grok"] },
    ],
    blessingsAfter: [0, 2], // bénédiction proposée après ces index de vague
    rewardTable: "shale_depths_rewards",
  },
  ember_sanctum: {
    id: "ember_sanctum", name: "Sanctuaire de Braise", noFlee: true,
    background: "assets/backgrounds/zone5.png",
    waves: [
      { type: "normal", enemies: ["forest_bandit", "forest_bandit"] },
      { type: "elite", enemies: ["goblin_chief_grok"] },
      { type: "recover", recover: { hpPct: 0.3, guardPct: 0.5, resPct: 0.5 } },
      { type: "boss", enemies: ["ignar_emberheart"] },
    ],
    blessingsAfter: [0, 1],
    rewardTable: "ember_sanctum_rewards",
  },
};

export function getDungeon(id) {
  return DUNGEONS[id] || null;
}
