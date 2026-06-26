// Ressources : matières premières récoltées, intermédiaires de craft et butin.
// `source` est purement informatif (affiché dans l'aide). `tier` aide au tri.
// `icon` est un emoji de secours utilisé tant que l'illustration n'est pas fournie.

export const RESOURCES = {
  soft_wood: {
    id: "soft_wood",
    name: "Bois tendre",
    tier: 1,
    icon: "🪵",
    image: "assets/resources/soft_wood.png",
    source: "Bûcheronnage",
    desc: "Un bois commun, facile à travailler.",
  },
  oak_wood: {
    id: "oak_wood",
    name: "Bois de chêne",
    tier: 2,
    icon: "🪵",
    image: "assets/resources/oak_wood.png",
    source: "Bûcheronnage",
    desc: "Un bois dense et solide, idéal pour les manches d'armes.",
  },
  stone: {
    id: "stone",
    name: "Pierre",
    tier: 1,
    icon: "🪨",
    image: "assets/resources/stone.png",
    source: "Minage",
    desc: "De la roche brute. Toujours utile.",
  },
  copper_ore: {
    id: "copper_ore",
    name: "Minerai de cuivre",
    tier: 1,
    icon: "🟫",
    image: "assets/resources/copper_ore.png",
    source: "Minage",
    desc: "Un minerai rougeâtre, à fondre en lingot.",
  },
  iron_ore: {
    id: "iron_ore",
    name: "Minerai de fer",
    tier: 2,
    icon: "⛏️",
    image: "assets/resources/iron_ore.png",
    source: "Minage",
    desc: "Un minerai robuste, base de l'équipement lourd.",
  },
  rough_gem: {
    id: "rough_gem",
    name: "Gemme brute",
    tier: 3,
    icon: "💎",
    image: "assets/resources/rough_gem.png",
    source: "Minage (rare) · Boss",
    desc: "Une pierre précieuse non taillée. Rare et convoitée.",
  },
  copper_ingot: {
    id: "copper_ingot",
    name: "Lingot de cuivre",
    tier: 2,
    icon: "🧱",
    image: "assets/resources/copper_ingot.png",
    source: "Forge",
    desc: "Du cuivre fondu, prêt à être forgé.",
  },
  iron_ingot: {
    id: "iron_ingot",
    name: "Lingot de fer",
    tier: 3,
    icon: "🧱",
    image: "assets/resources/iron_ingot.png",
    source: "Forge",
    desc: "Du fer raffiné pour l'équipement de qualité.",
  },
  raw_hide: {
    id: "raw_hide",
    name: "Cuir brut",
    tier: 1,
    icon: "🟤",
    image: "assets/resources/raw_hide.png",
    source: "Butin de combat",
    desc: "Une peau résistante, base des armures de cuir.",
  },
  coarse_cloth: {
    id: "coarse_cloth",
    name: "Étoffe grossière",
    tier: 1,
    icon: "🧵",
    image: "assets/resources/coarse_cloth.png",
    source: "Butin de combat",
    desc: "Un tissu rêche, base des armures de tissu.",
  },
  equip_essence: {
    id: "equip_essence",
    name: "Essence d'équipement",
    tier: 3,
    icon: "✨",
    image: "assets/resources/equip_essence.png",
    source: "Démantèlement d'équipement",
    desc: "Extraite des pièces démantelées. Sert à renforcer l'équipement.",
  },
};

export function getResource(id) {
  return RESOURCES[id] || null;
}
