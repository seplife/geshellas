# Hellas Hôtel Manager

Application de gestion hôtelière en temps réel pour l'Hôtel Hellas (Divo,
Côte d'Ivoire) : chambres, clients, réservations, séjours, paiements et
notifications WhatsApp automatiques au gérant.

- **Frontend** : React + Vite + Tailwind CSS, mode clair/sombre.
- **Backend** : [Supabase](https://supabase.com) — Postgres avec Row Level
  Security, Auth, Edge Functions, temps réel. Aucun serveur à héberger.
- **Notifications** : WhatsApp Business (Meta Cloud API) via une Edge
  Function dédiée.

## Démarrage rapide

1. **Mettre en place Supabase** — suivez le guide complet dans
   [`supabase/README.md`](./supabase/README.md) (schéma, RLS, Edge
   Functions, premier compte administrateur).
2. **Configurer le frontend** :
   ```bash
   cp .env.example .env.local
   # renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (Project Settings > API)
   npm install
   npm run dev
   ```
3. Ouvrez `http://localhost:5173` et connectez-vous avec le compte
   administrateur créé à l'étape 1.

## Déploiement (GitHub Pages)

Le frontend est 100% statique (toutes les données passent par Supabase), il
se déploie donc directement sur GitHub Pages via
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) :

1. Dans **Settings → Pages** du dépôt, réglez la source sur **GitHub
   Actions**.
2. Dans **Settings → Secrets and variables → Actions**, ajoutez deux
   secrets de dépôt : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
3. Poussez sur `main` : le workflow construit et publie automatiquement sur
   `https://<votre-compte>.github.io/geshellas/`.

## Rôles

| Rôle | Accès |
|---|---|
| `admin` | Tout, y compris gestion des utilisateurs et paramètres |
| `gerant` | Tableau de bord, chambres, clients, paiements, notifications |
| `reception` | Tableau de bord, chambres, clients, réservations, paiements |
| `entretien` | Tableau de bord, chambres (nettoyage / anomalies) |

Ces règles sont appliquées **côté base de données** (RLS + fonctions
`SECURITY DEFINER`), pas seulement dans l'interface : un appel API direct
avec un compte non autorisé est rejeté par Postgres lui-même.

## Structure du dépôt

```
src/                 Frontend React
  components/        Composants UI et de mise en page réutilisables
  context/           Auth (session Supabase) et notifications (toasts)
  pages/             Une page par section, + modales
  services/          Appels Supabase (table queries, RPC, edge functions)
  lib/               Client Supabase, formatage (dates, FCFA)
supabase/
  migrations/        Schéma SQL complet, RLS, fonctions métier
  functions/         Edge Functions (WhatsApp, cron, création d'utilisateurs)
  seed.sql           Données de démonstration (chambres)
  README.md          Guide de mise en place détaillé
.github/workflows/   Déploiement automatique sur GitHub Pages
```

## Notes de migration

Ce projet remplace un ancien backend Node.js/Express + PostgreSQL
autohébergé par Supabase : mêmes fonctionnalités, mêmes règles métier
(vérifiées par des tests manuels reproduisant check-in → paiement →
check-out), mais sans serveur à maintenir et avec une sécurité appliquée au
niveau de la base de données plutôt que dans le code applicatif.
