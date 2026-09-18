# Hellas Hôtel Manager — Backend

API REST Node.js/Express + PostgreSQL pour la gestion de l'Hôtel Hellas (Divo, Côte d'Ivoire),
avec notifications WhatsApp automatiques au gérant (check-in, check-out, prolongation, alertes,
résumé journalier).

**Statut : testé de bout en bout dans cet environnement** — schéma appliqué, connexion, check-in,
paiement, check-out et changement automatique de statut de chambre ont tous été vérifiés avec une
vraie base PostgreSQL. Seul l'envoi WhatsApp réel n'a pas pu être testé (nécessite vos propres
identifiants Meta) ; il est enregistré comme échec proprement journalisé en leur absence.

## 1. Prérequis

- Node.js 18+
- PostgreSQL 14+ (ou Docker)

## 2. Installation

```bash
npm install
cp .env.example .env
# éditez .env : JWT_SECRET, DATABASE_URL, identifiants WhatsApp…
```

### Démarrer PostgreSQL en local (option Docker)

```bash
docker compose up -d
```

Sinon, utilisez une instance PostgreSQL existante et adaptez `DATABASE_URL` dans `.env`.

### Appliquer le schéma et les données de démonstration

```bash
npm run migrate
npm run seed
```

Le seed crée trois comptes de test (mot de passe `Hellas2026!`) :
- `admin@hellas-hotel.ci` (administrateur)
- `gerant@hellas-hotel.ci` (gérant)
- `reception@hellas-hotel.ci` (réceptionniste)

**Changez ces mots de passe avant toute mise en production.**

### Lancer le serveur

```bash
npm run dev      # rechargement automatique
# ou
npm start
```

L'API écoute par défaut sur `http://localhost:4000`. Vérifiez avec :

```bash
curl http://localhost:4000/health
```

## 3. Brancher l'API WhatsApp Business (Meta Cloud API)

1. Créez une app sur [Meta for Developers](https://developers.facebook.com/) et activez le produit
   **WhatsApp**.
2. Dans les réglages du produit WhatsApp, récupérez :
   - `WHATSAPP_PHONE_NUMBER_ID` (l'ID du numéro expéditeur, pas le numéro lui-même) ;
   - un token d'accès. Pour la production, créez un **utilisateur système** (System User) avec la
     permission `whatsapp_business_messaging` et générez un token permanent (pas le token
     temporaire de 24h fourni par défaut).
3. Renseignez dans `.env` :
   ```
   WHATSAPP_API_URL=https://graph.facebook.com/v20.0
   WHATSAPP_ACCESS_TOKEN=<votre_token>
   WHATSAPP_PHONE_NUMBER_ID=<votre_phone_number_id>
   MANAGER_WHATSAPP_NUMBER=+225XXXXXXXXXX
   ```
4. **Important** : le numéro du gérant doit avoir envoyé au moins un message au numéro WhatsApp
   Business de l'hôtel dans les 24 dernières heures, OU vous devez utiliser un **modèle de message
   approuvé** (message template) pour initier la conversation — WhatsApp interdit l'envoi libre de
   messages non sollicités. Pour un usage réel, faites approuver des modèles (ex. `nouveau_client`,
   `depart_client`) dans Meta Business Manager et adaptez `whatsappService.js` pour utiliser
   `type: "template"` au lieu de `type: "text"` lors du tout premier contact.
5. Ne mettez jamais ces valeurs dans le frontend : elles ne doivent exister que côté serveur, dans
   les variables d'environnement (déjà fait dans ce projet).

Sans ces identifiants, l'application continue de fonctionner normalement : chaque tentative
d'envoi est simplement enregistrée en échec dans la table `notifications`, consultable via
`GET /api/notifications` et rejouable via `POST /api/notifications/:id/renvoyer`.

## 4. Structure du projet

```
src/
  server.js              point d'entrée Express
  db/
    pool.js              pool de connexions PostgreSQL
    schema.sql            schéma complet (tables de la section 19 du cahier des charges)
    migrate.js / seed.js  scripts d'initialisation
  middleware/
    auth.js               vérification JWT + contrôle des rôles
    errorHandler.js
  routes/
    auth.routes.js         connexion
    rooms.routes.js         chambres, nettoyage, maintenance
    stays.routes.js         check-in / check-out / prolongation (automatisations)
    reservations.routes.js  réservations, anti-chevauchement
    payments.routes.js      paiements
    clients.routes.js       fiches et historique client
    notifications.routes.js journal WhatsApp
    dashboard.routes.js     statistiques temps réel
    users.routes.js         gestion des utilisateurs (admin)
    settings.routes.js      paramètres (numéro du gérant, etc.)
  services/
    whatsappService.js     intégration Meta Cloud API + journalisation + relances
  jobs/
    alertScheduler.js      cron : alerte fin de séjour (/5 min), résumé journalier (21h)
```

## 5. Rôles et permissions

Le JWT contient le rôle de l'utilisateur (`admin`, `gerant`, `reception`, `entretien`). Chaque route
est protégée par `requireAuth` puis, si nécessaire, `requireRole(...)`, conformément à la matrice de
droits du cahier des charges (section 3).

## 6. Sécurité

- Mots de passe hachés avec bcrypt (jamais stockés en clair).
- Authentification par JWT signé (`JWT_SECRET` à définir en production, valeur longue et aléatoire).
- Toutes les requêtes SQL sont paramétrées (pas de concaténation de chaînes) contre les injections.
- Les opérations multi-étapes (check-in, check-out, réservation) sont exécutées dans des
  transactions PostgreSQL (`withTransaction`) pour éviter tout état incohérent (ex. deux séjours sur
  la même chambre).
- Les clés WhatsApp ne sont accessibles que côté serveur, jamais exposées au frontend.
- Ajoutez un reverse proxy HTTPS (nginx, Caddy) devant l'API en production, et limitez `CORS_ORIGIN`
  au domaine réel du frontend.

## 7. Prochaines étapes suggérées

- Brancher le frontend (prototype React livré précédemment) sur ces endpoints à la place du
  stockage local.
- Ajouter des tests automatisés (ex. Vitest + supertest) sur les flux critiques.
- Configurer des sauvegardes automatiques de la base PostgreSQL.
- Ajouter l'upload de photos (pièce d'identité, chambres) vers un stockage objet (type S3).
