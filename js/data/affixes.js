// Affixes (Lot 13) — propriétés additionnelles tirées sur chaque pièce, pilotées
// par la RARETÉ (et non un simple multiplicateur global de stats). Data-driven.
//
// Nombre d'affixes par rareté (cahier des charges) :
//   Commun 0 · Inhabituel 1 · Rare 2 · Épique 3 · Légendaire 4.
//
// Types d'affixes :
//   stat       -> bonus % (ou plat) appliqué dans getDerivedStats (visible sur la fiche)
//   combat     -> effet dynamique en combat (vol de vie, régén) fusionné dans pp
//   resist     -> résistance à UN élément (cumulable entre pièces = défense ciblée)
//   elementDmg -> dégâts bonus de l'attaquant pour UN élément

import { ELEMENT_ORDER } from "./elements.js";

export const RARITY_AFFIX_COUNT = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

export const AFFIXES = {
  atk: { id: "atk", kind: "stat", stat: "pctAtk", label: "ATK", min: 0.04, max: 0.1 },
  def: { id: "def", kind: "stat", stat: "pctDef", label: "DEF", min: 0.05, max: 0.12 },
  hp: { id: "hp", kind: "stat", stat: "pctHp", label: "PV", min: 0.04, max: 0.1 },
  crit: { id: "crit", kind: "stat", stat: "critFlat", label: "Crit", min: 2, max: 6, int: true },
  spd: { id: "spd", kind: "stat", stat: "spdPct", label: "Clairvoyance", min: 0.03, max: 0.08 },
  lifesteal: { id: "lifesteal", kind: "combat", pp: "lifestealPct", label: "Vol de vie", min: 0.04, max: 0.09 },
  hpRegen: { id: "hpRegen", kind: "combat", pp: "hpRegenPct", label: "Régén.", min: 0.015, max: 0.035 },
  resist: { id: "resist", kind: "resist", label: "Résist.", min: 0.06, max: 0.14, perElement: true },
  elementDmg: { id: "elementDmg", kind: "elementDmg", label: "Dégâts", min: 0.06, max: 0.14, perElement: true },
};

// Affixes possibles par catégorie d'emplacement (identité cohérente).
export const AFFIX_POOL = {
  weapon: ["atk", "crit", "lifesteal", "elementDmg"],
  armor: ["def", "hp", "resist", "hpRegen"],
  accessory: ["atk", "crit", "spd", "hp", "resist", "elementDmg", "lifesteal"],
};

function rnd(min, max) {
  return min + Math.random() * (max - min);
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Tire les affixes d'une pièce. `weaponElement` (si arme) oriente l'affixe
// elementDmg vers l'élément de l'arme (cohérence). Renvoie un tableau d'affixes
// résolus : { id, kind, label, value, stat?/pp?, element? }.
export function rollAffixes(slotCategory, rarityId, weaponElement = null) {
  const count = RARITY_AFFIX_COUNT[rarityId] || 0;
  const pool = AFFIX_POOL[slotCategory] || AFFIX_POOL.accessory;
  const out = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    // Évite les doublons d'affixe non-élémentaires sur une même pièce.
    const candidates = pool.filter((id) => AFFIXES[id].perElement || !used.has(id));
    if (!candidates.length) break;
    const def = AFFIXES[pick(candidates)];
    used.add(def.id);
    const affix = { id: def.id, kind: def.kind, label: def.label };
    if (def.int) affix.value = Math.round(rnd(def.min, def.max));
    else affix.value = Math.round(rnd(def.min, def.max) * 1000) / 1000;
    if (def.stat) affix.stat = def.stat;
    if (def.pp) affix.pp = def.pp;
    if (def.perElement) affix.element = def.id === "elementDmg" && weaponElement ? weaponElement : pick(ELEMENT_ORDER);
    out.push(affix);
  }
  return out;
}
