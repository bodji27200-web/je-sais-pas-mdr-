// Métiers de récolte (idle). Chaque action est une tâche chronométrée qui,
// une fois terminée, octroie XP + ressources. Les actions peuvent se répéter
// automatiquement (progression hors-ligne incluse).
//
// durationMs : durée d'un cycle. xp : XP de métier par cycle.
// drops : { resource, min, max, chance } ; quantité tirée entre min et max.

export const JOBS = {
  woodcutting: {
    id: "woodcutting",
    name: "Bûcheronnage",
    icon: "🪓",
    image: "assets/jobs/woodcutting.png",
    desc: "Abats des arbres pour récolter du bois.",
    actions: [
      {
        id: "chop_soft",
        name: "Couper du bois tendre",
        levelReq: 1,
        durationMs: 5000,
        xp: 6,
        drops: [{ resource: "soft_wood", min: 1, max: 2, chance: 1 }],
      },
      {
        id: "chop_oak",
        name: "Abattre un chêne",
        levelReq: 3,
        durationMs: 12000,
        xp: 16,
        drops: [
          { resource: "oak_wood", min: 1, max: 2, chance: 1 },
          { resource: "soft_wood", min: 0, max: 1, chance: 0.5 },
        ],
      },
    ],
  },

  mining: {
    id: "mining",
    name: "Minage",
    icon: "⛏️",
    image: "assets/jobs/mining.png",
    desc: "Creuse la roche pour extraire minerais et gemmes.",
    actions: [
      {
        id: "mine_copper",
        name: "Extraire du cuivre",
        levelReq: 1,
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
        name: "Extraire du fer",
        levelReq: 4,
        durationMs: 14000,
        xp: 18,
        drops: [
          { resource: "iron_ore", min: 1, max: 2, chance: 1 },
          { resource: "stone", min: 0, max: 1, chance: 0.5 },
          { resource: "rough_gem", min: 1, max: 1, chance: 0.04 },
        ],
      },
    ],
  },
};

export function getJob(id) {
  return JOBS[id] || null;
}

export function getJobAction(jobId, actionId) {
  const job = JOBS[jobId];
  if (!job) return null;
  return job.actions.find((a) => a.id === actionId) || null;
}
