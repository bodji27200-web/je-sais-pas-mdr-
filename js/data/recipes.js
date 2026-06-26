// Recettes de craft. Le craft est instantané (l'attente, c'est la récolte).
// station : identifie aussi le MÉTIER de transformation (niveau propre, qui monte
//   en fabriquant). fonte | forge | tannerie | couture | joaillerie
// output : { type: "resource" | "equipment", id, qty }
// inputs : [{ resource, qty }]
// levelReq : niveau de PERSONNAGE requis (0 = aucun).
// profReq  : niveau de MÉTIER de transformation requis (défaut 1).
// profXp   : XP de métier de transformation gagnée en fabriquant (défaut dérivé).

export const STATIONS = {
  // La Fonte (transformer minerai -> lingot) est un métier distinct de la Forge.
  fonte: { id: "fonte", name: "Fonte", icon: "🫕", desc: "Transforme les minerais en lingots et alliages." },
  forge: { id: "forge", name: "Forge", icon: "🔥", desc: "Bat le métal et le bois en armes et armures." },
  tannerie: { id: "tannerie", name: "Tannerie", icon: "🟤", desc: "Travaille le cuir en armures souples." },
  couture: { id: "couture", name: "Couture", icon: "🧵", desc: "Tisse l'étoffe en tenues légères." },
  joaillerie: { id: "joaillerie", name: "Joaillerie", icon: "💎", desc: "Sertit gemmes et métaux en accessoires." },
};

