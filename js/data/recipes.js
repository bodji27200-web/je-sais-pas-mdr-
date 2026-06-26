// Recettes de craft. Le craft est instantané (l'attente, c'est la récolte).
// station : forge | tannerie | couture | joaillerie  (extensible : cuisine, alchimie...)
// output : { type: "resource" | "equipment", id, qty }
// inputs : [{ resource, qty }]
// levelReq : niveau de personnage requis (0 = aucun).

export const STATIONS = {
  forge: { id: "forge", name: "Forge", icon: "🔥" },
  tannerie: { id: "tannerie", name: "Tannerie", icon: "🟤" },
  couture: { id: "couture", name: "Couture", icon: "🧵" },
  joaillerie: { id: "joaillerie", name: "Joaillerie", icon: "💎" },
};

export const RECIPES = [
  // --- Forge : intermédiaires ---
  {
    id: "smelt_copper",
    station: "forge",
    output: { type: "resource", id: "copper_ingot", qty: 1 },
    inputs: [{ resource: "copper_ore", qty: 2 }],
    levelReq: 0,
  },
  {
    id: "smelt_iron",
    station: "forge",
    output: { type: "resource", id: "iron_ingot", qty: 1 },
    inputs: [{ resource: "iron_ore", qty: 2 }],
    levelReq: 0,
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
  },

  // --- Forge : armures de métal ---
  {
    id: "craft_iron_helm",
    station: "forge",
    output: { type: "equipment", id: "iron_helm", qty: 1 },
    inputs: [{ resource: "iron_ingot", qty: 3 }],
    levelReq: 3,
  },
  {
    id: "craft_iron_plate",
    station: "forge",
    output: { type: "equipment", id: "iron_plate", qty: 1 },
    inputs: [{ resource: "iron_ingot", qty: 6 }],
    levelReq: 4,
  },
  {
    id: "craft_iron_greaves",
    station: "forge",
    output: { type: "equipment", id: "iron_greaves", qty: 1 },
    inputs: [{ resource: "iron_ingot", qty: 4 }],
    levelReq: 3,
  },

  // --- Tannerie : armures de cuir ---
  {
    id: "craft_leather_cap",
    station: "tannerie",
    output: { type: "equipment", id: "leather_cap", qty: 1 },
    inputs: [{ resource: "raw_hide", qty: 2 }],
    levelReq: 1,
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
  },
  {
    id: "craft_leather_boots",
    station: "tannerie",
    output: { type: "equipment", id: "leather_boots", qty: 1 },
    inputs: [{ resource: "raw_hide", qty: 3 }],
    levelReq: 1,
  },

  // --- Couture : armures de tissu ---
  {
    id: "craft_cloth_hood",
    station: "couture",
    output: { type: "equipment", id: "cloth_hood", qty: 1 },
    inputs: [{ resource: "coarse_cloth", qty: 2 }],
    levelReq: 1,
  },
  {
    id: "craft_cloth_robe",
    station: "couture",
    output: { type: "equipment", id: "cloth_robe", qty: 1 },
    inputs: [{ resource: "coarse_cloth", qty: 4 }],
    levelReq: 2,
  },

  // --- Joaillerie : accessoire ---
  {
    id: "craft_gem_amulet",
    station: "joaillerie",
    output: { type: "equipment", id: "gem_amulet", qty: 1 },
    inputs: [
      { resource: "rough_gem", qty: 1 },
      { resource: "copper_ingot", qty: 1 },
    ],
    levelReq: 5,
  },
];

export function getRecipe(id) {
  return RECIPES.find((r) => r.id === id) || null;
}
