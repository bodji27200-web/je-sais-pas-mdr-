# Audit — Refonte du système de classes, statistiques, compétences et combat

> Confrontation du cahier des charges (≈ 350 directives) **au code réel** du
> dépôt, et séquencement en lots isolés, testables et rétrocompatibles.
> Aucun refactoring massif : on approfondit l'existant sans casser les saves.

## 1. État réel constaté (ne pas se fier à la description)

| Domaine | Réalité du code | Écart avec le cahier des charges |
|---|---|---|
| Niveau max | `MAX_LEVEL = 100` (`data/curves.js`) | Les seuils de rangs doivent être 10 paliers réguliers **sur 100**, pas 50 ni 225. |
| Classes | 5 classes jouables, **non verrouillées** (`data/classes.js`) ; pas d'arbre, pas de rangs | Arbre vertical à 10 rangs à construire **par-dessus** les 5 voies existantes. |
| Spécialisations | 15 voies (3/classe), débloquées niv. 10 (`data/specializations.js`) | À transformer en **nœuds** de l'arbre, sans perdre les déblocages (instr. 14, 315). |
| Statistiques | 5 stats : `hp, atk, def, spd, crit` | Cahier : 12 stats (PV, Mana, Garde, Attaque, Défense, Magie, Résistance, Dextérité, Précision, Clairvoyance, Chance critique, Dégâts critiques). |
| « Vitesse » | clé moteur `spd`, initiative `nextAt += 100/spd`, `MAX_CONSEC = 2` | À renommer **Clairvoyance** ; ne multiplie pas les actions (déjà borné à 2). |
| Esquive | uniquement via Cuir 4 pièces (`souplesse`, 14 % plat) | Système **Dextérité vs Précision**, plafond **60 %** (instr. 39-60). |
| Critique | `crit` (%) sans plafond, `CRIT_MULT = 1.6` fixe | Plafond ~50 % (hors buffs), **Dégâts critiques** comme stat plafonnée (instr. 92-95). |
| Garde | (a) effet de skill « réduit le prochain coup » ; (b) ressource de classe du Gardien nommée « Garde » | Cahier : réserve numérique séparée, absorption 35→80 %, rupture, conversion (instr. 71-85). |
| Magie / Résistance | inexistantes : le Mage tape avec `atk`/`def` | Axe magique réel `mag` vs `res`, rendements décroissants (instr. 37-38, 87-88). |
| Familiers | 11 familiers, soutien léger (`data/familiars.js`) | Rôles irremplaçables à clarifier, régén PV plafonnée très bas (instr. 279-301). |
| IA | scoring situationnel + intentions télégraphiées de boss | Cahier : **ne pas** annoncer la prochaine action (instr. 29-30, 272) → à revoir. |
| Sauvegarde | `SAVE_VERSION = 11`, migrations v1→v11 sûres (backup + non destructif) | Chaque nouvelle propriété = **migration versionnée** (instr. 11-12, 313-318). |
| Tests | 135 tests verts (`node --test`) | À étendre : esquive, clairvoyance, garde, dégâts, migrations, simulations (instr. 319-333). |

### Contraintes fortes (rappel, à NE PAS casser)
- Style sombre, arène, anti-scintillement (pas de re-render global). Pas de carte
  du monde. **Aucun nouvel emoji** comme icône (CSS sobre / assets préparés).
- Mobile + navigateur Xbox + clavier/souris/tactile.
- Sauvegardes préservées : migration à chaque évolution de schéma.

## 2. Décisions d'implantation (adaptation au code réel)

- **Clé moteur `spd` conservée**, relabellisée **« Clairvoyance »** partout dans
  l'UI/les infobulles. Renommer la clé dans *toutes* les instances d'équipement
  sauvegardées serait un refactoring massif (instr. 4) et risquerait les saves
  (instr. 11-12) ; on respecte donc l'**objectif** (Clairvoyance = initiative, ne
  multiplie pas les actions) sans réécrire le moteur. Documenté ici en clair.
- **Source unique de vérité** pour les stats : `js/data/combatStats.js` (libellés,
  abréviations, **infobulles décrivant la formule réelle**). L'UI lit cette source
  et les valeurs viennent de `getDerivedStats` (mêmes chiffres qu'en combat —
  instr. 50).
- Nouvelles stats ajoutées de façon **additive** : `mag, res, dex, acc, critDmg`,
  avec base/croissance par classe et **défauts dérivés** pour les données qui ne
  les déclarent pas encore (ennemis), afin de ne rien casser.

## 3. Séquence des lots

1. **Audit** (ce document).
2. **Statistiques de combat** : `combatStats.js` ; dérive `mag/res/dex/acc/critDmg` ;
   **esquive Dextérité vs Précision plafonnée à 60 %** + log « Esquive » ; **plafonds
   de critique** + Dégâts critiques ; **Résistance** (mitigation élémentaire) et
   **Magie** (bonus aux compétences magiques) câblées ; migration **v11→v12** ;
   infobulles UI. Tests : esquive (0 %, moyen, plafond, opposition Précision),
   plafond de critique, chargement d'une save v11.  ← *livré cette session*
3. Garde-réserve + file d'initiative explicite (instr. 61-85).
4. Arbre de classes vertical à 10 rangs (instr. 101-145).
5. Compétences/passifs data-driven enrichis + tags IA (instr. 236-261).
6. IA sans télégraphie + mémoire légère (instr. 262-278).
7. Familiers : rôles irremplaçables + plafonds (instr. 279-301).
8. Équilibrage par simulations de masse (instr. 325-333).
9. Finitions UI/perf/QA + déploiement (instr. 334-350).

> Chaque lot : commit isolé, tests verts, save chargeable, résumé en fin de lot.
