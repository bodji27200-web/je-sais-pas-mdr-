// Compétences (joueur et ennemis) — data-driven.
//
// Champs d'une compétence active :
//   power     : multiplicateur de dégâts (0 = pas de dégâts directs)
//   hits      : nombre de frappes (multi-hit ; défaut 1)
//   cooldown  : tours de recharge
//   cost      : coût en RESSOURCE DE CLASSE (Lot 8 ; 0/absent = gratuit). Seul le
//               joueur a une ressource ; les ennemis ignorent ce champ.
//   critBonus : bonus de crit (%) pour CETTE frappe uniquement
//   target    : "enemy" | "self"
//   element   : élément de la compétence (interactions/résistances)
//   inflicts  : id d'état élémentaire appliqué si l'attaque touche
//   anim      : catégorie d'animation (générique, gérée par l'UI)
//   self      : effets appliqués au lanceur   [{ type, ... }]
//   onHit     : effets appliqués à la cible touchée [{ type, ... }]
//
// Rééquilibrage Lot 8 — principes :
//   - chaque compétence a UNE fonction principale claire ;
//   - les compétences ordinaires ont une recharge courte mais un petit coût ;
//   - les gros bursts / contrôles / soins importants coûtent cher en ressource
//     ET gardent une recharge : impossible de les enchaîner sans préparation ;
//   - l'attaque de base ne coûte rien et GÉNÈRE la ressource (toujours utile).
//   Le détail « Coût · Récup » est affiché par l'UI (plus codé dans les desc).
//
// Effets gérés par le moteur (systems/combat.js) :
//   atk_buff {amount,turns}      attaque ×(1+amount)
//   def_buff {amount,turns}      défense ×(1+amount)
//   atk_debuff {amount,turns}    attaque de la cible ×(1-amount)
//   slow {amount,turns}          vitesse de la cible ×(1-amount)
//   guard {reduce,turns}         réduit la prochaine attaque reçue de `reduce`
//   shield {pctMaxHp,turns}      bouclier absorbant des dégâts
//   heal {pctMaxHp}              soin immédiat
//   poison {pctAtk,turns}        dégâts sur la durée (basés sur l'ATK du lanceur)
//   bleed {pctAtk,turns}         idem, catégorie distincte (cumulable)
//
// Champs d'une passive (`passive: {...}`) :
//   maxHpPct, hpRegenPct, defPct, critFlat, spdPct, atkPct,
//   skillPowerPct (boost des compétences hors attaque de base),
//   execute {threshold,bonus}  (dégâts ×(1+bonus) si cible sous `threshold` PV),
//   lowHpAtk {threshold,bonus} (ATK ×(1+bonus) sous `threshold` PV du lanceur),
//   vsDebuff {bonus}           (dégâts ×(1+bonus) si la cible a un malus/DoT)

