# Architecture & Audit technique

> Document de référence du chantier « RPG idle stratégique ». Décrit l'état réel
> du dépôt, les systèmes existants et les points d'extension. Mis à jour à chaque
> lot. **Lot 1 — audit initial.**

## Vue d'ensemble

Jeu **100 % statique** (HTML + CSS + modules ES, aucun build). Déployé sur GitHub
Pages. Architecture **data-driven** : le contenu vit dans `js/data/*.js`, le moteur
dans `js/core` et `js/systems`, le rendu dans `js/ui`. Ajouter du contenu = éditer
des données, sans toucher au moteur.

```
index.html              Point d'entrée (charge js/main.js en module)
css/styles.css          Thème dark fantasy (787 lignes) — NE PAS refaire
js/
  data/                 CONTENU pur (objets + getters)
    classes.js          5 classes jouables (stats de base, croissance, armes, passive)
    skills.js           Compétences joueur/ennemi/spécialisation (actives + passives)
    specializations.js  15 voies (3/classe, niv. 10) : statMods, passive, grants, mastery
    jobs.js             2 métiers (bûcheronnage, minage) — actions chronométrées
    resources.js        11 ressources (matières, intermédiaires, butin)
    equipment.js        25 équipements (armes par classe + 3 familles d'armure)
    recipes.js          Recettes (4 stations : forge/tannerie/couture/joaillerie)
    enemies.js          14 ennemis + 3 boss (3 zones) ; bosses = phases + 2 passives
    zones.js            3 zones (progression ordonnée, déblocage de zone par boss)
    rarities.js         5 raretés (commun -> légendaire), poids + sensibilité chance
  core/                 Moteur transverse
    state.js            État global, sauvegarde localStorage, MIGRATIONS (v1->v3)
    character.js        Stats dérivées, équipement, sets, spécialisation, XP perso
    items.js            Instances uniques d'objets, raretés, variance, loot
    progression.js      Courbes d'XP (perso + métier), applyXp, rollAmount
    audio.js            Sons synthétisés (WebAudio) — navigateur uniquement
  systems/              Règles de jeu
    jobs.js             Récolte idle + rattrapage hors-ligne (plafond 8 h)
    crafting.js         Craft instantané (vérif. prérequis, conso, production)
    combat.js           Combat tour par tour, INITIATIVE par vitesse, IA de scoring
    gear.js             Renforcement (+0..+5) et démantèlement
    objectives.js       Mini-checklist de découverte (5 objectifs one-way)
    zoneprog.js         Déblocage ordonné des ennemis/boss, % de zone
  ui/
    dom.js              Helpers (esc, sigil PNG->SVG->emoji, bar, toast, modal)
    views.js            Rendu HTML des écrans (716 lignes)
  main.js               Contrôleur : navigation, boucle (500 ms), délégation de clics
assets/                 SVG livrés + surcharge PNG (chemins dans data/*.js)
tests/                  Tests logiques (Node natif, sans dépendance) — AJOUTÉ Lot 1
```

## Boucle de jeu

`main.js` lance `setInterval(tick, 500)`. Chaque tick :
1. `processActivity` complète les cycles de récolte écoulés (même en combat).
2. Vérifie objectifs + déblocage de spécialisation.
3. Régénère les PV hors combat.
4. **Mise à jour DOM CIBLÉE** (`updateTick`) : largeurs de barres + textes, JAMAIS
   de recréation d'`<img>` (sinon scintillement). Sauvegarde tous les 6 ticks (3 s).

Le combat est piloté au clic : `resolveRound` joue l'action du joueur puis les
tours dus de l'ennemi. L'arène est rendue **une fois** ; barres/log/contrôles
sont rafraîchis de façon ciblée. **Contrainte forte à préserver.**

## Systèmes — état actuel et limites

