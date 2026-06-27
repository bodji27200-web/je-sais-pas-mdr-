// Métiers de récolte (idle). Chaque métier possède UNE activité principale qui
// évolue par PALIERS (`tiers`) selon le niveau du métier : le jeu propose
// toujours automatiquement le meilleur palier maîtrisé. Le joueur peut, en
// option, choisir un palier inférieur (ressource de bas niveau encore utile).
//
// Forme d'un palier (`tier`) :
//   id         : identifiant stable (sert à la sauvegarde de l'activité)
//   name       : libellé affiché
//   minLevel   : niveau de métier requis pour débloquer ce palier
//   durationMs : durée d'un cycle de récolte
//   xp         : XP de métier gagnée par cycle
//   resource   : ressource principale (id) — informe l'UI
//   drops      : [{ resource, min, max, chance }] ; quantité tirée entre min/max
//
// `xpMult` : multiplicateur d'XP propre au métier (équilibrage data-driven).

export const JOBS = {
  woodcutting: {
    id: "woodcutting",
    name: "Bûcheronnage",
    icon: "🪓",
    image: "assets/jobs/woodcutting.png",
    desc: "Abats des arbres pour récolter du bois. La forêt s'ouvre avec ton expérience.",
    xpMult: 1.0,
    tiers: [
      {
        id: "chop_soft",
        name: "Bois tendre",
        resource: "soft_wood",
        minLevel: 1,
        durationMs: 5000,
        xp: 6,
        drops: [{ resource: "soft_wood", min: 1, max: 2, chance: 1 }],
      },
      {
        id: "chop_oak",
        name: "Chêne",
        resource: "oak_wood",
        minLevel: 3,
        durationMs: 12000,
        xp: 16,
        drops: [
          { resource: "oak_wood", min: 1, max: 2, chance: 1 },
          { resource: "soft_wood", min: 0, max: 1, chance: 0.5 },
        ],
      },
      {
        id: "chop_ancient",
        name: "Arbre ancestral",
        resource: "ancient_wood",
        minLevel: 10,
        durationMs: 20000,
        xp: 34,
        drops: [
          { resource: "ancient_wood", min: 1, max: 2, chance: 1 },
          { resource: "oak_wood", min: 0, max: 2, chance: 0.5 },
        ],
      },
    ],
  },

  mining: {
    id: "mining",
    name: "Minage",
    icon: "⛏️",
    image: "assets/jobs/mining.png",
    desc: "Creuse la roche pour extraire minerais et gemmes. Les filons riches se méritent.",
    xpMult: 1.0,
    tiers: [
      {
        id: "mine_copper",
        name: "Cuivre",
        resource: "copper_ore",
        minLevel: 1,
        durationMs: 6000,
        xp: 7,
        drops: [
          { resource: "copper_ore", min: 1, max: 2, chance: 1 },
          { resource: "stone", min: 0, max: 1, chance: 0.6 },
          { resource: "rough_gem", min: 1, max: 1, chance: 0.02 },
        ],
      },
      {
        id: "mine_iron",
        name: "Fer",
        resource: "iron_ore",
        minLevel: 4,
        durationMs: 14000,
        xp: 18,
        drops: [
          { resource: "iron_ore", min: 1, max: 2, chance: 1 },
          { resource: "copper_ore", min: 0, max: 1, chance: 0.35 },
          { resource: "stone", min: 0, max: 1, chance: 0.5 },
          { resource: "rough_gem", min: 1, max: 1, chance: 0.04 },
        ],
      },
      {
        id: "mine_coal",
        name: "Charbon",
        resource: "coal",
        minLevel: 7,
        durationMs: 16000,
        xp: 24,
        drops: [
          { resource: "coal", min: 1, max: 2, chance: 1 },
          { resource: "iron_ore", min: 0, max: 1, chance: 0.4 },
          { resource: "stone", min: 0, max: 1, chance: 0.4 },
        ],
      },
      {
        id: "mine_silver",
        name: "Argent",
        resource: "silver_ore",
        minLevel: 14,
        durationMs: 22000,
        xp: 40,
        drops: [
          { resource: "silver_ore", min: 1, max: 2, chance: 1 },
          { resource: "coal", min: 0, max: 1, chance: 0.5 },
          { resource: "rough_gem", min: 1, max: 1, chance: 0.06 },
        ],
      },
    ],
  },
};

export function getJob(id) {
  return JOBS[id] || null;
}

// Palier d'un métier par id.
export function getJobTier(jobId, tierId) {
  const job = JOBS[jobId];
  if (!job) return null;
  return job.tiers.find((t) => t.id === tierId) || null;
}

// Compatibilité ascendante : l'ancien nom `getJobAction` reste un alias de
// `getJobTier` (les ids de palier sont identiques aux anciens ids d'action).
export const getJobAction = getJobTier;

// Tous les paliers débloqués pour un niveau de métier donné (du meilleur au moindre).
export function unlockedTiers(jobId, level) {
  const job = JOBS[jobId];
  if (!job) return [];
  return job.tiers.filter((t) => level >= t.minLevel).sort((a, b) => b.minLevel - a.minLevel);
}

// Meilleur palier maîtrisé (celui proposé par défaut), ou null si aucun.
export function bestTier(jobId, level) {
  const ut = unlockedTiers(jobId, level);
  return ut[0] || null;
}

// Prochain palier verrouillé (pour informer le joueur), ou null si tout est débloqué.
export function nextTier(jobId, level) {
  const job = JOBS[jobId];
  if (!job) return null;
  const locked = job.tiers.filter((t) => level < t.minLevel).sort((a, b) => a.minLevel - b.minLevel);
  return locked[0] || null;
}