export const SKILLS = {
  // --- Commun ---
  basic_attack: {
    id: "basic_attack", name: "Attaque", type: "active", power: 1.0, cooldown: 0, cost: 0,
    target: "enemy", anim: "light", tags: ["damage"],
    desc: "Une attaque simple (100 % des dégâts). Gratuite : elle génère ta ressource de classe.",
  },
  // Action défensive universelle (Lot 3) : lève la Garde-réserve (redirige une
  // part des dégâts), réduit le prochain coup et restaure un peu de Garde.
  defend: {
    id: "defend", name: "Défendre", type: "active", power: 0, cooldown: 2, cost: 0,
    target: "self", anim: "buff", tags: ["guard"],
    self: [
      { type: "guard_active", turns: 2, absorb: 0.4 },
      { type: "guard_restore", pctMax: 0.2 },
      { type: "guard", reduce: 0.3, turns: 1 },
    ],
    desc: "Te mets en garde : redirige une partie des dégâts reçus vers ta réserve de Garde (2 tours), réduit le prochain coup de 30 % et restaure 20 % de ta Garde.",
  },
  // Conversion de Garde en dégâts (instr. 83) — outil de classe défensive offensive.
  // Non assignée à un kit pour l'instant (aucun impact d'équilibrage).
  guard_breaker: {
    id: "guard_breaker", name: "Riposte de Garde", type: "active", power: 0.8, cooldown: 2, cost: 25,
    target: "enemy", anim: "heavy", tags: ["damage", "guard"],
    guardConvert: { pctMax: 0.5, ratio: 1.0 },
    desc: "Frappe (80 %) puis convertit jusqu'à la moitié de ta réserve de Garde en dégâts directs supplémentaires.",
  },

  // ===================== GUERRIER (Rage) =====================
  heavy_strike: {
    id: "heavy_strike", name: "Frappe lourde", type: "active", power: 1.7, cooldown: 1, cost: 20,
    target: "enemy", anim: "heavy",
    desc: "Frappe puissante infligeant 170 % des dégâts.",
  },
  war_cry: {
    id: "war_cry", name: "Cri de guerre", type: "active", power: 0, cooldown: 3, cost: 30,
    target: "self", anim: "buff", self: [{ type: "atk_buff", amount: 0.3, turns: 3 }],
    desc: "Augmente ton attaque de 30 % pendant 3 tours.",
  },
  endurance: {
    id: "endurance", name: "Endurance", type: "passive",
    passive: { maxHpPct: 0.1, hpRegenPct: 0.028 },
    desc: "PV max +10 % et régénère ~3 % des PV chaque tour.",
  },

  // ===================== GARDIEN (Garde) =====================
  shield_bash: {
    id: "shield_bash", name: "Coup de bouclier", type: "active", power: 1.1, cooldown: 1, cost: 25,
    target: "enemy", anim: "heavy", onHit: [{ type: "atk_debuff", amount: 0.25, turns: 2 }],
    desc: "Dégâts (110 %) et réduit l'attaque ennemie de 25 % pendant 2 tours.",
  },
  taunt_guard: {
    id: "taunt_guard", name: "Provocation", type: "active", power: 0, cooldown: 2, cost: 0,
    target: "self", anim: "buff",
    self: [{ type: "guard", reduce: 0.5, turns: 1 }, { type: "def_buff", amount: 0.4, turns: 2 }],
    desc: "Réduit de 50 % la prochaine attaque reçue et augmente ta défense de 40 % pendant 2 tours. Gratuite : génère de la Garde.",
  },
  living_armor: {
    id: "living_armor", name: "Armure vivante", type: "passive",
    passive: { defPct: 0.18, maxHpPct: 0.05, lifestealPct: 0.18 },
    desc: "Défense +18 %, PV max +5 % et soigne 18 % des dégâts infligés (vol de vie).",
  },

  // ===================== ARCHER (Concentration) =====================
  precise_shot: {
    id: "precise_shot", name: "Tir précis", type: "active", power: 1.5, cooldown: 2, cost: 30,
    target: "enemy", anim: "ranged", critBonus: 35,
    desc: "Tir puissant (150 %) avec +35 % de chances de critique sur ce coup.",
  },
  double_shot: {
    id: "double_shot", name: "Double flèche", type: "active", power: 0.7, hits: 2, cooldown: 0, cost: 15,
    target: "enemy", anim: "ranged",
    desc: "Deux flèches infligeant chacune 70 % des dégâts.",
  },
  hunter_eye: {
    id: "hunter_eye", name: "Œil du chasseur", type: "passive",
    passive: { critFlat: 6, spdPct: 0.1 },
    desc: "Critique +6 % et vitesse +10 %.",
  },

  // ===================== MAGE (Mana) =====================
  arcane_bolt: {
    id: "arcane_bolt", name: "Projectile arcanique", type: "active", power: 1.55, cooldown: 0, cost: 25,
    target: "enemy", anim: "magic", element: "chaos",
    desc: "Projectile de pure magie (155 %, arcanique) — soumis à la Résistance de la cible.",
  },
  arcane_barrier: {
    id: "arcane_barrier", name: "Barrière arcanique", type: "active", power: 0, cooldown: 4, cost: 35,
    target: "self", anim: "buff", self: [{ type: "shield", pctMaxHp: 0.38, turns: 2 }],
    desc: "Crée un bouclier absorbant jusqu'à 38 % de tes PV max pendant 2 tours.",
  },
  arcane_influx: {
    id: "arcane_influx", name: "Afflux magique", type: "passive",
    passive: { skillPowerPct: 0.25 },
    desc: "Dégâts des compétences (hors attaque de base) +25 %.",
  },

  // ===================== ASSASSIN (Ombre) =====================
  shadow_strike: {
    id: "shadow_strike", name: "Frappe de l'ombre", type: "active", power: 1.3, cooldown: 0, cost: 20,
    target: "enemy", anim: "light", critBonus: 30,
    desc: "Frappe rapide (130 %) avec +30 % de chances de critique.",
  },
  poison_blade: {
    id: "poison_blade", name: "Lame empoisonnée", type: "active", power: 1.0, cooldown: 1, cost: 25,
    target: "enemy", anim: "light", onHit: [{ type: "poison", pctAtk: 0.45, turns: 3 }],
    desc: "Dégâts immédiats (100 %) puis poison (45 % de l'ATK / tour, 3 tours).",
  },
  opportunist: {
    id: "opportunist", name: "Opportuniste", type: "passive",
    passive: { execute: { threshold: 0.4, bonus: 0.6 } },
    desc: "Inflige +60 % de dégâts aux cibles sous 40 % de leurs PV.",
  },

  // ===================== SPÉCIALISATIONS =====================
  // -- Guerrier --
  bulwark: {
    id: "bulwark", name: "Rempart", type: "active", power: 0, cooldown: 3, cost: 30,
    target: "self", anim: "buff",
    self: [{ type: "def_buff", amount: 0.45, turns: 2 }, { type: "shield", pctMaxHp: 0.25, turns: 2 }],
    desc: "Défense +45 % et bouclier (25 % des PV max) pendant 2 tours.",
  },
  reckless_swing: {
    id: "reckless_swing", name: "Coup téméraire", type: "active", power: 2.2, cooldown: 3, cost: 45,
    target: "enemy", anim: "heavy", critBonus: 25,
    desc: "Une frappe sauvage (220 %) avec +25 % de critique.",
  },
  rallying_strike: {
    id: "rallying_strike", name: "Frappe de ralliement", type: "active", power: 1.3, cooldown: 2, cost: 25,
    target: "enemy", anim: "heavy", self: [{ type: "atk_buff", amount: 0.25, turns: 3 }],
    desc: "Frappe (130 %) et galvanise : attaque +25 % pendant 3 tours.",
  },

  // -- Gardien --
  fortress: {
    id: "fortress", name: "Forteresse", type: "active", power: 0, cooldown: 4, cost: 35,
    target: "self", anim: "buff",
    self: [{ type: "def_buff", amount: 0.6, turns: 3 }, { type: "guard", reduce: 0.5, turns: 1 }, { type: "shield", pctMaxHp: 0.3, turns: 3 }],
    desc: "Défense +60 %, prochaine attaque -50 %, bouclier (30 % PV) sur 3 tours.",
  },
  consecrate: {
    id: "consecrate", name: "Consécration", type: "active", power: 1.4, cooldown: 2, cost: 30,
    target: "enemy", anim: "heavy", self: [{ type: "heal", pctMaxHp: 0.18 }],
    desc: "Frappe sacrée (140 %) et te soigne de 18 % des PV max.",
  },
  pin_down: {
    id: "pin_down", name: "Clouer au sol", type: "active", power: 1.2, cooldown: 2, cost: 25,
    target: "enemy", anim: "heavy",
    onHit: [{ type: "slow", amount: 0.3, turns: 2 }, { type: "atk_debuff", amount: 0.2, turns: 2 }],
    desc: "Empale (120 %), ralentit (-30 % CLV) et affaiblit (-20 % ATK).",
  },

  // -- Archer --
  aimed_shot: {
    id: "aimed_shot", name: "Tir ajusté", type: "active", power: 2.0, cooldown: 3, cost: 45,
    target: "enemy", anim: "ranged", critBonus: 50,
    desc: "Un tir mortel (200 %) avec +50 % de chances de critique.",
  },
  arrow_volley: {
    id: "arrow_volley", name: "Volée de flèches", type: "active", power: 0.6, hits: 3, cooldown: 2, cost: 30,
    target: "enemy", anim: "ranged",
    desc: "Trois flèches infligeant chacune 60 % des dégâts.",
  },
  venom_shot: {
    id: "venom_shot", name: "Tir empoisonné", type: "active", power: 1.1, cooldown: 2, cost: 30,
    target: "enemy", anim: "ranged",
    onHit: [{ type: "poison", pctAtk: 0.5, turns: 3 }, { type: "slow", amount: 0.25, turns: 2 }],
    desc: "Flèche toxique (110 %), poison (50 % ATK/tour) et ralentissement.",
  },

  // -- Mage --
  fireball: {
    id: "fireball", name: "Boule de feu", type: "active", power: 1.85, cooldown: 2, cost: 44,
    target: "enemy", anim: "magic", element: "fire", inflicts: "burn",
    desc: "Explosion ardente de Feu (190 %) qui embrase la cible (Brûlure : dégâts sur la durée, soins réduits).",
  },
  frost_nova: {
    id: "frost_nova", name: "Nova de givre", type: "active", power: 1.3, cooldown: 2, cost: 35,
    target: "enemy", anim: "magic", element: "water", inflicts: "wet",
    onHit: [{ type: "slow", amount: 0.35, turns: 2 }, { type: "atk_debuff", amount: 0.2, turns: 2 }],
    desc: "Vague glaciale d'Eau (130 %) qui trempe la cible (+dégâts de Foudre subis), la ralentit et l'affaiblit.",
  },
  mana_shield: {
    id: "mana_shield", name: "Bouclier de mana", type: "active", power: 0, cooldown: 3, cost: 40,
    target: "self", anim: "buff",
    self: [{ type: "shield", pctMaxHp: 0.4, turns: 3 }, { type: "heal", pctMaxHp: 0.12 }],
    desc: "Bouclier (40 % PV) sur 3 tours et soin immédiat de 12 % des PV.",
  },

  // -- Assassin --
  assassinate: {
    id: "assassinate", name: "Assassinat", type: "active", power: 2.1, cooldown: 3, cost: 50,
    target: "enemy", anim: "light", critBonus: 45,
    desc: "Frappe à la jugulaire (210 %) avec +45 % de critique.",
  },
  toxic_strike: {
    id: "toxic_strike", name: "Frappe toxique", type: "active", power: 1.1, cooldown: 2, cost: 30,
    target: "enemy", anim: "light", onHit: [{ type: "poison", pctAtk: 0.6, turns: 3 }],
    desc: "Lame enduite (110 %) puis poison violent (60 % ATK/tour, 3 tours).",
  },
  flurry: {
    id: "flurry", name: "Déluge de lames", type: "active", power: 0.6, hits: 3, cooldown: 2, cost: 35,
    target: "enemy", anim: "light", critBonus: 10,
    desc: "Trois frappes rapides (60 % chacune) avec +10 % de critique.",
  },

  // ===================== ENNEMIS =====================
  // (Pas de coût : les ennemis n'ont pas de ressource de classe.)
  // -- Skirmisher (loup) : rapide, saigne ses proies.
  feral_bite: {
    id: "feral_bite", name: "Morsure féroce", type: "active", power: 1.4, cooldown: 3,
    target: "enemy", anim: "light", desc: "Une morsure sauvage (140 %).",
  },
  rending_claws: {
    id: "rending_claws", name: "Griffes lacérantes", type: "active", power: 1.0, cooldown: 2,
    target: "enemy", anim: "light", onHit: [{ type: "bleed", pctAtk: 0.4, turns: 3 }],
    desc: "Lacère la cible (100 %) et provoque un saignement.",
  },

  // -- Brute (gobelin) : frappe fort, jette des projectiles, enrage.
  goblin_smash: {
    id: "goblin_smash", name: "Coup de gourdin", type: "active", power: 1.6, cooldown: 2,
    target: "enemy", anim: "heavy", desc: "Un coup brutal (160 %).",
  },
  goblin_throw: {
    id: "goblin_throw", name: "Hache lancée", type: "active", power: 1.2, cooldown: 2,
    target: "enemy", anim: "ranged", onHit: [{ type: "atk_debuff", amount: 0.2, turns: 2 }],
    desc: "Lance une hache (120 %) et entaille le bras adverse (ATK -20 %).",
  },

  // -- Bruiser (sanglier) : charge dévastatrice, encorne et ralentit, régénère.
  boar_charge: {
    id: "boar_charge", name: "Charge", type: "active", power: 1.9, cooldown: 3,
    target: "enemy", anim: "heavy", desc: "Une charge qui renverse tout (190 %).",
  },
  boar_gore: {
    id: "boar_gore", name: "Encornage", type: "active", power: 1.0, cooldown: 2,
    target: "enemy", anim: "heavy", onHit: [{ type: "slow", amount: 0.3, turns: 2 }],
    desc: "Encorne (100 %) et ralentit la cible de 30 %.",
  },

  // -- Skirmisher (bandit) : poison et esquive.
  bandit_shiv: {
    id: "bandit_shiv", name: "Coup de surin", type: "active", power: 1.1, cooldown: 2,
    target: "enemy", anim: "light", onHit: [{ type: "poison", pctAtk: 0.4, turns: 3 }],
    desc: "Une lame empoisonnée (110 %) puis poison.",
  },
  smoke_step: {
    id: "smoke_step", name: "Pas de fumée", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff",
    self: [{ type: "guard", reduce: 0.6, turns: 1 }, { type: "spd_buff", amount: 0.25, turns: 2 }],
    desc: "Esquive la prochaine attaque (-60 %) et gagne en vitesse.",
  },

  // -- Boss : panoplie complète (burst, buff, défense, enrage).
  boss_cleave: {
    id: "boss_cleave", name: "Fendoir du chef", type: "active", power: 2.0, cooldown: 3,
    target: "enemy", anim: "heavy", desc: "Une frappe dévastatrice (200 %).",
  },
  boss_roar: {
    id: "boss_roar", name: "Rugissement", type: "active", power: 0, cooldown: 5,
    target: "self", anim: "buff", self: [{ type: "atk_buff", amount: 0.4, turns: 3 }],
    desc: "Le chef hurle : attaque +40 % pendant 3 tours.",
  },
  boss_quake: {
    id: "boss_quake", name: "Choc sismique", type: "active", power: 2.4, cooldown: 4,
    target: "enemy", anim: "heavy", onHit: [{ type: "slow", amount: 0.25, turns: 2 }],
    desc: "Martèle le sol (240 %) et déstabilise l'adversaire (CLV -25 %).",
  },
  boss_guard: {
    id: "boss_guard", name: "Garde du chef", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff",
    self: [{ type: "def_buff", amount: 0.5, turns: 2 }, { type: "guard", reduce: 0.4, turns: 1 }],
    desc: "Se met en garde : défense +50 % et prochaine attaque réduite de 40 %.",
  },

  // --- Passives ennemies (effets dynamiques en combat) ---
  enrage: {
    id: "enrage", name: "Furie", type: "passive",
    passive: { lowHpAtk: { threshold: 0.35, bonus: 0.5 } },
    desc: "Sous 35 % de PV, attaque +50 %.",
  },
  regeneration: {
    id: "regeneration", name: "Régénération", type: "passive",
    passive: { hpRegenPct: 0.05 },
    desc: "Régénère 5 % de ses PV max chaque tour.",
  },
  // Sustain de BOSS (PV élevés -> régénération volontairement faible, sinon
  // imbattable). Voir équilibrage Lot 10.
  boss_resilience: {
    id: "boss_resilience", name: "Résilience", type: "passive",
    passive: { hpRegenPct: 0.012 },
    desc: "Régénère lentement (~1 % des PV max par tour).",
  },
  soul_siphon: {
    id: "soul_siphon", name: "Siphon d'âme", type: "passive",
    passive: { lifestealPct: 0.1 },
    desc: "Récupère 10 % des dégâts infligés (vol de vie).",
  },

  // ===================== ENNEMIS — Zone 2 : Carrière d'Ombrepierre =====================
  // (Thème Umbral : âmes, marque funéraire, défenses minérales.)
  dust_bolt: {
    id: "dust_bolt", name: "Jet de poussière", type: "active", power: 1.1, cooldown: 2,
    target: "enemy", anim: "ranged", onHit: [{ type: "slow", amount: 0.2, turns: 2 }],
    desc: "Projette une bourrasque de poussière (110 %) qui ralentit.",
  },
  soul_drain: {
    id: "soul_drain", name: "Drain d'âme", type: "active", power: 1.2, cooldown: 2,
    target: "enemy", anim: "magic", element: "umbral", inflicts: "soulmark",
    self: [{ type: "heal", pctMaxHp: 0.06 }],
    desc: "Aspire l'âme (120 %, Umbral), applique la Marque funéraire et se soigne un peu.",
  },
  spectral_wail: {
    id: "spectral_wail", name: "Lamentation", type: "active", power: 0, cooldown: 3,
    target: "enemy", anim: "buff", onHit: [{ type: "atk_debuff", amount: 0.25, turns: 2 }],
    desc: "Un cri d'outre-tombe qui affaiblit l'attaque adverse de 25 %.",
  },
  stone_fist: {
    id: "stone_fist", name: "Poing de schiste", type: "active", power: 1.4, cooldown: 2,
    target: "enemy", anim: "heavy", desc: "Un coup de roche massif (140 %).",
  },
  brace: {
    id: "brace", name: "Carapace", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff",
    self: [{ type: "def_buff", amount: 0.55, turns: 2 }, { type: "guard", reduce: 0.45, turns: 1 }],
    desc: "Se met en garde minérale : défense +55 % et prochaine attaque réduite.",
  },
  screech: {
    id: "screech", name: "Cri d'écho", type: "active", power: 0.6, cooldown: 2,
    target: "enemy", anim: "ranged", element: "wind", inflicts: "unbalance",
    desc: "Onde sonore (60 %, Vent) qui déséquilibre la cible.",
  },
  dive: {
    id: "dive", name: "Piqué", type: "active", power: 1.3, cooldown: 2,
    target: "enemy", anim: "light", desc: "Fond sur la cible à pleine vitesse (130 %).",
  },
  cursed_smash: {
    id: "cursed_smash", name: "Frappe maudite", type: "active", power: 1.6, cooldown: 3,
    target: "enemy", anim: "heavy", element: "umbral", inflicts: "soulmark",
    desc: "Écrase la cible (160 %) et la marque de l'au-delà.",
  },
  dark_rally: {
    id: "dark_rally", name: "Appel des damnés", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff", self: [{ type: "atk_buff", amount: 0.35, turns: 3 }],
    desc: "Galvanise les morts : attaque +35 % pendant 3 tours.",
  },

  // ===================== ENNEMIS — Zone 3 : Cendres de Pyrelac =====================
  // (Thème Feu / Foudre : brûlures, charges, fournaise.)
  ember_spit: {
    id: "ember_spit", name: "Crachat de braise", type: "active", power: 1.1, cooldown: 2,
    target: "enemy", anim: "magic", element: "fire", inflicts: "burn",
    desc: "Projette une braise (110 %, Feu) qui embrase la cible.",
  },
  arc_zap: {
    id: "arc_zap", name: "Arc électrique", type: "active", power: 1.0, cooldown: 2,
    target: "enemy", anim: "magic", element: "lightning", inflicts: "charge",
    desc: "Décharge un arc (100 %, Foudre) qui accumule une Charge.",
  },
  cinder_guard: {
    id: "cinder_guard", name: "Voile de cendres", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff",
    self: [{ type: "def_buff", amount: 0.5, turns: 3 }, { type: "shield", pctMaxHp: 0.18, turns: 3 }],
    desc: "S'entoure de cendres : défense +50 % et bouclier sur 3 tours.",
  },
  sear_claw: {
    id: "sear_claw", name: "Griffe ardente", type: "active", power: 1.2, cooldown: 2,
    target: "enemy", anim: "light", element: "fire", inflicts: "burn",
    onHit: [{ type: "poison", pctAtk: 0.3, turns: 2 }],
    desc: "Lacère et embrase (120 %, Feu) : Brûlure + venin de soufre.",
  },
  searing_mend: {
    id: "searing_mend", name: "Onction ardente", type: "active", power: 0, cooldown: 3,
    target: "self", anim: "buff", self: [{ type: "heal", pctMaxHp: 0.16 }, { type: "def_buff", amount: 0.2, turns: 2 }],
    desc: "Se soigne de 16 % des PV et renforce sa défense.",
  },
  flame_lash: {
    id: "flame_lash", name: "Fouet de flammes", type: "active", power: 1.3, cooldown: 2,
    target: "enemy", anim: "magic", element: "fire", inflicts: "burn",
    desc: "Un fouet incandescent (130 %, Feu) qui embrase.",
  },

  // ===================== BOSS — Vorrak, l'Effondrement (Umbral) =====================
  vorrak_smash: {
    id: "vorrak_smash", name: "Éboulement", type: "active", power: 1.8, cooldown: 2,
    target: "enemy", anim: "heavy", desc: "Abat une masse de pierre (180 %).",
  },
  soul_harvest: {
    id: "soul_harvest", name: "Moisson des âmes", type: "active", power: 1.3, cooldown: 3,
    target: "enemy", anim: "magic", element: "umbral", inflicts: "soulmark",
    self: [{ type: "heal", pctMaxHp: 0.1 }],
    desc: "Récolte l'âme (130 %, Umbral), marque la cible et se soigne de 10 %.",
  },
  collapse: {
    id: "collapse", name: "Effondrement total", type: "active", power: 2.5, cooldown: 3,
    target: "enemy", anim: "heavy", onHit: [{ type: "slow", amount: 0.3, turns: 2 }],
    desc: "Fait s'écrouler la galerie (250 %) : dégâts massifs et ralentissement.",
  },
  grave_ward: {
    id: "grave_ward", name: "Sceau funéraire", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff",
    self: [{ type: "def_buff", amount: 0.4, turns: 2 }, { type: "shield", pctMaxHp: 0.2, turns: 3 }],
    desc: "Érige un sceau : défense +40 % et bouclier funéraire.",
  },

  // ===================== BOSS — Ignar, Cœur de Braise (Feu / Foudre) =====================
  ignar_slam: {
    id: "ignar_slam", name: "Marteau de magma", type: "active", power: 1.8, cooldown: 2,
    target: "enemy", anim: "heavy", element: "fire", desc: "Un coup de magma en fusion (180 %, Feu).",
  },
  flame_wave: {
    id: "flame_wave", name: "Vague ardente", type: "active", power: 1.4, cooldown: 2,
    target: "enemy", anim: "magic", element: "fire", inflicts: "burn",
    desc: "Déferlante de flammes (140 %, Feu) qui embrase profondément.",
  },
  thunder_call: {
    id: "thunder_call", name: "Appel du tonnerre", type: "active", power: 1.2, cooldown: 2,
    target: "enemy", anim: "magic", element: "lightning", inflicts: "charge",
    desc: "Invoque la foudre (120 %, Foudre) et accumule une Charge.",
  },
  meteor: {
    id: "meteor", name: "Pluie de météores", type: "active", power: 2.6, cooldown: 3,
    target: "enemy", anim: "heavy", element: "fire", inflicts: "burn",
    desc: "Fait pleuvoir le ciel en feu (260 %, Feu) : dégâts dévastateurs et Brûlure.",
  },
  ember_shield: {
    id: "ember_shield", name: "Aegis de braise", type: "active", power: 0, cooldown: 4,
    target: "self", anim: "buff",
    self: [{ type: "def_buff", amount: 0.15, turns: 2 }, { type: "shield", pctMaxHp: 0.16, turns: 3 }],
    desc: "Bouclier de braise : défense +15 % et absorption sur 3 tours.",
  },

  // ===========================================================================
  // ARBRE DE CLASSES (Lot 15) — compétences des nœuds avancés et hybrides.
  // Chaque nœud de l'arbre accorde au moins une compétence active (existante ou
  // ci-dessous) + applique une capacité passive réellement lue par le moteur.
  // On réutilise STRICTEMENT le vocabulaire d'effets déjà supporté par
  // systems/combat.js (rien de nouveau côté moteur ici).
  // ===========================================================================

  // ----------------------------- VOIE GUERRIER -----------------------------
  tw_combat_combo: {
    id: "tw_combat_combo", name: "Combo martial", type: "active", power: 0.8, hits: 2, cooldown: 1, cost: 15,
    target: "enemy", anim: "light", desc: "Deux frappes enchaînées (80 % chacune).",
  },
  tw_arms_mastery: {
    id: "tw_arms_mastery", name: "Frappe magistrale", type: "active", power: 1.6, cooldown: 2, cost: 25,
    target: "enemy", anim: "heavy", critBonus: 15, desc: "Une frappe d'expert (160 %, +15 % crit).",
  },
  tw_duelist_riposte: {
    id: "tw_duelist_riposte", name: "Riposte", type: "active", power: 1.2, cooldown: 2, cost: 25,
    target: "enemy", anim: "light", self: [{ type: "guard", reduce: 0.4, turns: 1 }, { type: "def_buff", amount: 0.2, turns: 2 }],
    desc: "Frappe en se couvrant (120 %), réduit le prochain coup reçu et la défense monte.",
  },
  tw_guardbreak: {
    id: "tw_guardbreak", name: "Brise-garde", type: "active", power: 1.0, cooldown: 2, cost: 30,
    target: "enemy", anim: "heavy", inflicts: "expose", guardConvert: { pctMax: 0.4, ratio: 1.1 },
    desc: "Fracasse la garde (100 %), expose la cible et convertit ta Garde en dégâts.",
  },
  tw_blood_rampage: {
    id: "tw_blood_rampage", name: "Carnage sanglant", type: "active", power: 1.9, cooldown: 3, cost: 40,
    target: "enemy", anim: "heavy", critBonus: 15, desc: "Déchaînement brutal (190 %), d'autant plus fort à bas PV.",
  },
  tw_runeblade_arc: {
    id: "tw_runeblade_arc", name: "Arc runique", type: "active", power: 1.6, cooldown: 2, cost: 35,
    target: "enemy", anim: "magic", element: "fire", inflicts: "burn",
    desc: "Lame enchantée de Feu (160 %) qui embrase la cible.",
  },
  tw_steel_sunder: {
    id: "tw_steel_sunder", name: "Fracture d'acier", type: "active", power: 1.5, cooldown: 2, cost: 30,
    target: "enemy", anim: "heavy", inflicts: "expose", onHit: [{ type: "atk_debuff", amount: 0.2, turns: 2 }],
    desc: "Brise l'armure (150 %), expose la cible et affaiblit son attaque.",
  },
  tw_war_avatar_storm: {
    id: "tw_war_avatar_storm", name: "Tempête de guerre", type: "active", power: 0.8, hits: 4, cooldown: 3, cost: 50,
    target: "enemy", anim: "heavy", desc: "Quatre frappes ravageuses (80 % chacune).",
  },
  tw_carnage_reap: {
    id: "tw_carnage_reap", name: "Moisson de carnage", type: "active", power: 2.4, cooldown: 3, cost: 55,
    target: "enemy", anim: "heavy", critBonus: 30, desc: "Frappe titanesque (240 %, +30 % crit).",
  },

  // ----------------------------- VOIE GARDIEN -----------------------------
  tg_rampart_aegis: {
    id: "tg_rampart_aegis", name: "Égide du rempart", type: "active", power: 0, cooldown: 3, cost: 25,
    target: "self", anim: "buff", self: [{ type: "def_buff", amount: 0.4, turns: 2 }, { type: "shield", pctMaxHp: 0.2, turns: 2 }],
    desc: "Défense +40 % et bouclier (20 % PV) sur 2 tours.",
  },
  tg_rampart_smash: {
    id: "tg_rampart_smash", name: "Charge du rempart", type: "active", power: 1.2, cooldown: 2, cost: 25,
    target: "enemy", anim: "heavy", onHit: [{ type: "atk_debuff", amount: 0.2, turns: 2 }],
    desc: "Bouscule la cible (120 %) et affaiblit son attaque.",
  },
  tg_bastion_wall: {
    id: "tg_bastion_wall", name: "Mur de bastion", type: "active", power: 0, cooldown: 4, cost: 35,
    target: "self", anim: "buff", self: [{ type: "guard_active", turns: 3, absorb: 0.7 }, { type: "def_buff", amount: 0.5, turns: 3 }, { type: "guard_restore", pctMax: 0.3 }],
    desc: "Lève une Garde massive (absorbe 70 % pendant 3 tours), défense +50 % et restaure de la Garde.",
  },
  tg_rune_paladin_smite: {
    id: "tg_rune_paladin_smite", name: "Châtiment runique", type: "active", power: 1.4, cooldown: 2, cost: 30,
    target: "enemy", anim: "magic", element: "light", inflicts: "expose", self: [{ type: "heal", pctMaxHp: 0.1 }],
    desc: "Frappe de Lumière (140 %) qui expose la cible et te soigne de 10 %.",
  },
  tg_royal_protector: {
    id: "tg_royal_protector", name: "Garde royale", type: "active", power: 0, cooldown: 3, cost: 30,
    target: "self", anim: "buff", self: [{ type: "guard_restore", pctMax: 0.4 }, { type: "def_buff", amount: 0.3, turns: 2 }, { type: "guard_active", turns: 2, absorb: 0.5 }],
    desc: "Restaure 40 % de Garde, défense +30 % et Garde active 2 tours.",
  },
  tg_steel_colossus_quake: {
    id: "tg_steel_colossus_quake", name: "Séisme colossal", type: "active", power: 1.6, cooldown: 3, cost: 35,
    target: "enemy", anim: "heavy", onHit: [{ type: "slow", amount: 0.25, turns: 2 }],
    desc: "Frappe sismique (160 %) qui ralentit la cible.",
  },
  tg_sacred_aegis: {
    id: "tg_sacred_aegis", name: "Égide sacrée", type: "active", power: 0, cooldown: 4, cost: 35,
    target: "self", anim: "buff", self: [{ type: "shield", pctMaxHp: 0.3, turns: 3 }, { type: "heal", pctMaxHp: 0.12 }, { type: "guard_active", turns: 2, absorb: 0.5 }],
    desc: "Bouclier sacré (30 % PV), soin (12 %) et Garde active.",
  },
  tg_living_fortress_convert: {
    id: "tg_living_fortress_convert", name: "Riposte de la forteresse", type: "active", power: 0.6, cooldown: 2, cost: 25,
    target: "enemy", anim: "heavy", guardConvert: { pctMax: 0.6, ratio: 1.2 },
    desc: "Frappe (60 %) puis convertit une large part de ta Garde en dégâts directs.",
  },
  tg_titan_bulwark: {
    id: "tg_titan_bulwark", name: "Rempart titanesque", type: "active", power: 0, cooldown: 4, cost: 40,
    target: "self", anim: "buff", self: [{ type: "def_buff", amount: 0.6, turns: 3 }, { type: "guard_active", turns: 3, absorb: 0.75 }, { type: "guard_restore", pctMax: 0.4 }],
    desc: "Défense +60 %, Garde active (75 %, 3 tours) et restauration de Garde.",
  },
  tg_primordial_guard: {
    id: "tg_primordial_guard", name: "Garde primordiale", type: "active", power: 1.4, cooldown: 3, cost: 35,
    target: "enemy", anim: "heavy", self: [{ type: "guard_restore", pctMax: 0.3 }], guardConvert: { pctMax: 0.3, ratio: 1.0 },
    desc: "Frappe (140 %), restaure de la Garde et en convertit une part en dégâts.",
  },
  tg_bastion_king_decree: {
    id: "tg_bastion_king_decree", name: "Décret du roi-bastion", type: "active", power: 1.6, cooldown: 3, cost: 45,
    target: "enemy", anim: "heavy", self: [{ type: "def_buff", amount: 0.4, turns: 2 }], guardConvert: { pctMax: 0.5, ratio: 1.3 },
    desc: "Frappe royale (160 %), défense +40 % et conversion massive de Garde.",
  },

  // ----------------------------- VOIE ARCHER -----------------------------
  ta_scout_mark: {
    id: "ta_scout_mark", name: "Tir de repérage", type: "active", power: 0.9, cooldown: 1, cost: 15,
    target: "enemy", anim: "ranged", inflicts: "expose", desc: "Flèche de repérage (90 %) qui marque (expose) la cible.",
  },
  ta_sharpshooter_aim: {
    id: "ta_sharpshooter_aim", name: "Tir parfait", type: "active", power: 1.8, cooldown: 3, cost: 40,
    target: "enemy", anim: "ranged", critBonus: 40, desc: "Tir minutieux (180 %, +40 % crit).",
  },
  ta_tracker_markshot: {
    id: "ta_tracker_markshot", name: "Tir traqueur", type: "active", power: 1.2, cooldown: 2, cost: 25,
    target: "enemy", anim: "ranged", inflicts: "expose", onHit: [{ type: "bleed", pctAtk: 0.3, turns: 3 }],
    desc: "Marque et saigne la cible (120 %) : la Marque amplifie tes dégâts.",
  },
  ta_beastmaster_call: {
    id: "ta_beastmaster_call", name: "Appel de la meute", type: "active", power: 0.8, cooldown: 2, cost: 20,
    target: "enemy", anim: "ranged", self: [{ type: "atk_buff", amount: 0.2, turns: 3 }],
    desc: "Coordonne l'attaque avec ton familier (80 %) et galvanise (ATK +20 %).",
  },
  ta_rune_hunter_shot: {
    id: "ta_rune_hunter_shot", name: "Flèche runique", type: "active", power: 1.4, cooldown: 2, cost: 30,
    target: "enemy", anim: "magic", element: "lightning", inflicts: "charge",
    desc: "Flèche de Foudre (140 %) qui accumule une Charge.",
  },
  ta_stormeye_volley: {
    id: "ta_stormeye_volley", name: "Salve d'œil-tempête", type: "active", power: 0.55, hits: 3, cooldown: 2, cost: 30,
    target: "enemy", anim: "ranged", critBonus: 10, desc: "Trois tirs rapides (55 % chacun, +10 % crit).",
  },
  ta_falconer_dive: {
    id: "ta_falconer_dive", name: "Piqué du faucon", type: "active", power: 1.5, cooldown: 2, cost: 30,
    target: "enemy", anim: "ranged", onHit: [{ type: "slow", amount: 0.25, turns: 2 }],
    desc: "Le familier plonge avec toi (150 %) et ralentit la cible.",
  },
  ta_spectral_bolt: {
    id: "ta_spectral_bolt", name: "Carreau spectral", type: "active", power: 1.4, cooldown: 2, cost: 35,
    target: "enemy", anim: "ranged", inflicts: "expose", guardConvert: { pctMax: 0.0, ratio: 0 },
    desc: "Carreau perce-garde (140 %) qui expose la cible (lourd contre les boucliers).",
  },
  ta_celestial_shot: {
    id: "ta_celestial_shot", name: "Tir céleste", type: "active", power: 2.0, cooldown: 3, cost: 45,
    target: "enemy", anim: "ranged", critBonus: 30, desc: "Tir foudroyant (200 %, +30 % crit).",
  },
  ta_hunt_lord_rain: {
    id: "ta_hunt_lord_rain", name: "Pluie de flèches", type: "active", power: 0.7, hits: 4, cooldown: 3, cost: 50,
    target: "enemy", anim: "ranged", desc: "Déluge de quatre flèches (70 % chacune).",
  },
  ta_world_eye_pierce: {
    id: "ta_world_eye_pierce", name: "Œil perçant", type: "active", power: 2.2, cooldown: 3, cost: 50,
    target: "enemy", anim: "ranged", critBonus: 35, inflicts: "expose",
    desc: "Tir absolu (220 %, +35 % crit) qui expose la cible.",
  },

  // ----------------------------- VOIE MAGE -----------------------------
  tm_arcanist_blast: {
    id: "tm_arcanist_blast", name: "Déflagration arcanique", type: "active", power: 1.8, cooldown: 1, cost: 30,
    target: "enemy", anim: "magic", element: "chaos", desc: "Explosion d'arcanes purs (180 %, Chaos).",
  },
  tm_elementalist_bolt: {
    id: "tm_elementalist_bolt", name: "Trait élémentaire", type: "active", power: 1.7, cooldown: 1, cost: 30,
    target: "enemy", anim: "magic", element: "fire", inflicts: "burn", desc: "Trait de Feu (170 %) qui embrase.",
  },
  tm_rune_sorcerer_hex: {
    id: "tm_rune_sorcerer_hex", name: "Maléfice runique", type: "active", power: 1.5, cooldown: 2, cost: 35,
    target: "enemy", anim: "magic", element: "umbral", inflicts: "soulmark", onHit: [{ type: "atk_debuff", amount: 0.2, turns: 2 }],
    desc: "Maléfice d'Umbral (150 %) : Marque funéraire et attaque réduite.",
  },
  tm_weaver_reaction: {
    id: "tm_weaver_reaction", name: "Tissage des éléments", type: "active", power: 1.4, cooldown: 2, cost: 35,
    target: "enemy", anim: "magic", element: "water", inflicts: "wet",
    desc: "Vague d'Eau (140 %) qui trempe la cible (+ dégâts de Foudre subis : prépare une réaction).",
  },
  tm_spellblade_slash: {
    id: "tm_spellblade_slash", name: "Taillade ensorcelée", type: "active", power: 1.6, cooldown: 1, cost: 30,
    target: "enemy", anim: "magic", element: "fire", inflicts: "burn", desc: "Lame magique de Feu (160 %) qui embrase.",
  },
  tm_archon_shift: {
    id: "tm_archon_shift", name: "Bascule d'archonte", type: "active", power: 1.8, cooldown: 2, cost: 35,
    target: "enemy", anim: "magic", element: "lightning", inflicts: "charge",
    desc: "Foudre d'archonte (180 %) qui accumule une Charge (exploite Trempé).",
  },
  tm_pactmaster_sacrifice: {
    id: "tm_pactmaster_sacrifice", name: "Pacte de sang", type: "active", power: 1.5, cooldown: 2, cost: 35,
    target: "enemy", anim: "magic", element: "umbral", self: [{ type: "atk_buff", amount: 0.25, turns: 3 }],
    desc: "Sacrifie une part de sa puissance (150 %, Umbral) pour décupler ses attaques.",
  },
  tm_apostate_surge: {
    id: "tm_apostate_surge", name: "Déferlante apostate", type: "active", power: 2.0, cooldown: 2, cost: 45,
    target: "enemy", anim: "magic", element: "chaos", desc: "Décharge instable (200 %, Chaos), redoutable à bas Mana.",
  },
  tm_arcane_sovereign_nova: {
    id: "tm_arcane_sovereign_nova", name: "Nova souveraine", type: "active", power: 2.3, cooldown: 3, cost: 55,
    target: "enemy", anim: "magic", element: "chaos", inflicts: "unstable", desc: "Cataclysme arcanique (230 %) qui déstabilise.",
  },
  tm_void_oracle_collapse: {
    id: "tm_void_oracle_collapse", name: "Effondrement du Néant", type: "active", power: 2.4, cooldown: 3, cost: 55,
    target: "enemy", anim: "magic", element: "umbral", inflicts: "soulmark", desc: "Gouffre d'Umbral (240 %) qui marque l'âme.",
  },

  // ----------------------------- VOIE ASSASSIN -----------------------------
  ts_rogue_backstab: {
    id: "ts_rogue_backstab", name: "Coup dans le dos", type: "active", power: 1.4, cooldown: 1, cost: 20,
    target: "enemy", anim: "light", critBonus: 25, desc: "Frappe sournoise (140 %, +25 % crit).",
  },
  ts_shadowblade_flurry: {
    id: "ts_shadowblade_flurry", name: "Lames d'ombre", type: "active", power: 0.6, hits: 3, cooldown: 2, cost: 30,
    target: "enemy", anim: "light", critBonus: 12, desc: "Trois frappes furtives (60 % chacune, +12 % crit).",
  },
  ts_venom_multi: {
    id: "ts_venom_multi", name: "Multi-venin", type: "active", power: 0.9, cooldown: 2, cost: 25,
    target: "enemy", anim: "light", onHit: [{ type: "poison", pctAtk: 0.25, turns: 3 }, { type: "poison", pctAtk: 0.25, turns: 3 }],
    desc: "Applique plusieurs poisons faibles (90 % + 2 poisons cumulés).",
  },
  ts_night_duelist: {
    id: "ts_night_duelist", name: "Duel nocturne", type: "active", power: 1.2, cooldown: 2, cost: 25,
    target: "enemy", anim: "light", critBonus: 20, self: [{ type: "guard", reduce: 0.5, turns: 1 }],
    desc: "Frappe en contre (120 %, +20 % crit) et pare le prochain coup.",
  },
  ts_saboteur_cut: {
    id: "ts_saboteur_cut", name: "Sabotage", type: "active", power: 1.1, cooldown: 2, cost: 30,
    target: "enemy", anim: "light", inflicts: "expose", onHit: [{ type: "atk_debuff", amount: 0.25, turns: 2 }],
    desc: "Entaille (110 %) : expose la cible (défense/résistance réduites) et l'affaiblit.",
  },
  ts_void_dancer_step: {
    id: "ts_void_dancer_step", name: "Pas du vide", type: "active", power: 1.0, cooldown: 2, cost: 25,
    target: "enemy", anim: "light", self: [{ type: "spd_buff", amount: 0.3, turns: 2 }, { type: "guard", reduce: 0.4, turns: 1 }],
    desc: "Frappe insaisissable (100 %) : Clairvoyance +30 % et esquive le prochain coup.",
  },
  ts_soul_reaper: {
    id: "ts_soul_reaper", name: "Faux d'âme", type: "active", power: 1.8, cooldown: 3, cost: 45,
    target: "enemy", anim: "light", element: "umbral", inflicts: "soulmark", critBonus: 20,
    desc: "Faux d'Umbral (180 %, +20 % crit) qui marque l'âme — mortelle sur cible affaiblie.",
  },
  ts_spectral_stalker: {
    id: "ts_spectral_stalker", name: "Traque spectrale", type: "active", power: 1.6, cooldown: 2, cost: 35,
    target: "enemy", anim: "light", critBonus: 30, desc: "Embuscade fantôme (160 %, +30 % crit).",
  },
  ts_nightwalker_rampage: {
    id: "ts_nightwalker_rampage", name: "Furie nocturne", type: "active", power: 1.7, cooldown: 2, cost: 40,
    target: "enemy", anim: "light", critBonus: 15, desc: "Déchaînement de lames (170 %), décuplé à bas PV.",
  },
  ts_threshold_execute: {
    id: "ts_threshold_execute", name: "Sentence du seuil", type: "active", power: 2.2, cooldown: 3, cost: 50,
    target: "enemy", anim: "light", critBonus: 40, desc: "Exécution (220 %, +40 % crit) sur cible affaiblie.",
  },

  // -------------------- BRANCHE NÉCROMANCIEN (Mage + Assassin) --------------------
  tn_necro_bolt: {
    id: "tn_necro_bolt", name: "Trait nécrotique", type: "active", power: 1.5, cooldown: 1, cost: 30,
    target: "enemy", anim: "magic", element: "umbral", inflicts: "soulmark",
    desc: "Trait d'Umbral (150 %) qui appose la Marque funéraire (coupe la régénération).",
  },
  tn_soul_fragment: {
    id: "tn_soul_fragment", name: "Récolte de fragments", type: "active", power: 1.2, cooldown: 2, cost: 25,
    target: "enemy", anim: "magic", element: "umbral", self: [{ type: "heal", pctMaxHp: 0.06 }],
    desc: "Arrache un Fragment d'âme (120 %, Umbral) et te soigne légèrement.",
  },

  // -------------------- INVOCATIONS (classes invocateur / nécromancien) --------------------
  // Compétences qui posent une VRAIE créature sur le terrain (voir data/summons.js
  // et le moteur d'invocations dans systems/combat.js). `summon` = id de créature.
  // Nombre d'invocations STRICTEMENT limité (voir summoner.max du nœud).
  summon_arcane_wisp: {
    id: "summon_arcane_wisp", name: "Invoquer un feu follet", type: "active", power: 0, cooldown: 3, cost: 30,
    target: "self", anim: "buff", tags: ["summon"], summon: "sm_arcane_wisp",
    desc: "Invoque un feu follet arcanique temporaire qui attaque l'ennemi à chaque tour (1 max).",
  },
  summon_bone_thrall: {
    id: "summon_bone_thrall", name: "Invoquer un serviteur d'os", type: "active", power: 0, cooldown: 3, cost: 35,
    target: "self", anim: "buff", tags: ["summon"], summon: "sm_bone_thrall",
    desc: "Invoque un serviteur d'os temporaire (2 max) qui frappe et affaiblit l'ennemi.",
  },
  summon_skeleton: {
    id: "summon_skeleton", name: "Lever un squelette", type: "active", power: 0, cooldown: 2, cost: 30,
    target: "self", anim: "buff", tags: ["summon"], summon: "sm_skeleton",
    desc: "Lève un squelette PERMANENT (jusqu'à destruction) qui combat à tes côtés (nombre limité).",
  },
};