### Statistiques (`character.js`)
- 5 stats : `hp, atk, def, spd, crit`. Dérivées = base classe + croissance×(niv-1)
  + équipement + bonus de matériaux (seuils 2/4) + passive de classe + spé.
- Défense : rendements décroissants `def/(def+90)`, plafond 75 % (`combat.js`).
- **Lot 6** : `getStatDetails(state)` expose la **décomposition** base / équipement /
  bonus (somme exacte au total), affichée sous chaque stat ; la Défense montre sa
  réduction de dégâts effective.
- **Limite (Lot 7)** : pas encore de stats secondaires nommées (précision,
  résistances élémentaires) — viennent avec les éléments/états.

### Vitesse & initiative (`combat.js`)
- Système `nextAt` : `nextAt += 100/spd` après chaque action. Le plus petit agit.
  Plafond `MAX_CONSEC = 2` actions consécutives.
- **Lot 6** : `forecastTurns()` affiche l'**ordre probable des prochains tours** ;
  la Vitesse réduit légèrement les recharges (`cdFactor`, **plafonné à −20 %**).

### Métiers (`jobs.js` + `data/jobs.js`) — refondus Lot 2
- **Une activité principale par métier**, structurée en **paliers** (`tiers`) :
  le jeu propose toujours le meilleur palier maîtrisé et évolue automatiquement
  au niveau (mode `auto`). Le joueur peut choisir un palier inférieur (sélecteur
  de chips → mode manuel). Notification une fois par nouveau palier.
- Activité : `{ jobId, tierId, cycleStart, auto }` (migration v3→v4).
- Courbe d'XP **data-driven** (`js/data/curves.js`), plafonnée au **niveau 100**
  (`applyXp` cappé via `MAX_LEVEL`).
- Hors-ligne plafonné 8 h, **efficacité 70 %** (`OFFLINE_EFFICIENCY`) : la récolte
  active reste préférable.
- **Lot 3** : nouveaux paliers (charbon L7, argent L14, bois ancestral L10) avec
  usages craft réels. **Métiers de transformation à niveau propre** : `state.professions`
  (Fonte/Forge/Tannerie/Couture/Joaillerie), XP gagnée en fabriquant, recettes
  gardées par niveau de métier (`profReq`). Migration v4→v5.
- **Reste à faire** : Alchimie/Cuisine (consommables), outils de métier, filtres
  de l'Atelier (Lot 4).

### Combat & IA (`combat.js`)
- DoT (poison/saignement), buffs/debuffs, garde, bouclier, soin, vol de vie,
  passives dynamiques (execute, lowHpAtk, vsDebuff, skillPower).
- IA par **scoring situationnel** (soin si bas, burst pour achever, ne double pas
  un DoT actif…). Bonne base à étendre.
- **Lot 8** : **ressources de classe** (`data/classResources.js`) lues par le
  moteur de façon générique (`player.res = { cur, max, gen }`, transitoire au
  combat → **aucune migration**). Règles de gain (`onBasicAttack`, `onDealDamage`,
  `onTakeDamage`, `onCrit`, `onGuardAbsorb`, `onDefensiveSkill`, `regenPerTurn`).
  Rage (Guerrier), Garde (Gardien), Concentration (Archer), Mana (Mage), Ombre
  (Assassin). Les compétences ont un **coût** (`skill.cost`) + recharges
  rééquilibrées : l'attaque de base est gratuite et **génère** la ressource ;
  `playerCanUse`/`whyCannotUse` vérifient recharge **et** ressource. Les ennemis
  n'ont pas de ressource → leurs compétences sont sans coût (rétrocompatible).
- **Lot 9** : **simulateur de duel** (`simulateDuel`, `buildPlayerCombatant`,
  `pickSkillGeneric` dans `combat.js`) réutilisant le vrai moteur (ressources,
  coûts, états, matériaux, passifs). Sert à mesurer l'équilibre des 5 classes et
  des 15 voies. Audit (`tests/balance.test.js`, équipement comparable) : **aucun
  build dominant** (>60 % contre toutes), **aucun build inutile**, voies d'une
  même classe resserrées. Ajustements : départ de ressource Guerrier/Assassin
  (ouverture), Templier offensif, Rempart plus increvable, Rôdeur/Trappeur revus.
