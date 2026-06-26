# Les Royaumes Oubliés — Idle RPG

Un **idle RPG fantasy jouable dans le navigateur** (aucune installation, aucun
moteur lourd). Pensé pour grandir progressivement vers un idle MMORPG, mais
d'abord centré sur une **boucle solo solide et addictive** :

> récolter → fabriquer → s'équiper → combattre → obtenir mieux → débloquer du contenu

C'est le **mini-prototype** : on valide que la boucle est amusante avant
d'ajouter les autres classes, métiers et zones.

## Contenu du mini-prototype
- **1 classe jouable** : Guerrier (2 compétences actives + 1 passive)
- **2 métiers idle** : Bûcheronnage, Minage (récolte chronométrée + hors-ligne)
- **1 zone** : la Forêt des Murmures
- **4 ennemis + 1 boss** en combat **tour par tour**
- **10 ressources**, **12 équipements** répartis en 3 familles d'armure
  (**Tissu** offensif · **Cuir** équilibré · **Métal** tank) → vrais choix de build
- **Craft** (forge, tannerie, couture, joaillerie) + **inventaire** + **équipement**
- **Sauvegarde automatique** dans le navigateur (localStorage) + résumé hors-ligne
- **Illustrations vectorielles** (classe, zone, ennemis, boss) avec surcharge PNG
- **Objectifs de départ** guidés + **compte à rebours exact** pendant la récolte
- **Game-feel de combat** : dégâts flottants, flash/secousse à l'impact, sons synthétisés (désactivables via ⚙)

## Jouer en local
Le jeu utilise les modules ES : il faut le servir via HTTP (pas en `file://`).

```bash
# depuis la racine du dépôt
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Déploiement (lien jouable)
Un workflow GitHub Actions publie le site sur **GitHub Pages** à chaque push.

1. Dans le dépôt : **Settings → Pages → Build and deployment → Source = GitHub Actions**.
2. Pousser sur `main` (ou la branche de dev) → l'URL de jeu apparaît dans
   l'onglet **Actions** puis dans **Settings → Pages**.

## Architecture (data-driven, faite pour grandir)
```
index.html            Point d'entrée
css/styles.css        Thème dark fantasy
js/
  data/               CONTENU pur (ajouter du contenu = éditer ces fichiers)
    classes.js  skills.js  jobs.js  resources.js
    equipment.js  recipes.js  enemies.js  zones.js
  core/               Moteur transverse
    state.js          État global + sauvegarde
    character.js      Stats dérivées, équipement, PV, XP
    progression.js    Courbes d'XP
  systems/            Règles de jeu
    jobs.js           Récolte idle + hors-ligne
    crafting.js       Craft
    combat.js         Combat tour par tour
  ui/
    dom.js            Helpers d'affichage
    views.js          Rendu des écrans
  main.js             Contrôleur (navigation, boucle, clics)
assets/               Illustrations (voir assets/README.md)
```

### Ajouter du contenu
- **Une ressource / un équipement / un ennemi / une zone** : ajouter une entrée
  dans le fichier `js/data/*.js` correspondant. Aucune logique à toucher.
- **Une recette** : ajouter un objet dans `js/data/recipes.js`.
- **Une classe** : passer `locked: false` et définir stats/compétences dans
  `js/data/classes.js` (+ compétences dans `skills.js`).
- **Une illustration** : déposer un PNG au chemin indiqué (voir `assets/README.md`) ;
  elle remplace automatiquement l'emoji de secours.

## Volontairement hors-périmètre (pour l'instant)
Multijoueur, PvP, guildes, marché entre joueurs, monde ouvert, énergie bloquante,
multiples monnaies. Ils viendront **après** que la boucle solo soit excellente.