export function getSkill(id) {
  return SKILLS[id] || null;
}

// --- Tags d'IA (instr. 236-239) ----------------------------------------------
// Le moteur ne doit PAS dépendre du texte français pour comprendre une compétence.
// Les tags décrivent la fonction d'une compétence dans un vocabulaire stable :
//   damage · heal · guard · cleanse · buff · debuff · execute · summon · control · resource
// Une compétence peut fournir `tags` explicitement ; sinon ils sont DÉRIVÉS de ses
// mécaniques (source de vérité unique : les données de la compétence, pas la desc).
export const SKILL_TAGS = ["damage", "heal", "guard", "cleanse", "buff", "debuff", "execute", "summon", "control", "resource"];

export function deriveSkillTags(skill) {
  if (!skill) return [];
  const t = new Set(skill.tags || []);
  if ((skill.power || 0) > 0) t.add("damage");
  for (const eff of skill.self || []) {
    if (eff.type === "heal") t.add("heal");
    else if (eff.type === "shield" || eff.type === "def_buff" || eff.type === "guard" || eff.type === "guard_active" || eff.type === "guard_restore") t.add("guard");
    else if (eff.type === "atk_buff" || eff.type === "spd_buff") t.add("buff");
  }
  for (const eff of skill.onHit || []) {
    if (eff.type === "poison" || eff.type === "bleed") t.add("debuff");
    else if (eff.type === "atk_debuff") t.add("debuff");
    else if (eff.type === "slow") { t.add("debuff"); t.add("control"); }
  }
  if (skill.inflicts) t.add("debuff"); // états élémentaires (Brûlure, Charge, Marque…)
  if (skill.guardConvert) t.add("resource");
  return [...t];
}

export function getSkillTags(id) {
  return deriveSkillTags(getSkill(id));
}