export const RECIPES = [
  // --- Fonte : intermédiaires (métier Fonte) ---
  {
    id: "smelt_copper",
    station: "fonte",
    output: { type: "resource", id: "copper_ingot", qty: 1 },
    inputs: [{ resource: "copper_ore", qty: 2 }],
    levelReq: 0,
    profReq: 1,
    profXp: 5,
  },
  {
    id: "smelt_iron",
    station: "fonte",
    output: { type: "resource", id: "iron_ingot", qty: 1 },
    inputs: [{ resource: "iron_ore", qty: 2 }],
    levelReq: 0,
    profReq: 3,
    profXp: 9,
  },
  {
    id: "smelt_silver",
    station: "fonte",
    output: { type: "resource", id: "silver_ingot", qty: 1 },
    inputs: [
      { resource: "silver_ore", qty: 2 },
      { resource: "coal", qty: 1 }, // le charbon sert de fondant
    ],
    levelReq: 0,
    profReq: 6,
    profXp: 16,
  },

  // --- Forge : armes ---
  {
    id: "craft_copper_sword",
    station: "forge",
    output: { type: "equipment", id: "copper_sword", qty: 1 },
    inputs: [
      { resource: "copper_ingot", qty: 2 },
      { resource: "soft_wood", qty: 1 },
    ],
    levelReq: 1,
    profReq: 1,
    profXp: 8,
  },
  {
    id: "craft_iron_sword",
    station: "forge",
    output: { type: "equipment", id: "iron_sword", qty: 1 },
    inputs: [
      { resource: "iron_ingot", qty: 2 },
      { resource: "oak_wood", qty: 1 },
    ],
    levelReq: 4,
    profReq: 3,
    profXp: 18,
  },
  {
    id: "craft_iron_greatsword",
    station: "forge",
    output: { type: "equipment", id: "iron_greatsword", qty: 1 },
    inputs: [
      { resource: "iron_ingot", qty: 4 },
      { resource: "oak_wood", qty: 2 },
    ],
    levelReq: 6,
    profReq: 4,
    profXp: 24,
  },
  {
    id: "craft_iron_mace",
    station: "forge",
    output: { type: "equipment", id: "iron_mace", qty: 1 },
    inputs: [
      { resource: "iron_ingot", qty: 3 },
      { resource: "oak_wood", qty: 1 },
    ],
    levelReq: 4,
    profReq: 3,
    profXp: 18,
  },

  // --- Forge : armes du Gardien ---
  {
    id: "craft_oak_spear",
    station: "forge",
    output: { type: "equipment", id: "oak_spear", qty: 1 },
    inputs: [
      { resource: "oak_wood", qty: 2 },
      { resource: "copper_ingot", qty: 1 },
    ],
    levelReq: 2,
    profReq: 2,
    profXp: 12,
  },
  {
    id: "craft_iron_spear",
    station: "forge",
    output: { type: "equipment", id: "iron_spear", qty: 1 },
    inputs: [
      { resource: "iron_ingot", qty: 2 },
      { resource: "oak_wood", qty: 1 },
    ],
    levelReq: 5,
    profReq: 3,
    profXp: 18,
  },
  {
    id: "craft_iron_buckler",
    station: "forge",
    output: { type: "equipment", id: "iron_buckler", qty: 1 },
    inputs: [{ resource: "iron_ingot", qty: 3 }],
    levelReq: 3,
    profReq: 3,
    profXp: 16,
  },

  // --- Forge : armes de l'Archer ---
  {
    id: "craft_short_bow",
    station: "forge",
    output: { type: "equipment", id: "short_bow", qty: 1 },
    inputs: [
      { resource: "soft_wood", qty: 3 },
      { resource: "coarse_cloth", qty: 1 },
    ],
    levelReq: 1,
    profReq: 1,
    profXp: 8,
  },
  {
    id: "craft_oak_longbow",
    station: "forge",
    output: { type: "equipment", id: "oak_longbow", qty: 1 },
    inputs: [
      { resource: "oak_wood", qty: 3 },
      { resource: "coarse_cloth", qty: 1 },
    ],
    levelReq: 4,
    profReq: 3,
    profXp: 18,
  },
  {
    id: "craft_light_crossbow",
    station: "forge",
    output: { type: "equipment", id: "light_crossbow", qty: 1 },
    inputs: [
      { resource: "iron_ingot", qty: 1 },
      { resource: "oak_wood", qty: 2 },
    ],
    levelReq: 5,
    profReq: 3,
    profXp: 20,
  },
  {
    id: "craft_ancient_longbow",
    station: "forge",
    output: { type: "equipment", id: "ancient_longbow", qty: 1 },
    inputs: [
      { resource: "ancient_wood", qty: 3 },
      { resource: "iron_ingot", qty: 1 },
    ],
    levelReq: 8,
    profReq: 5,
    profXp: 28,
  },

  // --- Forge : armes du Mage ---
  {
    id: "craft_apprentice_wand",
    station: "forge",
    output: { type: "equipment", id: "apprentice_wand", qty: 1 },
    inputs: [
      { resource: "soft_wood", qty: 2 },
      { resource: "copper_ingot", qty: 1 },
    ],
    levelReq: 1,
    profReq: 1,
    profXp: 8,
  },
  {
    id: "craft_oak_staff",
    station: "forge",
    output: { type: "equipment", id: "oak_staff", qty: 1 },
    inputs: [
      { resource: "oak_wood", qty: 3 },
      { resource: "rough_gem", qty: 1 },
    ],
    levelReq: 4,
    profReq: 3,
    profXp: 18,
  },
  {
    id: "craft_ancient_staff",
    station: "forge",
    output: { type: "equipment", id: "ancient_staff", qty: 1 },
    inputs: [
      { resource: "ancient_wood", qty: 3 },
      { resource: "rough_gem", qty: 1 },
    ],
    levelReq: 8,
    profReq: 5,
    profXp: 28,
  },

  // --- Joaillerie : orbe & accessoires ---
  {
    id: "craft_arcane_orb",
    station: "joaillerie",
    output: { type: "equipment", id: "arcane_orb", qty: 1 },
    inputs: [
      { resource: "rough_gem", qty: 1 },
      { resource: "copper_ingot", qty: 2 },
    ],
    levelReq: 5,
    profReq: 2,
    profXp: 18,
  },
  {
    id: "craft_gem_amulet",
    station: "joaillerie",
    output: { type: "equipment", id: "gem_amulet", qty: 1 },
    inputs: [
      { resource: "rough_gem", qty: 1 },
      { resource: "copper_ingot", qty: 1 },
    ],
    levelReq: 5,
    profReq: 1,
    profXp: 14,
  },
  {
    id: "craft_silver_amulet",
    station: "joaillerie",
    output: { type: "equipment", id: "silver_amulet", qty: 1 },
    inputs: [
      { resource: "silver_ingot", qty: 2 },
      { resource: "rough_gem", qty: 1 },
    ],
    levelReq: 9,
    profReq: 4,
    profXp: 26,
  },

  // --- Forge : armes de l'Assassin ---
  {
    id: "craft_rusty_dagger",
    station: "forge",
    output: { type: "equipment", id: "rusty_dagger", qty: 1 },
    inputs: [
      { resource: "copper_ingot", qty: 1 },
      { resource: "soft_wood", qty: 1 },
    ],
    levelReq: 1,
    profReq: 1,
    profXp: 8,
  },
  {
    id: "craft_short_blade",
    station: "forge",
    output: { type: "equipment", id: "short_blade", qty: 1 },
    inputs: [
      { resource: "iron_ingot", qty: 1 },
      { resource: "copper_ingot", qty: 1 },
    ],
    levelReq: 3,
    profReq: 2,
    profXp: 14,
  },
  {
    id: "craft_twin_daggers",
    station: "forge",
    output: { type: "equipment", id: "twin_daggers", qty: 1 },
    inputs: [
      { resource: "iron_ingot", qty: 2 },
      { resource: "soft_wood", qty: 1 },
    ],
    levelReq: 4,
    profReq: 3,
    profXp: 18,
  },

  // --- Forge : armures de métal ---
  {
    id: "craft_iron_helm",
    station: "forge",
    output: { type: "equipment", id: "iron_helm", qty: 1 },
    inputs: [{ resource: "iron_ingot", qty: 3 }],
    levelReq: 3,
    profReq: 3,
    profXp: 16,
  },
  {
    id: "craft_reinforced_helm",
    station: "forge",
    output: { type: "equipment", id: "reinforced_helm", qty: 1 },
    inputs: [
      { resource: "iron_ingot", qty: 3 },
      { resource: "coal", qty: 1 }, // trempe : le charbon durcit le métal
    ],
    levelReq: 7,
    profReq: 5,
    profXp: 24,
  },
  {
    id: "craft_iron_plate",
    station: "forge",
    output: { type: "equipment", id: "iron_plate", qty: 1 },
    inputs: [{ resource: "iron_ingot", qty: 6 }],
    levelReq: 4,
    profReq: 4,
    profXp: 22,
  },
  {
    id: "craft_iron_greaves",
    station: "forge",
    output: { type: "equipment", id: "iron_greaves", qty: 1 },
    inputs: [{ resource: "iron_ingot", qty: 4 }],
    levelReq: 3,
    profReq: 3,
    profXp: 18,
  },

  // --- Tannerie : armures de cuir ---
  {
    id: "craft_leather_cap",
    station: "tannerie",
    output: { type: "equipment", id: "leather_cap", qty: 1 },
    inputs: [{ resource: "raw_hide", qty: 2 }],
    levelReq: 1,
    profReq: 1,
    profXp: 8,
  },
  {
    id: "craft_leather_armor",
    station: "tannerie",
    output: { type: "equipment", id: "leather_armor", qty: 1 },
    inputs: [
      { resource: "raw_hide", qty: 4 },
      { resource: "coarse_cloth", qty: 1 },
    ],
    levelReq: 2,
    profReq: 2,
    profXp: 14,
  },
  {
    id: "craft_leather_boots",
    station: "tannerie",
    output: { type: "equipment", id: "leather_boots", qty: 1 },
    inputs: [{ resource: "raw_hide", qty: 3 }],
    levelReq: 1,
    profReq: 1,
    profXp: 10,
  },

  // --- Couture : armures de tissu ---
  {
    id: "craft_cloth_hood",
    station: "couture",
    output: { type: "equipment", id: "cloth_hood", qty: 1 },
    inputs: [{ resource: "coarse_cloth", qty: 2 }],
    levelReq: 1,
    profReq: 1,
    profXp: 8,
  },
  {
    id: "craft_cloth_robe",
    station: "couture",
    output: { type: "equipment", id: "cloth_robe", qty: 1 },
    inputs: [{ resource: "coarse_cloth", qty: 4 }],
    levelReq: 2,
    profReq: 2,
    profXp: 14,
  },
  {
    id: "craft_cloth_leggings",
    station: "couture",
    output: { type: "equipment", id: "cloth_leggings", qty: 1 },
    inputs: [{ resource: "coarse_cloth", qty: 3 }],
    levelReq: 2,
    profReq: 1,
    profXp: 12,
  },
];

export function getRecipe(id) {
  return RECIPES.find((r) => r.id === id) || null;
}
