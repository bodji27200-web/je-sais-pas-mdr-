# Architecture — Coopération en DUO (préparation technique)

> **Statut : document de conception uniquement.** Aucun fichier de jeu n'est
> modifié. Aucune implémentation n'est commencée. Ce document prépare un futur
> multijoueur **coopératif strictement à deux joueurs**, avec un **serveur
> autoritaire**, pour un jeu web aujourd'hui 100 % statique (GitHub Pages).
>
> **Inspiration assumée : _Heroes of Aethric RPG_.** On reprend la philosophie
> qui rend ce jeu excellent en duo : combat **tour par tour** lisible, ordre
> d'action gouverné par une statistique de tempo (ici la **Clairvoyance**),
> ennemis qui jouent leur **kit réel** (stats, compétences, passifs, éléments,
> résistances, IA décisionnelle) plutôt que des combats scriptés, **donjons à
> vagues** sans déplacement sur une carte, **raids** pensés pour un petit groupe,
> et soutien mutuel fort (soins, boucliers, buffs, provocations ciblant l'allié).
> On ne copie aucun contenu ; on s'inspire de la **structure de jeu**.

> **⚠️ Refonte en cours sur une autre branche.** Une instance parallèle de
> Claude Code détient une version plus récente (refonte du combat, des
> statistiques, de la Garde, de l'IA, des familiers) **non encore poussée**. La
> branche actuelle contient donc une version **ancienne**. Pour cette raison :
> - on **ne se base pas** sur les noms exacts des statistiques actuelles ;
> - toutes les structures réseau utilisent des **enveloppes génériques** ;
> - chaque dépendance au moteur est marquée **`À CONFIRMER APRÈS FUSION`**.

---

## Table des matières

1. [Architecture générale (client / serveur / base de données)](#1-architecture-générale)
2. [Structure d'un compte joueur](#2-compte-joueur)
3. [Structure d'un groupe de deux joueurs](#3-groupe-duo)
4. [Structure d'un combat coopératif en duo](#4-combat-coopératif-duo)
5. [Protocole de messages WebSocket](#5-protocole-websocket)
6. [Validations effectuées par le serveur](#6-validations-serveur)
7. [Gestion des tours et de la Clairvoyance](#7-tours-et-clairvoyance)
8. [Attendre les choix des deux joueurs](#8-attente-des-deux-joueurs)
9. [Résolution de l'ordre des actions (joueurs + ennemis)](#9-résolution-de-lordre)
10. [Délai maximal avant action automatique](#10-délai-et-action-automatique)
11. [Déconnexion et reconnexion](#11-déconnexion-reconnexion)
12. [Synchronisation des sauvegardes](#12-synchronisation-des-sauvegardes)
13. [Prévention de la duplication d'objets](#13-anti-duplication-dobjets)
14. [Prévention des actions envoyées plusieurs fois](#14-anti-rejeu-dactions)
15. [Identifiants uniques de commandes](#15-identifiants-de-commandes)
16. [Protection contre la modification du client](#16-anti-triche-client)
17. [Récompenses individuelles et communes](#17-récompenses)
18. [Création des donjons à vagues](#18-donjons-à-vagues)
19. [Persistance des buffs entre les vagues](#19-persistance-entre-vagues)
20. [Limites d'empilement des buffs](#20-limites-dempilement)
21. [Adaptation des ennemis à exactement deux joueurs](#21-adaptation-duo)
22. [Choix de cible de l'IA](#22-ciblage-ia)
23. [Raids exclusivement duo](#23-raids-duo)
24. [Tests réseau et tests de sécurité](#24-tests)
25. [Ordre d'implémentation en petits lots](#25-ordre-dimplémentation)
26. [Principaux risques techniques](#26-risques)

Annexes : [A. Glossaire générique des stats](#annexe-a) ·
[B. Points à confirmer après la fusion](#annexe-b) ·
[C. Deux types de buffs](#annexe-c)

---

<a name="1-architecture-générale"></a>
## 1. Architecture générale (client / serveur / base de données)

### 1.1 Principe directeur : serveur autoritaire

Le **serveur est l'unique source de vérité**. Le client est un **terminal
d'affichage et d'intention** : il dessine l'état que le serveur lui envoie et
transmet les souhaits du joueur. Le client **ne calcule jamais** :

- les dégâts, esquives, critiques ;
- l'ordre des tours (Clairvoyance) ;
- les coûts de ressource (Mana / Garde / Rage / etc.) ni les cooldowns ;
- les récompenses, objets, expérience, or ;
- les PV / Garde / Mana restants.

Le client envoie une **intention** (« j'utilise telle compétence sur telle
cible »). Le serveur **vérifie, calcule, applique, puis diffuse** le résultat
réel aux deux joueurs.

### 1.2 Schéma global

```
                         ┌─────────────────────────────────────────┐
                         │              FRONTEND                    │
                         │   GitHub Pages (site statique inchangé)  │
                         │   - moteur de jeu solo existant          │
                         │   - NOUVEAU module client coop (réseau)  │
                         └───────────────┬─────────────────────────┘
                                         │  WebSocket sécurisé (wss://)
                                         │  + REST/HTTPS pour l'auth
                                         ▼
                         ┌─────────────────────────────────────────┐
                         │            BACKEND Node.js               │
                         │     (Render / Railway / Fly.io / …)      │
                         │  ┌───────────────────────────────────┐   │
                         │  │ Passerelle WebSocket (ws / uWS)   │   │
                         │  ├───────────────────────────────────┤   │
                         │  │ Service Auth (HTTPS REST)         │   │
                         │  │ Service Salons (duo, max 2)       │   │
                         │  │ MOTEUR DE COMBAT AUTORITAIRE      │   │
                         │  │ Service Donjons / Raids / Vagues  │   │
                         │  │ Service Récompenses (idempotent)  │   │
                         │  └───────────────┬───────────────────┘   │
                         └──────────────────┼───────────────────────┘
                                            │
                                            ▼
                         ┌─────────────────────────────────────────┐
                         │       BASE DE DONNÉES PERSISTANTE        │
                         │   PostgreSQL (comptes, saves, récomp.)   │
                         │   + Redis (option : état chaud, présence,│
                         │     idempotence, reprise de combat)      │
                         └─────────────────────────────────────────┘
```

### 1.3 Pourquoi ce découpage (réaliste et économique)

- **Frontend inchangé sur GitHub Pages** : zéro coût d'hébergement du jeu,
  déploiement déjà en place. Le multijoueur s'ajoute en **module séparé** chargé
  uniquement quand le joueur ouvre l'écran « Coop ». Le solo continue de
  fonctionner hors-ligne.
- **Backend Node.js mono-service** au départ (un seul processus, un seul port) :
  suffisant pour un jeu tour par tour (trafic = quelques messages par tour, pas
  du temps réel à 60 Hz). Hébergeable sur un **palier gratuit/peu coûteux**
  (Render Web Service, Railway, Fly.io). Attention au « cold start » des paliers
  gratuits (voir §26).
- **PostgreSQL managé** pour la persistance (comptes, sauvegardes, journal des
  récompenses). **Redis optionnel** pour l'état de combat « chaud », la présence
  en ligne, les clés d'idempotence et la reprise rapide. Si l'on veut éviter
  Redis au départ, l'état de combat vit **en mémoire du processus** avec un
  **snapshot périodique en base** (suffisant pour un MVP, voir §11/§26).

### 1.4 Frontières client/serveur (récapitulatif)

| Décision | Calculée par | Le client peut… |
| --- | --- | --- |
| Dégâts / soin / bouclier | **Serveur** | afficher le nombre reçu |
| Esquive / critique | **Serveur** | jouer l'animation |
| Ordre des tours (Clairvoyance) | **Serveur** | afficher l'ordre prévu |
| Coût de ressource / cooldown | **Serveur** | griser un bouton (indicatif) |
| Cible valide ? | **Serveur** (re-vérifié) | filtrer l'UI (confort) |
| Récompenses / loot / XP / or | **Serveur** | afficher le butin attribué |
| PV / Garde / Mana restants | **Serveur** | dessiner les barres |

> Toute aide d'UI (boutons grisés, cibles pré-filtrées) est un **confort**, pas
> une autorité : le serveur revérifie **tout**.

---

<a name="2-compte-joueur"></a>
## 2. Structure d'un compte joueur

Un compte est nécessaire pour identifier durablement un joueur (pas seulement
une session de navigateur), associer ses sauvegardes et empêcher l'usurpation.

```jsonc
// Compte (table `accounts`)
{
  "accountId": "acc_8f3a…",          // UUID v4, identifiant interne stable
  "handle": "Bodji#1427",            // pseudo public + discriminant
  "authProvider": "email" ,          // "email" | "oauth_github" | "guest"
  "emailHash": "…",                  // jamais l'email en clair côté logs
  "passwordHash": "argon2id$…",      // si auth e-mail ; sinon absent
  "createdAt": 1719500000000,
  "lastLoginAt": 1719600000000,
  "status": "active",                // "active" | "banned" | "locked"
  "saveRef": "save_…",               // pointeur vers la sauvegarde serveur
  "flags": { "coopUnlocked": true }
}
```

### 2.1 Authentification & jetons

- **Login** par HTTPS REST (`POST /auth/login`) → renvoie un **jeton de session**
  court (JWT signé côté serveur, ~15 min) + un **refresh token** (httpOnly).
- **Connexion WebSocket** : le client présente le jeton dans le **premier
  message** (`hello`) ; le serveur le **vérifie** avant d'ouvrir le moindre
  salon. Un socket sans jeton valide est fermé.
- **Identifiant de joueur = `accountId` issu du jeton vérifié**, JAMAIS une
  valeur fournie librement dans le corps des messages (anti faux identifiant,
  §6/§16).
- **Mode invité** possible (compte `guest` éphémère) pour tester la coop sans
  inscription, mais avec **droits réduits** (pas de butin rare persistant tant
  que le compte n'est pas converti) — décision produit, à confirmer.

> **Note** : la sauvegarde solo actuelle vit en `localStorage`
> (`idle_rpg_save_v1`, `SAVE_VERSION` courant). Le compte serveur **ne remplace
> pas** la sauvegarde locale ; il en **héberge une copie autoritaire** quand le
> joueur joue en coop (voir §12).

---

<a name="3-groupe-duo"></a>
## 3. Structure d'un groupe de deux joueurs (salon)

Le groupe est un **salon (`room`) limité physiquement à deux sièges**. La
contrainte « jamais trois joueurs » est garantie par la **structure de données
elle-même** (deux sièges nommés, pas un tableau extensible), pas seulement par
un test.

```jsonc
// Salon de groupe (room)
{
  "roomId": "room_4kx9",
  "inviteCode": "AETH-7Q2P",         // code court à partager (rotatif, expirable)
  "createdAt": 1719600000000,
  "leaderSeat": "A",                 // l'hôte/chef du duo
  "seats": {                         // EXACTEMENT deux sièges, pas un tableau
    "A": {
      "accountId": "acc_8f3a…",
      "handle": "Bodji#1427",
      "presence": "online",          // "online" | "reconnecting" | "offline"
      "ready": false,
      "loadout": { /* aperçu public : classe, niveau, élément d'arme… */ }
    },
    "B": null                        // libre tant qu'aucun second joueur
  },
  "capacity": 2,                     // CONSTANTE, jamais modifiable par message
  "phase": "lobby",                  // "lobby" | "in_combat" | "in_dungeon" | "in_raid"
  "activeSessionId": null            // id de combat/donjon en cours (si phase ≠ lobby)
}
```

### 3.1 Cycle de vie

1. **Création** : le joueur A crée un salon → siège `A` occupé, siège `B = null`.
2. **Invitation / connexion** : A partage `inviteCode`. B le saisit →
   `POST/WS join`. Le serveur **vérifie l'atomicité** : si `seats.B` est déjà
   non-null, la jonction est **refusée** (« salon plein »). Sinon B prend `B`.
   - L'opération de prise de siège est **atomique** (verrou par `roomId`, ou
     `UPDATE … WHERE seats_b IS NULL` en base) pour empêcher deux joueurs de
     prendre le même siège dans une course (anti reconnexions concurrentes,
     §11/§6).
3. **Affichage des deux membres** : à chaque changement, le serveur diffuse un
   `room/state` aux occupants → le client affiche les deux cartes de héros.
4. **Lancement conjoint** : une zone / un donjon / un raid ne peut démarrer que
   si **les deux sièges sont occupés** et **les deux `ready = true`**.
5. **Quitter le groupe** : message `leave` → le siège est libéré ; si le salon
   se vide, il est détruit (TTL si inactif).

### 3.2 Invariant « jamais trois »

- `capacity` est une **constante serveur** (2). Aucun message client ne peut la
  modifier.
- Il n'existe **que deux sièges nommés** (`A`, `B`). Pas de `seats.push(...)`.
- Toute tentative de `join` sur un salon dont les deux sièges sont pris est
  **rejetée** (`error: ROOM_FULL`). Idem pour tout `invite` supplémentaire.
- Les contenus de combat sont **dimensionnés en dur pour 2 héros** (§21), donc
  même un bug de salon ne produirait pas un combat « à trois ».

---

<a name="4-combat-coopératif-duo"></a>
## 4. Structure d'un combat coopératif en duo

Le combat vit **entièrement côté serveur**. Le client n'en reçoit que des
**vues** (l'état rendu + les effets visuels à jouer). Chaque joueur possède son
**propre héros, son familier, ses ressources, ses compétences et ses
cooldowns** ; **chaque joueur ne pilote que son propre héros**.

```jsonc
// État de combat AUTORITAIRE (jamais envoyé tel quel au client en intégralité ;
// le client reçoit des vues filtrées — voir §7 Clairvoyance)
{
  "combatId": "cbt_9d12",
  "roomId": "room_4kx9",
  "kind": "dungeon",                 // "skirmish" | "dungeon" | "raid"
  "seed": "f1c0…",                   // graine serveur du PRNG (jamais envoyée brute)
  "rngCursor": 184,                  // position du flux aléatoire (déterminisme/reprise)
  "turn": 12,
  "phase": "selecting",              // "selecting" | "resolving" | "won" | "lost" | "between_waves"
  "allies": {
    "A": {
      "unitId": "u_A",
      "ownerSeat": "A",
      "stats": { /* enveloppe GÉNÉRIQUE — voir Annexe A */ },
      "vital": { "hp": 540, "hpMax": 720,
                 "guard": 120, "guardMax": 200,      // « Garde » générique
                 "resource": { "id": "mana", "cur": 60, "max": 100 } },
      "buffs": [ /* {id, kind, magnitude, turnsLeft, stacks, sourceSeat} */ ],
      "states": [ /* états élémentaires : {id, turnsLeft, stacks} */ ],
      "cooldowns": { "skill_x": 2 },
      "familiar": { "id": "ember_sprite", "passiveApplied": true },
      "nextAt": 4.2                  // tempo Clairvoyance (cf. §7)
    },
    "B": { /* idem pour le second héros */ }
  },
  "enemies": [
    {
      "unitId": "e_0",
      "enemyId": "shale_golem",      // référence au contenu existant
      "stats": { /* enveloppe générique */ },
      "vital": { "hp": 1500, "hpMax": 1500 },
      "buffs": [], "states": [], "cooldowns": {},
      "resist": { /* éléments → facteur */ },
      "phaseIdx": 0,
      "intent": null,                // intention télégraphiée (boss) — révélée, pas la sélection secrète
      "nextAt": 3.8,
      "aiMemory": { /* mémoire de ciblage : agressivité, soins récents… (§22) */ }
    }
  ],
  "pendingChoices": {                // sélections SECRÈTES du tour en cours
    "A": { "received": true,  "commandId": "cmd_…", "hidden": true },
    "B": { "received": false }
  },
  "waveIndex": 2,                    // pour les donjons (§18)
  "blessings": [ /* bénédictions de donjon persistantes (§19) */ ],
  "rewardLedgerRef": "ledger_…",     // journal des récompenses (idempotent, §17)
  "lastResolvedSeq": 41,             // n° de séquence de la dernière résolution (anti-rejeu)
  "deadline": 1719600045000          // échéance du tour courant (§10)
}
```

### 4.1 Ce que chaque joueur contrôle (et ne contrôle pas)

- Le joueur **A** ne peut soumettre une action **que pour `unitId = u_A`**. Une
  intention visant à jouer l'unité de l'allié est **rejetée** (`NOT_YOUR_UNIT`).
- En revanche, A peut **cibler** B avec une compétence de soutien (soin, Garde,
  buff, dissipation, protection) : c'est **cibler**, pas **piloter**.
- Les deux héros **partagent** une victoire/défaite : le combat est gagné quand
  tous les ennemis sont à 0 PV, perdu si les **deux** héros sont K.O.
  (règle de K.O. d'un seul héros : voir §10/§11 — IA prudente ou attente courte).

### 4.2 Soutien mutuel (cibler son allié)

Les deux joueurs doivent pouvoir :

- **se soigner mutuellement** (`heal` ciblant l'allié) ;
- **restaurer la Garde de l'allié** (`restoreGuard`) ;
- **appliquer des buffs à l'allié** (atk/def/spd/crit, postures, enchantements) ;
- **retirer certaines altérations** de l'allié (`cleanse` d'états négatifs) ;
- **protéger l'allié** (rediriger des dégâts, poser un bouclier sur lui) ;
- **provoquer un ennemi** (`taunt` → modifie le ciblage de l'IA, §22) ;
- **préparer des réactions élémentaires combinées** (ex. l'un applique « Trempé »,
  l'autre déclenche « Foudre » → décharge ; mécanique déjà présente côté états).

> Ces effets réutilisent les **mécaniques génériques existantes** (`heal`,
> `shield`, `guard`, `atk_buff`, états élémentaires…). La seule extension
> nécessaire est l'élargissement du champ `target` des compétences (cf. §4.3).

### 4.3 Cibles possibles d'une compétence (extension générique)

Aujourd'hui les compétences ont `target: "enemy" | "self"`. Pour la coop, on
généralise le **type de cible** (sans figer les valeurs définitives — à
confirmer après fusion) :

| `targetType` | Signification | Exemple |
| --- | --- | --- |
| `self` | soi-même | posture défensive |
| `ally` | son allié (l'autre siège) | soin, Garde, bouclier sur l'allié |
| `ally_or_self` | un héros allié au choix | buff d'équipe ciblé |
| `enemy` | un ennemi précis | frappe |
| `all_enemies` | tous les ennemis | sort de zone |
| `team` | toute l'équipe (les 2 héros) | aura de groupe |
| `random_enemy` | une cible ennemie aléatoire valide | éclair erratique |

Le **serveur vérifie** que la cible reçue est **compatible** avec le
`targetType` de la compétence (un `heal` sur un ennemi est rejeté ; un
`all_enemies` ignore la cible unique fournie ; `random_enemy` est **tiré côté
serveur**, jamais choisi par le client). Voir §6.

---

<a name="5-protocole-websocket"></a>
## 5. Protocole de messages WebSocket

### 5.1 Forme générale

Tous les messages sont du JSON avec une **enveloppe commune** :

```jsonc
{
  "v": 1,                 // version du protocole
  "type": "combat/intent",
  "roomId": "room_4kx9",
  "commandId": "cmd_01HZ…", // UUID/ULID unique par commande client (§14/§15)
  "seq": 42,                // n° de séquence croissant par socket (anti-rejeu)
  "ts": 1719600040000,
  "payload": { /* spécifique au type */ }
}
```

- **Sens client → serveur = INTENTIONS uniquement.** Le client ne déclare jamais
  un résultat.
- **Sens serveur → client = ÉTAT & ÉVÉNEMENTS** (autoritaires).
- Le serveur **accuse réception** (`ack`) en renvoyant le `commandId` traité ;
  un `commandId` déjà vu est **ignoré** (idempotent, §14).

### 5.2 Messages CLIENT → SERVEUR (intentions)

| `type` | `payload` | Effet demandé |
| --- | --- | --- |
| `hello` | `{ token }` | s'authentifier sur le socket |
| `room/create` | `{}` | créer un salon (siège A) |
| `room/join` | `{ inviteCode }` | rejoindre (siège B si libre) |
| `room/leave` | `{}` | quitter le groupe |
| `room/ready` | `{ ready: true }` | (dé)confirmer être prêt |
| `session/startSkirmish` | `{ zoneId }` | lancer un combat de zone |
| `session/startDungeon` | `{ dungeonId }` | lancer un donjon à vagues |
| `session/startRaid` | `{ raidId }` | lancer un raid duo |
| `combat/intent` | `{ skillId, targetRef }` | jouer SON héros ce tour |
| `combat/defend` | `{}` | action « défendre » (sûre) |
| `combat/confirmReady` | `{}` | « j'ai fini de choisir » |
| `combat/reconnectResume` | `{ combatId }` | reprendre un combat en cours |
| `heartbeat` | `{}` | maintien de présence |

`targetRef` est un **identifiant d'unité** (`"u_B"`, `"e_2"`) ou un mot-clé
(`"self"`, `"ally"`, `"all"`) — jamais des coordonnées ni des chiffres de
dégâts.

### 5.3 Messages SERVEUR → CLIENT (état & événements)

| `type` | `payload` | Contenu |
| --- | --- | --- |
| `room/state` | salon complet (vue publique) | sièges, présence, ready, phase |
| `session/started` | `{ combatId, kind, view }` | combat ouvert |
| `combat/view` | vue d'état filtrée (§7) | PV, Garde, ressources, buffs visibles, ordre prévu |
| `combat/awaiting` | `{ needFrom: ["B"], deadline }` | on attend tel(s) joueur(s) |
| `combat/resolution` | liste ordonnée d'événements | la séquence d'actions résolue, à animer |
| `combat/waveCleared` | `{ waveIndex, blessingsOffered }` | vague terminée (donjon) |
| `combat/result` | `{ outcome, rewardsView }` | victoire/défaite + butin attribué |
| `ack` | `{ commandId, status }` | commande reçue / dupliquée / rejetée |
| `error` | `{ code, message }` | erreur (cible invalide, hors tour…) |
| `presence` | `{ seat, presence }` | un allié se déconnecte/revient |

### 5.4 Exemple de cycle d'un tour (donjon)

```
A → combat/intent      { skillId:"heal_ally", targetRef:"ally", commandId, seq }
S → ack                { commandId, status:"accepted" }
S → combat/awaiting    { needFrom:["B"], deadline:+30s }
B → combat/intent      { skillId:"heavy_strike", targetRef:"e_0", commandId, seq }
S → ack                { commandId, status:"accepted" }
   (les deux ont confirmé → le serveur résout dans l'ordre d'initiative)
S → combat/resolution  [ {actor:"B",…}, {actor:"e_0",…}, {actor:"A",…}, … ]
S → combat/view        { … nouvel état autoritaire … }
```

---

<a name="6-validations-serveur"></a>
## 6. Validations effectuées par le serveur

Avant d'appliquer **toute** intention, le serveur vérifie **dans l'ordre** :

1. **Socket authentifié** : `accountId` issu du jeton, pas du message.
2. **Appartenance** : l'`accountId` occupe bien un siège du `roomId` visé.
3. **Propriété de l'unité** : l'intention vise **l'unité du joueur** (A ne joue
   pas l'unité de B → `NOT_YOUR_UNIT`).
4. **Phase correcte** : on est bien en `selecting` (pas pendant `resolving` ni
   après `won/lost`) → sinon `OUT_OF_TURN`.
5. **Combat courant** : le `combatId`/`seq` correspond au combat **actif** (un
   message destiné à un combat **terminé** est rejeté → `STALE_COMBAT`, §14).
6. **Compétence possédée** : `skillId` ∈ kit réel du héros (classe + spé +
   grants), pas une compétence arbitraire → `SKILL_NOT_OWNED`.
7. **Cooldown** : la compétence n'est pas en recharge (valeur **serveur**) →
   `ON_COOLDOWN`.
8. **Coût de ressource** : le héros a assez de ressource (Mana/Garde/Rage…,
   valeur **serveur**) → `NOT_ENOUGH_RESOURCE`.
9. **Cible valide & compatible** : la cible existe, est **vivante**, et son type
   correspond au `targetType` de la compétence (`heal` → allié/soi, pas ennemi ;
   `enemy` → un ennemi vivant ; `random_enemy` → **tiré par le serveur**) →
   `INVALID_TARGET`.
10. **Idempotence** : `commandId` jamais vu pour ce tour (sinon `DUPLICATE`, §14).
11. **Un seul choix par héros et par tour** : un second `intent` du même siège
    **remplace** le précédent **tant que** le joueur n'a pas `confirmReady`
    (après confirmation, c'est verrouillé).

Toute violation renvoie un `error` **explicite** et **n'altère pas l'état**.
Le serveur **journalise** les rejets pour détecter un client modifié (§16).

---

<a name="7-tours-et-clairvoyance"></a>
## 7. Gestion des tours et de la Clairvoyance

### 7.1 La Clairvoyance comme statistique de tempo

Comme dans _Heroes of Aethric RPG_, l'ordre d'action n'est pas un simple « A
puis B puis ennemis » : il découle d'une **statistique de tempo** (ici la
**Clairvoyance**, généralisation de la « Vitesse/initiative » actuelle —
`nextAt += UNIT / vitesse`, le plus petit `nextAt` agit). Chaque unité (les 2
héros + chaque ennemi) possède son `nextAt`. **Le serveur** calcule cet ordre.

> **À CONFIRMER APRÈS FUSION** : nom exact et formule de la stat de tempo après
> la refonte (« Clairvoyance » est le nom de design ; le moteur actuel parle de
> Vitesse/`spd`). Le protocole reste inchangé : seule la **valeur** envoyée dans
> `nextAt`/`turnOrderPreview` change.

### 7.2 Ce que la Clairvoyance révèle… et ce qu'elle cache

- **Elle révèle** : l'**ordre probable des prochaines actions** (qui jouera avant
  qui), exactement comme l'aperçu `forecastTurns()` existant. Cet ordre est
  envoyé dans `combat/view.turnOrderPreview`.
- **Elle ne révèle PAS** la **compétence secrète sélectionnée par les ennemis**
  ce tour-ci. L'IA choisit son action **au moment de la résolution**, pas avant
  (§22). Seules les **intentions télégraphiées** des boss (mécanique existante,
  `planIntent`/`enemyIntentInfo`) sont volontairement annoncées — c'est un choix
  de design assumé (le boss « s'engage »), pas une fuite de la sélection.
- Symétriquement, **les ennemis ne voient pas** les sélections secrètes des deux
  joueurs avant d'agir (anti-triche d'IA, §22).

### 7.3 Phase de sélection vs phase de résolution

- **`selecting`** : les **deux** joueurs choisissent **en parallèle** (chacun son
  héros). Les choix sont **secrets** jusqu'à résolution.
- **`resolving`** : une fois les deux choix reçus (ou le délai atteint, §10), le
  serveur **fige** les sélections, **tire** l'aléa nécessaire, **ordonne** par
  Clairvoyance (§9) et **applique** tout d'un bloc, puis diffuse la séquence.

---

<a name="8-attente-des-deux-joueurs"></a>
## 8. Attendre les choix des deux joueurs

### 8.1 Modèle « sélection simultanée, résolution synchronisée »

1. Le serveur ouvre le tour : `phase = selecting`, fixe une **échéance**
   (`deadline`, §10), diffuse `combat/awaiting { needFrom:["A","B"] }`.
2. Chaque joueur envoie son `combat/intent` (modifiable tant qu'il n'a pas
   confirmé) puis `combat/confirmReady`.
3. Le serveur marque `pendingChoices[seat].received = true` (et garde le choix
   **secret**, non rediffusé à l'allié — sinon on révèlerait les sélections).
4. Quand **les deux** sont reçus **OU** l'échéance est atteinte → résolution.

```
État d'attente :
  - A confirmé, B non       → on attend B (afficher « En attente de l'allié… »)
  - A non, B confirmé       → on attend A
  - les deux confirmés      → RÉSOUDRE immédiatement (pas d'attente inutile)
  - échéance atteinte       → action AUTO pour les manquants (§10), puis RÉSOUDRE
```

### 8.2 Confort d'UI sans fuite d'information

Le client peut afficher « Ton allié a fait son choix » (un **booléen**), mais
**jamais** *quelle* compétence ni *quelle* cible l'allié a choisie : seul l'état
**après** résolution est partagé. Cela évite le méta-jeu où l'on adapte son
action en voyant celle de l'autre — et garde la symétrie avec l'IA (§7.2).

---

<a name="9-résolution-de-lordre"></a>
## 9. Résolution de l'ordre des actions (joueurs + ennemis)

Lorsque la sélection est close, le serveur résout **un tour** ainsi :

1. **Constituer la file d'initiative** : toutes les unités vivantes (2 héros + n
   ennemis) sont triées par `nextAt` croissant (Clairvoyance). Égalités tranchées
   de façon **déterministe** (ex. `nextAt`, puis tempo brut, puis identifiant
   d'unité — jamais l'aléa, pour la reproductibilité).
2. **Tirer les actions ennemies au dernier moment** : pour chaque ennemi, l'IA
   choisit **maintenant** (elle ne connaît pas les sélections des joueurs avant
   d'avoir, dans la file, son créneau — §22). Les boss honorent leur **intention
   télégraphiée** si elle est prête (mécanique existante).
3. **Dérouler la file** : chaque unité agit à son tour ; le serveur applique
   l'effet via le **moteur autoritaire** (réutilise `useSkill`/`dealDamage`/états/
   ressources/passifs réels). Après chaque action, `nextAt += UNIT / tempo`.
   Plafond d'actions consécutives conservé (`MAX_CONSEC`).
4. **Entretien de fin de tour** (`upkeep`) : DoT, décréments de buffs/cooldowns,
   régénérations, décharges d'états — **une seule fois**, de manière cohérente
   pour toutes les unités.
5. **Vérifier les fins** : ennemis tous morts → `won` (puis vague suivante en
   donjon, §18) ; les deux héros morts → `lost`.
6. **Diffuser** : `combat/resolution` (liste ordonnée d'événements à animer dans
   l'ordre exact) puis `combat/view` (nouvel état autoritaire).

> **Déterminisme & reprise** : l'aléa provient d'un **PRNG seedé côté serveur**
> (graine + curseur stockés dans l'état). Rejouer la même séquence d'intentions
> sur le même état produit le **même** résultat → indispensable pour la reprise
> après coupure (§11) et pour les tests (§24). Le client ne reçoit jamais la
> graine brute.

---

<a name="10-délai-et-action-automatique"></a>
## 10. Délai maximal avant une action automatique

- Chaque tour porte une **échéance** (`deadline`), p. ex. **30 s** de sélection
  (valeur à régler ; configurable par contenu — un raid peut être plus serré).
- Si un joueur n'a pas confirmé à l'échéance, le serveur joue pour lui une
  **action automatique SÛRE**, jamais destructrice :
  1. **répétition d'une action valide définie à l'avance** (« action par
     défaut » que le joueur a pu épingler : p. ex. « Attaque de base sur la cible
     la plus menaçante »), si elle est jouable (cooldown/ressource OK) ;
  2. sinon **défendre** (posture défensive, génère souvent de la ressource) ;
  3. sinon **attaque de base** sur une cible ennemie valide par défaut.
- L'action auto **ne dépense jamais** une ressource rare ni un objet consommable
  unique (cf. §11.4) et **ne lance pas** une compétence à long cooldown sans
  l'accord explicite du joueur.
- **Anti-blocage** : un joueur **présent** n'attend jamais indéfiniment à cause
  d'un allié lent ou déconnecté — l'échéance garantit que le combat **avance**.
- Un avertissement visuel (« 5 s pour choisir ») est envoyé via `combat/awaiting`
  (compte à rebours rendu côté client à partir de `deadline`, l'autorité restant
  l'horloge serveur).

---

<a name="11-déconnexion-reconnexion"></a>
## 11. Déconnexion et reconnexion

### 11.1 États de présence

`online` → `reconnecting` (socket perdu, fenêtre de grâce ouverte) →
`offline` (fenêtre expirée). Diffusés via `presence`.

### 11.2 Fenêtre de reconnexion courte

- À la perte du socket, le siège passe `reconnecting` et une **fenêtre de grâce
  courte** s'ouvre (p. ex. **45–90 s**, à régler).
- **Le combat n'est pas annulé** : l'état autoritaire reste en mémoire/Redis,
  rattaché au `roomId`/`combatId`.
- Le joueur resté connecté **continue de jouer** ; pendant la fenêtre, le héros
  déconnecté joue en **action automatique sûre** (§10) à chaque tour.

### 11.3 Reprise sécurisée d'un combat en cours

- Le client revenu envoie `combat/reconnectResume { combatId }` sur un socket
  **ré-authentifié**.
- Le serveur vérifie que l'`accountId` du jeton **occupe bien** le siège de ce
  combat, puis renvoie l'**état complet courant** (`combat/view`) + la position
  dans le tour. Le joueur reprend la main sans rejouer le passé (l'historique
  est déjà appliqué dans l'état).
- **Reconnexions concurrentes** : un seul socket actif par siège. Un nouveau
  `resume` valide **invalide l'ancien** socket (verrou par siège), pour éviter
  deux clients qui pilotent le même héros (§6/§16).

### 11.4 IA prudente après la fenêtre

- Si la fenêtre expire, le héros absent passe sous le contrôle d'une **IA
  prudente** (favorise survie/soutien, évite le gaspillage), afin que l'allié
  présent puisse **terminer** le donjon/raid (on ne peut pas fuir, §18).
- **Garde-fous stricts** : cette IA **ne consomme jamais** les **objets rares**
  ni les **ressources permanentes** du joueur absent (consommables uniques,
  objets de quête, monnaies). Elle se limite aux compétences à coût transitoire
  (ressource de classe régénérée en combat).
- Si **les deux** joueurs sont déconnectés au-delà de la fenêtre, le combat est
  **mis en pause/persisté** (snapshot) et repris plus tard, ou résolu par défaite
  douce sans perte de progression injuste (décision produit, à confirmer).

---

<a name="12-synchronisation-des-sauvegardes"></a>
## 12. Synchronisation des sauvegardes

### 12.1 Source de vérité en coop

- En solo, la sauvegarde reste **locale** (`localStorage`, `SAVE_VERSION`).
- En coop, **le serveur fait autorité** sur tout ce qui touche au combat partagé
  et aux récompenses. La sauvegarde serveur est une **copie autoritaire** liée au
  compte (`accounts.saveRef`).
- À l'entrée en coop : le client **pousse** sa sauvegarde locale (ou un **digest
  signé** de l'état pertinent : niveau, classe, équipement, familier) ; le serveur
  la **valide** et la prend comme base. À la sortie : le serveur **renvoie**
  l'état mis à jour (XP, or, butin gagnés en coop) que le client **réintègre** en
  local.

### 12.2 Anti-conflit & anti-régression

- **Versionnage** : chaque sauvegarde serveur porte un **numéro de révision**
  monotone. Une écriture cliente avec une révision **inférieure** à la révision
  serveur est **rejetée** (anti « rollback » pour dupliquer du butin, §13).
- **Réconciliation déterministe** : les gains de coop (XP/or/objets) ne sont
  **jamais** appliqués par le client ; ils proviennent du **journal de
  récompenses** serveur (§17). Le client ne fait que **refléter** le résultat.
- **Compat schéma** : la sauvegarde évolue par **migrations versionnées** (déjà
  le cas en solo). Le format réseau reste **générique** pour survivre à la
  refonte (Annexe B).

> **À CONFIRMER APRÈS FUSION** : champs exacts à synchroniser (la refonte change
> stats/Garde/familiers). On synchronise des **catégories** (progression,
> équipement, familier, ressources persistantes), pas des champs nommés figés.

---

<a name="13-anti-duplication-dobjets"></a>
## 13. Prévention de la duplication d'objets

Principe : **un gain ne peut être matérialisé qu'une seule fois**, validé par le
serveur, traçable par identifiant.

- **Journal de récompenses idempotent** (`reward_ledger`) : chaque récompense
  potentielle d'une victoire reçoit un **`rewardId` unique et déterministe**
  (dérivé de `combatId` + `seat` + index). L'attribution est une **insertion
  unique** en base (`UNIQUE(rewardId)`), donc **rejouable sans effet** : recharger
  la page, renvoyer un vieux message ou se reconnecter **ne recrée pas** le butin.
- **Idempotence des `commandId`** (§14) : un `claim`/`confirm` rejoué est ignoré.
- **Anti-rollback de sauvegarde** (§12.2) : impossible de « revenir en arrière »
  pour rejouer un combat déjà récompensé (révision monotone + combat marqué
  `rewarded`).
- **Instances d'objets uniques** : le loot crée des **instances** avec `uid`
  serveur (cohérent avec le `uid` déjà utilisé en solo). Un `uid` ne peut exister
  qu'une fois dans l'inventaire autoritaire.
- **Pas de propriété disputée** : les objets communs sont **dupliqués
  proprement pour chaque joueur** (chacun reçoit sa propre instance) — il n'y a
  donc **pas** de transfert entre joueurs qui pourrait être exploité pour
  dupliquer (§17).
- **Combat terminé = clos** : après `won/lost`, l'`combatId` est **scellé** ;
  toute commande le visant est `STALE_COMBAT` (§14).

---

<a name="14-anti-rejeu-dactions"></a>
## 14. Prévention des actions envoyées plusieurs fois (anti-rejeu)

- **`commandId` unique par commande** (§15) : le serveur tient un **cache des
  `commandId` traités** (par combat / fenêtre de temps). Un doublon → `ack
  { status:"duplicate" }`, **aucun** double effet.
- **`seq` monotone par socket** : un message avec un `seq` ≤ au dernier traité est
  **ignoré** (rejeu d'un ancien paquet capturé).
- **Liaison au tour courant** : chaque intention référence le **tour** (et le
  `combatId`). Une intention pour un **tour déjà résolu** est rejetée
  (`STALE_TURN`) — on ne peut pas « rejouer » l'attaque du tour précédent.
- **Verrou de sélection** : après `confirmReady`, le siège est **verrouillé** pour
  ce tour ; un second envoi est ignoré.
- **Messages d'un ancien combat terminé** : rejetés (`STALE_COMBAT`).

---

<a name="15-identifiants-de-commandes"></a>
## 15. Identifiants uniques de commandes

- Chaque action client porte un **`commandId`** généré côté client (ULID ou UUID
  v4) — **opaque**, non rejouable, **unique**.
- Le **serveur ne fait pas confiance** au `commandId` pour l'autorisation (il ne
  porte aucun privilège) ; il s'en sert **uniquement** pour l'**idempotence** et
  la **corrélation** `ack`/`error`.
- Les **récompenses** ont leurs propres **`rewardId` serveur** (déterministes,
  §13) — indépendants des `commandId` clients.
- Recommandation : ULID (triable dans le temps) pour faciliter le débogage et
  l'expiration du cache d'idempotence.

---

<a name="16-anti-triche-client"></a>
## 16. Protection contre la modification du client

Le client étant public (site statique), on part du principe qu'il **peut être
modifié**. La sécurité repose **entièrement** sur le serveur autoritaire :

- **Aucune décision sensible côté client** (rappel §1.4) : un client modifié qui
  « décide » un critique ou un loot n'a **aucun effet**, le serveur recalcule.
- **Identité par jeton vérifié** (§2) : impossible de se faire passer pour un
  autre `accountId` en changeant le corps d'un message (faux identifiant rejeté).
- **Validation exhaustive** (§6) : compétence possédée, cooldown, coût, cible,
  phase, propriété de l'unité — tout est revérifié.
- **Limitation de débit (rate-limiting)** par socket / compte : un client qui
  **spamme** des intentions est ralenti puis sanctionné.
- **Détection d'anomalies** : taux élevé de rejets (`SKILL_NOT_OWNED`,
  `INVALID_TARGET`, coûts/cooldowns « impossibles ») → **drapeau anti-triche**,
  journalisation, éventuel bannissement (`status: "banned"`).
- **Pas de secret dans le client** : la graine PRNG, les formules de loot et les
  tables de drop **restent serveur** ; le client ne reçoit que des **résultats**.
- **Schémas stricts** : tout message est validé contre un **schéma** (types,
  bornes) ; un payload malformé est rejeté sans planter le serveur.

---

<a name="17-récompenses"></a>
## 17. Récompenses individuelles et communes

Calculées et **validées par le serveur après la victoire** (jamais par le
client), puis inscrites au **journal idempotent** (§13).

### 17.1 Deux natures de récompenses

- **Récompenses personnelles** : dépendent du **niveau et de la progression de
  chaque joueur** (XP adaptée au niveau, butin de classe pertinent…). Calculées
  **par siège**, attribuées **séparément**.
- **Récompenses communes** : un même butin obtenu par la victoire est
  **distribué aux deux joueurs sans conflit de propriété** : **chacun reçoit sa
  propre instance** (`uid` distinct). Il n'y a **pas** de « roll » compétitif, pas
  de jet de besoin/cupidité, **personne ne se bat pour le même objet**.

```jsonc
// Journal de récompenses (reward_ledger) après une victoire
{
  "combatId": "cbt_9d12",
  "outcome": "won",
  "entries": [
    { "rewardId": "cbt_9d12:A:xp",   "seat": "A", "kind": "xp",   "amount": 1450 },
    { "rewardId": "cbt_9d12:A:gold", "seat": "A", "kind": "gold", "amount": 320 },
    { "rewardId": "cbt_9d12:A:i0",   "seat": "A", "kind": "item",
      "instance": { "uid": "it_…A", "baseId": "iron_blade", "rarity": "rare" } },

    { "rewardId": "cbt_9d12:B:xp",   "seat": "B", "kind": "xp",   "amount": 1500 },
    { "rewardId": "cbt_9d12:B:gold", "seat": "B", "kind": "gold", "amount": 320 },
    // récompense COMMUNE → une instance PROPRE pour chacun (uid différents)
    { "rewardId": "cbt_9d12:A:shared0", "seat": "A", "kind": "item",
      "instance": { "uid": "it_…sA", "baseId": "golem_core", "rarity": "epic" } },
    { "rewardId": "cbt_9d12:B:shared0", "seat": "B", "kind": "item",
      "instance": { "uid": "it_…sB", "baseId": "golem_core", "rarity": "epic" } }
  ],
  "sealed": true        // après scellement, aucune ré-attribution possible
}
```

### 17.2 Garanties

- **Une récompense n'est jamais obtenue deux fois** par rechargement de page ou
  renvoi d'un ancien message WebSocket : `rewardId` unique + insertion idempotente
  + combat scellé (§13/§14).
- Les **gains personnels** sont strictement séparés (un joueur ne peut pas
  réclamer le siège de l'autre).
- Les **gains communs** ne créent **aucune** indivision : deux instances
  distinctes, zéro transfert, zéro dispute.

---

<a name="18-donjons-à-vagues"></a>
## 18. Création des donjons à vagues

Inspiration directe de _Heroes of Aethric RPG_ : **pas de carte ni de couloirs**.
Un donjon est une **suite de vagues** (combats enchaînés) avec **arrière-plans**
et **compositions d'ennemis** variés. Une fois **commencé**, le duo **termine
les vagues ou est vaincu** : **fuite impossible**.

```jsonc
// Définition de donjon (contenu data-driven — réutilise enemies.js existant)
{
  "dungeonId": "shale_depths",
  "name": "Tréfonds de Schiste",
  "background": "assets/backgrounds/zone2.png",   // décor par vague possible
  "noFlee": true,                                  // verrou : impossible de fuir
  "waves": [
    { "type": "normal",  "bg": "zone2", "enemies": ["shale_golem", "dust_weaver"] },
    { "type": "normal",  "bg": "zone2", "enemies": ["miner_wraith", "echo_bat", "echo_bat"] },
    { "type": "elite",   "bg": "zone2", "enemies": ["damned_foreman"] },
    { "type": "miniboss","bg": "zone2", "enemies": ["goblin_chief_grok"] },
    { "type": "recover", "bg": "zone2", "recover": { "hpPct": 0.25, "guardPct": 0.5 } },
    { "type": "boss",    "bg": "zone2", "enemies": ["vorrak_collapse"] }
  ],
  "rewardTable": "shale_depths_rewards"
}
```

### 18.1 Types de vagues

- **vagues normales** : composition standard ;
- **ennemis d'élite** : version renforcée (kit réel, pas un sac de PV) ;
- **mini-boss** : palier intermédiaire à mécanique ;
- **vague de récupération limitée** : rend **une partie** des PV/Garde/ressource
  (pas un plein), respiration tactique ;
- **boss final** : à **phases** (mécanique `enemy.phases` déjà existante) et
  intentions télégraphiées.

### 18.2 Déroulé serveur

1. `session/startDungeon` (les deux prêts) → le serveur instancie le donjon,
   verrouille la fuite, ouvre la **vague 0**.
2. À chaque vague nettoyée : `combat/waveCleared` (+ éventuelle **bénédiction**
   proposée, §19), persistance de l'état (PV/Garde/buffs retenus), puis ouverture
   de la vague suivante **sans rechargement** (anti-scintillement préservé côté
   client : on remplace décor + ennemis, on garde l'arène).
3. Boss vaincu → `combat/result` (récompenses, §17). Les deux héros K.O. →
   `lost` (le donjon échoue ; règles de pénalité à définir, douces).

---

<a name="19-persistance-entre-vagues"></a>
## 19. Persistance des buffs entre les vagues

On distingue **deux catégories** (cf. Annexe C) et on **définit clairement** ce
qui persiste :

| Élément | Entre deux vagues | Remarque |
| --- | --- | --- |
| **PV** | **persistent** | pas de heal automatique (sauf vague `recover`) |
| **Garde** | **persiste** (généralement) | partiellement restaurée par `recover` |
| **Mana / ressource de classe** | **persiste** | évite le « plein gratuit » par vague |
| **Bénédictions de donjon** | **persistent toute la durée du donjon** | buffs longue durée propres au donjon (§ ci-dessous) |
| **Buffs de combat ordinaires** (5–12 tours) | **expirent en fin de vague** | sinon on les empilerait d'une vague à l'autre |
| **Postures / enchantements « tout le combat »** | **expirent en fin de vague** | « le combat » = la vague |
| **DoT / états négatifs** (poison, brûlure…) | **nettoyés** en fin de vague | on ne traîne pas un poison ennemi |
| **Cooldowns** | **conservés** (généralement) | continuité tactique ; réglable par contenu |
| **Intention de boss télégraphiée** | réinitialisée par combat | propre à chaque ennemi |

- Les **bénédictions de donjon** sont des buffs **persistants conçus pour le
  donjon** (ex. « +10 % de soin reçu pour le reste du donjon », « régénère 2 % PV
  par fin de vague »). On peut en **proposer un choix** après certaines vagues
  (draft façon roguelite), validé serveur.
- **Règle anti-abus de cumul inter-vagues** : les buffs **ordinaires**
  **n'enjambent pas** les vagues, ce qui empêche d'accumuler indéfiniment des
  bonus en chaînant les vagues. Seules les **bénédictions** persistent, et elles
  ont leurs **propres plafonds** (§20).

> **À CONFIRMER APRÈS FUSION** : la liste exacte des buffs/états et leur durée
> change avec la refonte. La **règle de catégorie** (ordinaire vs bénédiction)
> reste, on remappe juste les identifiants.

---

<a name="20-limites-dempilement"></a>
## 20. Limites d'empilement (anti-cumul abusif)

Objectif : empêcher le duo de **garder volontairement un ennemi faible en vie**
pour empiler des bonus à l'infini (un classique des combats tour par tour mal
bornés).

- **Durées bornées** : les buffs ordinaires durent **5–12 tours** selon leur
  puissance (Annexe C). Ils **finissent** par tomber : on ne peut pas les garder
  « pour toujours » en temporisant.
- **Plafond de cumul (`maxStacks`)** par effet : un même buff ne se cumule pas
  avec lui-même au-delà d'un plafond (les états élémentaires ont **déjà** un
  `maxStacks` ; on l'étend aux buffs de soutien). Re-lancer rafraîchit la durée
  mais **ne dépasse pas** le plafond.
- **Rafraîchissement plutôt qu'addition** pour les buffs « tout le combat » :
  relancer une posture **remet la durée**, ne **multiplie pas** l'effet.
- **Diminishing returns** sur certains buffs cumulables (chaque pile suivante
  apporte moins), pour casser la spirale exponentielle.
- **Détection de « farm de buffs »** : si un seul ennemi faible reste vivant
  longtemps **et** que le duo continue d'empiler des buffs sans l'achever, le
  serveur peut **plafonner** les gains (les buffs au-delà d'un seuil n'ont plus
  d'effet) — règle douce, côté serveur uniquement.
- **Limite globale** d'effets actifs par unité (nombre max de buffs simultanés)
  pour éviter l'« empilement infini ».

---

<a name="21-adaptation-duo"></a>
## 21. Adaptation des ennemis à exactement deux joueurs

Les contenus sont **équilibrés uniquement pour deux héros** — ni solo, ni trois.

- **Dimensionnement « ×2 héros »** : PV/dégâts/composition des ennemis sont
  réglés en supposant **deux** sources de dégâts et **deux** kits de soutien. Pas
  de mise à l'échelle dynamique au nombre de joueurs (il est **toujours** 2).
- **Compositions complémentaires** plutôt que sacs de PV (cf. §23) : un ennemi
  qui soigne + un qui protège + un qui inflige des états → le duo doit **répartir
  les rôles** (focus, dissipation, contrôle).
- **Garde-fous de structure** : un combat ne peut **pas** s'initialiser avec un
  nombre de héros ≠ 2 (invariant §3.2). Les tables de récompenses, seuils de
  phase et budgets de menace sont calibrés pour 2.
- **Réutilisation du contenu solo** : les ennemis gardent **stats, compétences,
  passifs, éléments, résistances et IA décisionnelle** existants ; on **n'en fait
  pas** des combats scénarisés. On ajuste les **valeurs** (budget) pour le duo,
  pas la **nature** des ennemis.

> **À CONFIRMER APRÈS FUSION** : les budgets exacts (PV/dégâts) dépendent de la
> nouvelle courbe de stats. On fixe la **méthode** (cible : un combat « normal »
> dure X tours pour un duo de niveau N), pas les chiffres.

---

<a name="22-ciblage-ia"></a>
## 22. Choix de cible de l'IA (lequel des deux héros viser)

L'IA conserve son **scoring situationnel** existant et l'étend au **choix de la
cible** parmi les deux héros — **dynamiquement**, par rôle perçu :

L'IA peut considérer (et **pondérer**) :

- le héros ayant **le moins de PV** (finir une cible) ;
- le héros ayant **le moins de Garde** (cible plus « molle ») ;
- le héros ayant **infligé le plus de dégâts récemment** (neutraliser la menace) ;
- le héros ayant **utilisé plusieurs soins** (couper le support) ;
- le héros ayant **appliqué une provocation** (`taunt` → forte incitation à le
  cibler, c'est le but de la provocation côté soutien) ;
- les **résistances et faiblesses** des deux héros vs l'élément de l'attaque
  (taper là où ça fait mal).

```text
score_cible(héros) =
      poids_pv      * (1 - pv%)
    + poids_garde   * (1 - garde%)
    + poids_menace  * dégâts_récents_normalisés
    + poids_coupe   * a_beaucoup_soigné
    + poids_taunt   * provocation_active
    + poids_élément * vulnérabilité_élémentaire
    ± petit_aléa            // lisible mais pas robotique
La provocation force un poids_taunt élevé (quasi-priorité), mais reste une
incitation forte, pas un script rigide.
```

### 22.1 L'IA ne triche pas

- L'IA choisit **au moment de la résolution** (§9), à partir de l'**état public
  du combat** (PV, Garde, buffs visibles, menace passée) — **jamais** à partir
  des **sélections secrètes** que les joueurs viennent de faire ce tour-ci.
- Elle ne lit donc **pas l'avenir** : symétrie exacte avec la Clairvoyance, qui
  ne révèle pas non plus aux joueurs la compétence secrète des ennemis (§7.2).
- Les boss **télégraphient** volontairement leur intention (design assumé) ; ce
  n'est pas de la triche, c'est une **information donnée** au duo pour réagir.

---

<a name="23-raids-duo"></a>
## 23. Raids exclusivement conçus pour un duo

Les raids sont **plus longs et plus difficiles** que les donjons, mais la
difficulté **ne vient pas** d'un simple océan de PV. Elle vient de la
**composition et des synergies** — exactement l'esprit _Aethric_ :

- **compositions d'ennemis complémentaires** (un soigneur ennemi + un protecteur
  + un infligeur d'états → il faut **focus / couper / dissiper**) ;
- **compétences de soin/protection** côté ennemis (forcer le duo à **prioriser**
  les cibles) ;
- **effets élémentaires** et **réactions** (le duo doit préparer ses combos :
  Trempé → Foudre, etc.) ;
- **résistances** ciblées (un build mono-élément est puni → diversifier) ;
- **gestion des ressources** sur la durée (Mana/Garde : le raid teste l'endurance,
  pas le burst) ;
- **choix de cibles** sous pression (menaces multiples simultanées) ;
- **synergie entre les deux builds** (le raid est pensé pour récompenser la
  complémentarité : tank + soigneur, contrôle + burst…).

Caractéristiques :

- **Duo strictement** (invariant §3.2) ; impossible d'y entrer seul ou à trois.
- **Plusieurs phases / segments**, possiblement avec **points de contrôle**
  internes (à définir) pour ne pas perdre 40 min sur un wipe.
- **Fuite impossible** une fois engagé (comme les donjons).
- **Récompenses** à la hauteur (§17), toujours sans dispute de propriété.

> **À CONFIRMER APRÈS FUSION** : les kits exacts (soins/protections ennemis,
> réactions élémentaires) dépendent du nouveau moteur. On fixe la **structure**
> (raid = segments + compositions synergiques), pas les compétences nommées.

---

<a name="24-tests"></a>
## 24. Tests réseau et tests de sécurité nécessaires

### 24.1 Tests de protocole / réseau

- **Idempotence** : renvoyer 100× le même `commandId` → **un seul** effet.
- **Rejeu** : rejouer d'anciens messages (`seq` périmé, tour résolu, combat
  scellé) → tous **rejetés**, état inchangé.
- **Ordre & latence** : messages arrivant désordonnés / en retard → résolution
  cohérente (le serveur, pas l'ordre d'arrivée, décide).
- **Déconnexion / reconnexion** : couper le socket en plein tour, reprendre via
  `reconnectResume` → état **identique**, pas de double action.
- **Reconnexions concurrentes** : deux sockets pour le même siège → un seul
  actif, l'autre **invalidé**.
- **Délai / action auto** : un joueur ne répond pas → action sûre jouée, le
  combat **avance**, l'allié n'est pas bloqué.
- **Reprise déterministe** : rejouer la même séquence d'intentions sur le même
  état (même graine) → **même** résultat (snapshot vs rejeu).

### 24.2 Tests de sécurité

- **Faux identifiant** : message prétendant un autre `accountId` → ignoré
  (identité = jeton).
- **Hors tour** : intention pendant `resolving`/après fin → `OUT_OF_TURN`.
- **Compétence non possédée / coût falsifié / cooldown ignoré / cible invalide**
  → tous rejetés (§6), aucun effet.
- **Jouer l'unité de l'allié** → `NOT_YOUR_UNIT`.
- **Salon plein / troisième joueur** : tentative de `join` sur un duo complet →
  `ROOM_FULL` ; impossible d'instancier un combat à 3.
- **Duplication de récompense** : recharger / renvoyer un `claim` → **un seul**
  butin (journal idempotent).
- **Falsification de sauvegarde** : push d'une révision inférieure / digest
  incohérent → **rejeté**.
- **Rate-limiting / flood** : spam d'intentions → throttling + drapeau.
- **Fuzzing de schéma** : payloads malformés → rejet propre, pas de crash.

### 24.3 Tests d'équilibrage (réutiliser l'existant)

- Étendre l'esprit du **simulateur de duel** existant (`simulateDuel`) vers un
  **simulateur 2v(n)** pour mesurer que les contenus duo sont **faisables mais
  exigeants**, qu'aucun build n'est obligatoire et qu'aucune synergie n'est
  dégénérée. **À CONFIRMER APRÈS FUSION** (le simulateur change avec le moteur).

---

<a name="25-ordre-dimplémentation"></a>
## 25. Ordre d'implémentation en petits lots

> **Pré-requis : ne rien démarrer avant la fusion de la branche de refonte.**
> Lot 0 d'abord. Chaque lot est **petit, testable, livrable** indépendamment.

| Lot | Contenu | Sortie testable |
| --- | --- | --- |
| **0** | **Attendre la fusion** du nouveau moteur ; figer les enveloppes génériques (Annexe A/B) ; cartographier les vrais noms de stats/Garde/ressources. | Annexe B remplie, mapping validé. |
| **1** | Backend Node minimal : healthcheck, **auth** (login/refresh/JWT), table `accounts`. | Se connecter, obtenir un jeton vérifié. |
| **2** | **WebSocket** + `hello`/auth de socket + heartbeat + schémas de messages + rate-limit. | Socket authentifié, messages validés/rejetés. |
| **3** | **Salons duo** : create/join/leave/ready, invariant « max 2 » atomique, `room/state`. | Deux clients voient un duo ; un 3ᵉ est refusé. |
| **4** | **Moteur de combat autoritaire (skirmish 1 vague)** : sélection simultanée, Clairvoyance, résolution ordonnée, vues filtrées. **Réutilise le moteur fusionné**. | Un combat duo se joue de bout en bout, serveur autoritaire. |
| **5** | **Validations & sécurité** (§6/§16) : propriété d'unité, cooldown/coût/cible, anti-rejeu (`commandId`/`seq`), STALE_*. | Tous les tests §24.2 passent. |
| **6** | **Délai + action auto** (§10) + **présence** (online/reconnecting). | Un joueur AFK ne bloque pas le combat. |
| **7** | **Déconnexion / reconnexion** (§11) + reprise déterministe + IA prudente (garde-fous objets rares). | Couper/reprendre sans double action. |
| **8** | **Récompenses idempotentes** (§13/§17) : `reward_ledger`, perso vs commun, instances `uid`. | Pas de duplication, pas de dispute. |
| **9** | **Synchronisation des sauvegardes** (§12) : push/pull, révision monotone, anti-rollback. | Gains de coop intégrés sans régression. |
| **10** | **Donjons à vagues** (§18) + **persistance entre vagues** (§19) + **bénédictions**. | Donjon complet, fuite impossible, état retenu. |
| **11** | **Limites d'empilement** (§20) + **ciblage IA duo** (§22) + provocation. | Anti-cumul vérifié ; l'IA cible intelligemment. |
| **12** | **Raids duo** (§23) : segments, compositions synergiques, points de contrôle. | Un raid duo complet et exigeant. |
| **13** | **Durcissement** : anti-triche avancé, métriques, charge, fuzzing, équilibrage (sim 2v-n). | Tableau de bord + tests de §24 verts. |

---

<a name="26-risques"></a>
## 26. Principaux risques techniques

1. **Refonte non fusionnée** (risque #1) : se baser sur d'anciens noms de stats
   casserait tout. **Mitigation** : enveloppes génériques + Annexe B + Lot 0
   bloquant ; **ne pas démarrer** l'implé tant que la fusion n'est pas là.
2. **Cold start / hébergement gratuit** (Render & co. endorment le service) :
   première connexion lente, sockets coupés. **Mitigation** : healthcheck/ping
   pour garder chaud, ou palier payant léger ; reconnexion robuste (§11).
3. **État de combat en mémoire perdu au redéploiement/crash** : **Mitigation** :
   snapshots périodiques en base + reprise déterministe (graine + curseur) ;
   Redis pour l'état chaud si besoin.
4. **Déterminisme du PRNG** : un aléa non reproductible casse la reprise et les
   tests. **Mitigation** : PRNG seedé serveur, curseur persisté, jamais d'aléa
   côté client (cf. `withSeed` déjà utilisé en tests).
5. **Triche / client modifié** : inévitable sur site statique. **Mitigation** :
   serveur 100 % autoritaire, validations exhaustives, rate-limit, détection
   d'anomalies, zéro secret côté client (§16).
6. **Duplication de butin** via rechargement/rejeu : **Mitigation** : journal
   idempotent (`rewardId` unique) + anti-rollback de save + combat scellé (§13).
7. **Conditions de course sur le salon** (deux `join` simultanés) : **Mitigation**
   : prise de siège atomique (verrou/`WHERE seat IS NULL`), un seul socket/siège.
8. **Blocage par l'allié** (AFK/déco) : **Mitigation** : échéance + action auto +
   IA prudente ; le joueur présent **n'attend jamais** indéfiniment (§10/§11).
9. **Abus d'empilement de buffs** (farm sur ennemi faible) : **Mitigation** :
   durées bornées, `maxStacks`, diminishing returns, plafond serveur, buffs
   ordinaires non persistants entre vagues (§19/§20).
10. **Équilibrage duo** (trop facile / mur infranchissable) : **Mitigation** :
    simulateur 2v-n (extension de l'existant), itération par budgets, pas de
    scaling dynamique (toujours exactement 2).
11. **Coût qui dérape** (DB, sockets) : **Mitigation** : tour par tour = trafic
    faible ; commencer mono-processus + Postgres managé ; n'ajouter Redis/scale
    que si la charge l'exige.
12. **Fuite d'information** (sélections secrètes, graine, tables de loot) :
    **Mitigation** : vues **filtrées** côté serveur, jamais l'état brut complet ;
    sélections de l'allié non rediffusées avant résolution (§8.2).

---

<a name="annexe-a"></a>
## Annexe A — Glossaire générique des stats (anti-couplage à la refonte)

Pour ne **pas** dépendre des noms exacts en cours de refonte, le réseau manipule
des **catégories** :

```jsonc
"stats": {
  "offense":  { /* puissance d'attaque, crit, … */ },
  "defense":  { /* armure/réduction, … */ },
  "tempo":    { /* Clairvoyance / initiative (ordre des tours) */ },
  "vitality": { /* PV max, … */ },
  "guard":    { /* « Garde » : jauge défensive consommable */ },
  "resource": { /* ressource de classe : Mana/Rage/Garde/Concentration/Ombre */ },
  "elements": { /* affinités/résistances par élément */ }
}
```

- Le **mapping** « catégorie générique → champ réel du moteur » est défini **une
  seule fois**, après la fusion (Annexe B). Le protocole reste **stable** même si
  les champs internes changent de nom.
- Idem pour les **éléments** : on s'appuie sur la **liste data-driven** existante
  (Feu, Eau, Vent, Nature, Foudre, Lumière, Chaos, Umbral) sans figer de constante
  réseau ; on transmet des **identifiants** (`"fire"`, …) résolus côté serveur.

<a name="annexe-b"></a>
## Annexe B — Points à confirmer après la fusion de la nouvelle branche

À remplir **dès** que la branche de refonte est fusionnée (Lot 0) :

- [ ] Nom & formule de la **stat de tempo** (« Clairvoyance » de design ↔ champ réel).
- [ ] Modèle exact de la **Garde** (jauge ? réduction ? interaction avec les PV).
- [ ] Liste & paramètres des **ressources de classe** après refonte.
- [ ] **Buffs/états** disponibles + durées (remapper §19/§20 dessus).
- [ ] **Familiers** : ce qui est persistant vs transitoire en combat.
- [ ] Forme exacte des **instances d'objets** (`uid`, rareté, affixes) pour le loot.
- [ ] **Courbe de stats** (pour les budgets d'ennemis duo, §21).
- [ ] API interne du **moteur de combat** réutilisable côté serveur (équivalents de
      `useSkill`/`dealDamage`/`upkeep`/`simulateDuel`).
- [ ] Champs de **sauvegarde** à synchroniser (catégories §12) + version de schéma.

<a name="annexe-c"></a>
## Annexe C — Deux types de buffs

| | **Buffs de combat ordinaires** | **Bénédictions de donjon** |
| --- | --- | --- |
| **Portée** | un combat (une vague) | tout le donjon |
| **Durée typique** | **5 à 12 tours** selon la puissance | jusqu'à la fin du donjon |
| **Cas « tout le combat »** | postures / enchantements : durent la vague entière | — |
| **Persistance entre vagues** | **non** (expirent en fin de vague) | **oui** |
| **Cumul** | `maxStacks` + rafraîchissement (pas d'addition infinie) | plafonds propres + draft contrôlé |
| **But** | tactique du combat courant | progression sur la durée du donjon (roguelite) |

- Un buff **ordinaire** **puissant** dure plutôt **court** (≈5 tours) ; un buff
  **faible** dure plus **longtemps** (≈12 tours). Les **postures/enchantements**
  peuvent durer **tout le combat** mais **sans se cumuler** avec eux-mêmes
  au-delà de leur plafond (§20).
- Une **bénédiction** est volontairement **persistante** entre les vagues, mais
  **plafonnée** et **distribuée par choix** (pas d'empilement libre).

---

> **Rappel final** : ce document **ne modifie aucun fichier de jeu** et **ne
> démarre aucune implémentation**. Il fixe une architecture **duo, serveur
> autoritaire, économique**, prête à guider l'implémentation **après** la fusion
> de la refonte. Tous les points dépendant du moteur sont marqués
> **`À CONFIRMER APRÈS FUSION`** (Annexe B).
