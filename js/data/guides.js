// Guides contextuels (Lot 12) — data-driven. Affichés UNE fois à la première
// ouverture d'un grand système (clé = id d'onglet), réouvrables via le bouton
// d'aide, désactivables dans les options. Le contenu EXPLIQUE le système (pas un
// simple ordre).

export const GUIDES = {
  jobs: {
    id: "jobs", title: "Les Métiers",
    lines: [
      "Une activité continue même hors ligne (jusqu'à un plafond) — lance-la et fais autre chose.",
      "Les ressources récoltées changent automatiquement avec ton niveau de métier (paliers).",
      "Les outils (hache, pioche…) améliorent le rendement.",
      "Certaines zones débloquent des ressources particulières.",
    ],
  },
  craft: {
    id: "craft", title: "L'Atelier",
    lines: [
      "La Fonte transforme les minerais en lingots ; la Forge fabrique armes et armures.",
      "Chaque matériau (Tissu, Cuir, Métal) a une identité : magie, mobilité, défense.",
      "Utilise les filtres et la recherche pour t'y retrouver.",
      "Une recette grisée t'indique pourquoi : niveau de métier, matériau manquant ou classe.",
    ],
  },
  combat: {
    id: "combat", title: "Le Combat",
    lines: [
      "Chaque classe a une ressource (Rage, Mana, Ombre…) : l'attaque de base la génère, les grosses compétences la consomment.",
      "Les compétences ont une recharge : pas de spam des coups les plus forts.",
      "Les éléments interagissent avec les états (Trempé amplifie la Foudre, Brûlure réduit les soins…).",
      "Un boss annonce son intention : prépare-toi (défends-toi, affaiblis-le) avant le gros coup.",
    ],
  },
  familiars: {
    id: "familiars", title: "Les Familiers",
    lines: [
      "Les familiers éclosent d'œufs (boss, récompenses). Un doublon devient de l'Essence.",
      "Équipe-en un : il t'épaule en combat (soutien léger) et apparaît à tes côtés.",
      "Le familier gagne de l'expérience en combattant (plafonné à ton niveau).",
      "Nourris-le avec de l'Essence pour renforcer votre lien… et son passif.",
    ],
  },
};

export function getGuide(id) {
  return GUIDES[id] || null;
}