- **Lot 11** : **familiers** (`data/familiars.js` + `systems/familiars.js`),
  persistés (**migration v7→v8**). Soutien LÉGER : le familier équipé applique un
  petit passif au héros en combat (PV/crit/vitesse/régén/vol de vie/synergie
  d'élément via `effectiveFamiliarPassive` → appliqué dans `buildPlayerCombatant`)
  et apparaît, petit et espacé, près du héros dans l'arène. Œufs (3 paliers,
  poids clairs/testables) lâchés par les boss + 1 offert ; doublon → **Essence**
  (nourrir = +lien). Niveau plafonné au héros, **lien** (×1,5 %/cran). Écran
  Familiers (collection + silhouettes non découvertes, filtres élément/rôle/rareté,
  éclosion, équipement, nourrissage). 11 SVG originaux.
- **Lot 10** : **phases de boss** data-driven (`enemy.phases` : seuils de PV qui
  changent une RÈGLE — atk, brise-bouclier, élément, perce-défense, compétence
  signature — pas un simple +atk) + **intentions télégraphiées** (`planIntent`,
  `nextEnemySkill`, `enemyIntentInfo` : le boss s'engage sur sa prochaine action,
  le joueur peut réagir) + **2e passive** boss (`secondPassive`). `effectiveAtk`
  intègre `phaseAtkPct`, `dealDamage` applique `phaseDefShred` et l'élément de
  phase. 2 zones (Ombrepierre/Umbral, Pyrelac/Feu-Foudre), **5 ennemis chacune**
  à mécaniques distinctes + 1 boss à phases ; déblocage de zone par boss précédent
  (`zoneUnlocked`). Sélecteur de zones dans le menu Combat. Drops = ressources
  EXISTANTES (anti-orphelin). **26 SVG originaux** (créatures + biomes, style
  maison, zéro emoji final).

### Équipement & raretés (`items.js`, `rarities.js`)
- Instances uniques : `{uid, baseId, rarity, stats, lvl}`. Rareté = multiplicateur
  global des stats + variance ±8 %. Renforcement +0..+5 (×4 %/niv).
- **Lot 5** : 7 emplacements (arme, tête, torse, **mains**, jambes, **bottes**,
  accessoire). Matériaux d'armure (`data/materials.js`) avec **bonus de seuil
  2/4 pièces cumulables** (builds hybrides viables) + un **passif comportemental**
  par matériau, implémenté dans le combat : Tissu *Concentration* (compétence
  renforcée après 2 compétences différentes), Cuir *Souplesse* (esquive + crit),
  Métal *Stabilité* (1re attaque subie réduite). Migration v5→v6.
- **Limite (Lot 19)** : la rareté multiplie encore TOUTES les stats au lieu de
  piloter des **affixes** par familles cohérentes.

### Sauvegarde (`state.js`)
- `SAVE_VERSION = 8`. Migrations v1→v8 (instances, spécialisations, métiers,
  professions, slots d'armure, bestiaire, **familiers v7→v8**). **Lot 1 a ajouté** : copie de sécurité (`BACKUP_KEY`) écrite
  avant migration ; la migration n'écrase l'original que si elle aboutit ; une
  sauvegarde corrompue ne casse pas et n'est pas écrasée.

## Contraintes à NE PAS casser (rappel)
- Style visuel, thème, **arène de combat** (petits personnages espacés, dash,
  impacts, retours en place, anti-scintillement). Pas de re-render global.
- Pas de carte du monde. Pas de refonte CSS. Pas d'emoji comme icône finale
  (réutiliser/créer des SVG). Compat mobile + navigateur Xbox (paysage).
- Sauvegardes préservées : toute évolution de schéma = nouvelle version + migration.

## Tests (ajout Lot 1)
- Lanceur **Node natif** (`node --test`), zéro dépendance. `npm test`.
- Couverture initiale : courbes d'XP, distribution des raretés (50 000 tirages,
  graine reproductible), métiers (cycles + hors-ligne plafonné), combat
  (déterminisme sous graine, terminaison, 5 classes), sauvegarde (migration v1,
  copie de sécurité, robustesse à la corruption).
