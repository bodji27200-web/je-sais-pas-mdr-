// Statistiques de combat — SOURCE UNIQUE DE VÉRITÉ (libellés + infobulles).
//
// L'interface lit cette table ; les VALEURS affichées proviennent de
// `getDerivedStats` (mêmes chiffres qu'en combat). Les infobulles décrivent le
// FONCTIONNEMENT RÉEL du moteur (formules), pas une phrase décorative.
//
// Choix d'implantation (voir docs/AUDIT-refonte-classes.md) :
//   - « Clairvoyance » est le nom de jeu de l'initiative. La clé MOTEUR reste
//     `spd` (renommer la clé dans toutes les instances d'équipement sauvegardées
//     serait un refactoring massif et risquerait les saves). On respecte donc
//     l'objectif (Clairvoyance = ordre d'action, ne multiplie pas les actions)
//     sans réécrire le moteur.
//   - Aucune icône emoji : un sigle CSS sobre (`abbr`) suffit.
//
// Champs :
//   key   : champ renvoyé par getDerivedStats (ou ressource transitoire)
//   name  : nom affiché
//   abbr  : sigle court (chip CSS, pas d'emoji)
//   group : "offense" | "defense" | "tempo" | "resource"
//   pct   : true si la valeur s'exprime en pourcentage
//   tip   : infobulle (décrit la formule réelle)

export const PRIMARY_STATS = {
  hp: {
    id: "hp", key: "maxHp", name: "PV", abbr: "PV", group: "defense",
    tip: "Points de vie : ta survie réelle. À 0, tu es vaincu. Le maximum ne sert PAS de bouclier caché : seuls les soins, boucliers et la Garde restaurent ou protègent les PV.",
  },
  mana: {
    id: "mana", key: "mana", name: "Mana", abbr: "MN", group: "resource",
    tip: "Ressource des sorts et techniques avancées (Mage surtout). Se régénère chaque tour ; l'attaque de base en redonne un peu. Sans Mana suffisant, le sort est indisponible.",
  },
  guard: {
    id: "guard", key: "guard", name: "Garde", abbr: "GA", group: "resource",
    tip: "Réserve défensive séparée des PV et de la Défense. Quand la Garde est active, une partie des dégâts reçus est redirigée vers cette réserve ; brisée, elle s'arrête.",
  },
  atk: {
    id: "atk", key: "atk", name: "Attaque", abbr: "ATK", group: "offense",
    tip: "Augmente les dégâts PHYSIQUES (compétences sans élément). Les soins et boucliers n'en dépendent pas, sauf mention explicite d'une compétence.",
  },
  mag: {
    id: "mag", key: "mag", name: "Magie", abbr: "MAG", group: "offense",
    tip: "Amplifie les dégâts MAGIQUES (compétences à élément : Feu, Eau, Foudre…) avec un rendement décroissant et plafonné. N'affecte pas les attaques purement physiques.",
  },
  def: {
    id: "def", key: "def", name: "Défense", abbr: "DEF", group: "defense",
    tip: "Réduit les dégâts PHYSIQUES reçus avec un rendement décroissant : réduction = def/(def+90), plafonnée à 75 % (jamais 0 dégât quand l'attaque touche).",
  },
  res: {
    id: "res", key: "res", name: "Résistance", abbr: "RES", group: "defense",
    tip: "Réduit les dégâts MAGIQUES (élémentaires) reçus, selon une formule parallèle à la Défense et plafonnée. Une Résistance élevée reste utile sans rendre invulnérable.",
  },
  dex: {
    id: "dex", key: "dex", name: "Dextérité", abbr: "DEX", group: "tempo",
    tip: "Probabilité d'ESQUIVER une attaque, comparée à la Précision de l'attaquant. Rendement décroissant, plafonné à 60 % d'esquive même avec des bonus temporaires.",
  },
  acc: {
    id: "acc", key: "acc", name: "Précision", abbr: "PRE", group: "offense",
    tip: "Contre la Dextérité adverse : plus ta Précision est haute, moins la cible esquive. Empêche les builds d'esquive de devenir invincibles, sans jamais ignorer toute esquive.",
  },
  spd: {
    id: "spd", key: "spd", name: "Clairvoyance", abbr: "CLV", group: "tempo",
    tip: "Capacité à lire le combat : détermine l'ordre d'action (initiative). Agir avant l'adversaire et réduire légèrement ses recharges (jusqu'à -20 %). Ne multiplie PAS le nombre d'actions (au plus 2 d'affilée).",
  },
  crit: {
    id: "crit", key: "crit", name: "Chance critique", abbr: "CC", group: "offense", pct: true,
    tip: "Probabilité d'un coup critique. La part venant de la stat est plafonnée à 50 % ; certaines compétences ou passifs peuvent dépasser ponctuellement, sans jamais garantir un critique permanent.",
  },
  critDmg: {
    id: "critDmg", key: "critDmg", name: "Dégâts critiques", abbr: "DC", group: "offense", pct: true,
    tip: "Puissance supplémentaire d'un coup critique. 60 = ×1,6 dégâts. Plafonné globalement pour qu'une seule attaque ne supprime pas un boss sans contrepartie.",
  },
};

// Ordre d'affichage dans l'écran Personnage (stats dérivées exposées).
export const STAT_PANEL_ORDER = ["hp", "atk", "mag", "def", "res", "dex", "acc", "spd", "crit", "critDmg"];

export function getStatDef(id) {
  return PRIMARY_STATS[id] || null;
}
