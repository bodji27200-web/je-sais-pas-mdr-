# Serveur de coop en ligne (duo)

Serveur **autoritaire** pour la coopération en duo. Il réutilise le moteur de
combat du jeu (`js/coop/*`, `js/systems/combat.js`) : toute la logique (dégâts,
ordre des tours, ressources, récompenses) est calculée **côté serveur**. Le
client n'envoie que des intentions et affiche l'état renvoyé.

Voir `docs/ARCHITECTURE-COOP-DUO.md` pour la conception complète.

## Lancer en local

```bash
node server/index.js
# écoute sur :8080 (PORT pour changer), health-check sur /health
```

Aucune dépendance npm : le transport WebSocket (`server/ws.js`) est une
implémentation minimale de RFC 6455 (zéro `node_modules`).

## Brancher le client

Dans le jeu (onglet **Duo → En ligne**), renseigner l'URL du serveur :

- en local : `ws://localhost:8080`
- en production : `wss://votre-app.onrender.com`

## Déployer (palier gratuit suffisant)

Le tour par tour génère très peu de trafic ; un seul petit processus suffit.

**Render / Railway / Fly.io** (exemple Render) :
1. Nouveau *Web Service* pointant sur ce dépôt.
2. *Build command* : (aucune) — pas de dépendances.
3. *Start command* : `node server/index.js`
4. Render fournit `PORT` automatiquement (déjà lu par le serveur).
5. L'URL publique est en `https://…` → utiliser `wss://…` côté client.

> Les paliers gratuits « endorment » le service après inactivité : la première
> connexion peut être lente (cold start). Le client se reconnecte si besoin.

## Limites de cette version (MVP)

- Comptes **invités** uniquement (pas de mot de passe) ; jeton en mémoire.
- État de combat **en mémoire** du processus (pas de base de données) : un
  redémarrage perd les parties en cours. La persistance Postgres/Redis (saves,
  reprise, journal de récompenses durable) est décrite dans le doc d'architecture
  et reste à brancher.
- Sécurité de base : identité par connexion (pas via le corps des messages),
  validation serveur des intentions, idempotence par `commandId`.
