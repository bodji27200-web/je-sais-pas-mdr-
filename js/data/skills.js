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
    id: "arcane_bolt", name: "Projectile arcanique", type: "active", power: 1.7, cooldown: 0, cost: 25,
    target: "enemy", anim: "magic",
    desc: "Projectile magique infligeant 170 % des dégâts.",
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
    id: "fireball", name: "Boule de feu", type: "active", power: 1.9, cooldown: 1, cost: 40,
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
    passive: { hpRegenPct: 0.018 },
    desc: "Régénère lentement (~2 % des PV max par tour).",
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
    self: [{ type: "def_buff", amount: 0.45, turns: 2 }, { type: "shield", pctMaxHp: 0.22, turns: 3 }],
    desc: "Bouclier de braise : défense +45 % et absorption sur 3 tours.",
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