- Helper `withSeed(seed, fn)` : remplace temporairement `Math.random` par un PRNG
  mulberry32 pour des tests déterministes sans réécrire le moteur.

## Plan des lots
1. ✅ Audit, sécurité de sauvegarde, infrastructure de tests, doc.
2. ✅ Métiers : une activité principale évolutive par métier (+ courbe 1..100
   data-driven, hors-ligne 70 %).
3. ✅ Métiers de transformation à niveau propre (Fonte ≠ Forge, XP en fabriquant,
   recettes gating par niveau de métier) + paliers de ressources (charbon,
   argent, bois ancestral) câblés à des usages réels (anti-orphelin testé).
4. ✅ Atelier : catégories (Armes/Armures/Accessoires/Matériaux), filtres
   (catégorie, classe, réalisable), recherche en direct (objet + matériau),
   cartes enrichies (type, métier requis, classes compatibles), résumé métiers.
5. ✅ Matériaux d'armure : 2 nouveaux slots (mains/bottes), bonus de seuil 2/4
   cumulables (hybrides viables), passif comportemental par matériau en combat,
   section dédiée dans l'écran Personnage. Migration v5→v6.
6. ✅ Stats lisibles (décomposition base/équip/bonus), aperçu de l'ordre des
   tours, Vitesse → recharge réduite plafonnée, réduction de défense affichée.
7. ✅ Éléments (8), états (Brûlure/Trempé/Charge/…), résistances ennemies,
   bestiaire de découverte. Moteur : multiplicateur élémentaire + états génériques.
8. ✅ Ressources de classe (Rage/Garde/Concentration/Mana/Ombre), coûts de
   compétences + recharges rééquilibrées, attaque de base génératrice, barre de
   ressource en combat + explication sur la fiche perso. Tests : 12 cas dédiés
   (génération, coûts, plafonds, intégrité des coûts ≤ plafond). Pas de migration
   (ressource transitoire au combat).
9. ✅ Simulateur de duel (réutilise le vrai moteur) + audit/équilibrage des 15
   voies : aucun build dominant ni inutile, voies d'une classe resserrées.
   Tests : 5 cas d'invariants d'équilibrage (round-robin, équipement comparable).
10. ✅ 2 zones (10 ennemis à mécaniques distinctes + 2 boss à phases), intentions
   télégraphiées, déblocage de zone, sélecteur de zones, 26 SVG originaux.
   Tests : 7 cas (zones, déblocages ordonnés, phases, intentions, terminaison).
11. ✅ Familiers (collection, œufs, lien, soutien léger en combat + arène, écran
   dédié, 11 SVG). Migration v7→v8. Tests : 8 cas (distribution, doublons,
   équipement, lien, plafond d'XP, passif en combat).
12. ✅ Guides contextuels (1×/système, réouvrables, désactivables), quêtes de
   découverte (récompenses, indices adaptés à la classe), succès/badges (14,
   évalués en direct). Migration v8→v9. Tests : 8 cas.
10. 2 nouvelles zones, 5 ennemis chacune, boss à phases.
11. Familiers (première version complète).
12. Guides contextuels, quêtes de découverte, succès.
13. Serveur + groupe privé réel (2 joueurs).
14. Chat de groupe + combat coopératif synchronisé.
15. Premier boss mondial coopératif.
