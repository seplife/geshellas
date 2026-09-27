# Hellas Hôtel Manager — Backend Supabase

Ce dossier remplace entièrement l'ancien backend Express/PostgreSQL. Toutes
les données vivent maintenant dans Supabase (base Postgres managée +
authentification + Edge Functions), et le frontend (à la racine du dépôt)
s'y connecte directement.

## 1. Créer le projet Supabase

1. Allez sur [supabase.com](https://supabase.com) → **New project**.
2. Notez le mot de passe de la base (utile pour la CLI, pas indispensable
   sinon) et attendez la fin du provisioning (~2 min).
3. Dans **Project Settings → API**, récupérez :
   - `Project URL` → deviendra `VITE_SUPABASE_URL`
   - `anon public key` → deviendra `VITE_SUPABASE_ANON_KEY`
   - `service_role key` → **ne jamais** la mettre dans le frontend ; elle sert
     uniquement aux Edge Functions (étape 4).

## 2. Appliquer le schéma

Dans **SQL Editor** de votre projet Supabase, collez et exécutez, **dans
l'ordre** :

1. `supabase/migrations/0001_init.sql` — schéma, RLS, fonctions métier ;
2. `supabase/migrations/0002_corrections.sql` — correctifs de sécurité et de
   cohérence (**obligatoire** : le frontend actuel en dépend) ;
3. (Optionnel) `supabase/seed.sql` pour quelques chambres de démonstration.

Les deux scripts sont **relançables** sans erreur : en cas de doute, exécutez-les
à nouveau. `0002` se termine par `notify pgrst, 'reload schema'`, qui force
l'API à prendre en compte les nouvelles fonctions immédiatement.

> Avec la CLI (`npm i -g supabase`) : `supabase link --project-ref <ref>` puis
> `supabase db push`.

### Dépannage : « Could not find the function public.get_dashboard without parameters in the schema cache »

Ce message signifie que l'API ne trouve pas la fonction dans la base. Causes
possibles :

- `0001_init.sql` n'a jamais été exécuté, ou a échoué en cours de route.
  L'ancienne version n'était pas relançable (`policy ... already exists`) et une
  erreur annule **tout** le script — y compris `get_dashboard`. La version
  actuelle est relançable.
- `0002_corrections.sql` n'a pas été exécuté.
- Le cache de l'API n'a pas été rechargé : exécutez `notify pgrst, 'reload schema';`
  dans l'éditeur SQL.

Vérification rapide :

```sql
select proname, pg_get_function_identity_arguments(oid)
from pg_proc where pronamespace = 'public'::regnamespace and proname = 'get_dashboard';
```

## 3. Créer le premier administrateur

> **Sécurité.** Le rôle d'un compte n'est **plus** lu dans les « User Metadata »
> (modifiables par n'importe qui lors d'une inscription), mais uniquement dans
> `app_metadata`, que seule la clé `service_role` peut écrire. Tout compte créé
> hors de l'application est créé **désactivé**.
>
> Désactivez aussi les inscriptions publiques : **Authentication → Sign In /
> Providers → « Allow new users to sign up » = off**.

1. **Authentication → Users → Add user → Create new user** : e-mail + mot de
   passe, cochez « Auto Confirm User ».
2. Dans l'éditeur SQL, promouvez et activez ce compte :
   ```sql
   update public.profiles
   set role = 'admin', actif = true, nom = 'Admin', prenoms = 'Hellas'
   where id = (select id from auth.users where email = 'votre@email.ci');
   ```

Les comptes suivants (gérant, réception, entretien) se créent depuis
l'application, onglet **Utilisateurs** (Edge Function `admin-create-user`).

## 4. Déployer les Edge Functions

Les Edge Functions gèrent tout ce qui nécessite un secret serveur : l'envoi
WhatsApp (token Meta) et la création de comptes utilisateurs (clé
`service_role`).

```bash
npm install -g supabase
supabase login
supabase link --project-ref <votre-ref-projet>

# Secrets partagés par toutes les fonctions
supabase secrets set \
  SUPABASE_URL=https://<ref>.supabase.co \
  SUPABASE_ANON_KEY=<votre anon key> \
  SUPABASE_SERVICE_ROLE_KEY=<votre service_role key> \
  WHATSAPP_API_URL=https://graph.facebook.com/v20.0 \
  WHATSAPP_ACCESS_TOKEN=<votre token Meta> \
  WHATSAPP_PHONE_NUMBER_ID=<votre phone_number_id> \
  MANAGER_WHATSAPP_NUMBER=+225XXXXXXXXXX \
  WHATSAPP_MAX_RETRIES=3 \
  CRON_SECRET=<une longue chaîne aléatoire>

# Déploiement
supabase functions deploy notify
supabase functions deploy admin-create-user
supabase functions deploy cron-alerts --no-verify-jwt
```

`cron-alerts` est déployée **sans** vérification JWT car elle est appelée par
`pg_cron`/`pg_net`, pas par un utilisateur connecté — elle est protégée à la
place par le secret `CRON_SECRET` (en-tête `x-cron-secret`), **obligatoire** :
sans lui, la fonction refuse toutes les requêtes.

`notify` vérifie elle-même le rôle de l'appelant (réception/admin pour les
envois, gérant/admin pour les relances).

Sans `WHATSAPP_*`, l'application continue de fonctionner normalement : chaque
tentative d'envoi est journalisée en échec dans l'onglet Notifications, avec
un bouton "Réessayer".

## 5. Planifier les alertes automatiques (pg_cron)

Dans l'éditeur SQL, activez les extensions puis programmez les deux tâches
(remplacez `<ref>` et `<CRON_SECRET>` par vos valeurs) :

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Alerte fin de séjour proche, toutes les 5 minutes
select cron.schedule(
  'hellas-checkout-alerts',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<ref>.functions.supabase.co/cron-alerts?job=checkout',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
  $$
);

-- Résumé journalier à 21h00 UTC (adaptez à votre fuseau horaire)
select cron.schedule(
  'hellas-daily-summary',
  '0 21 * * *',
  $$
  select net.http_post(
    url := 'https://<ref>.functions.supabase.co/cron-alerts?job=daily',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
  $$
);
```

## 6. Configurer le frontend

À la racine du dépôt :

```bash
cp .env.example .env.local
# renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## 7. Sécurité — ce qui a changé par rapport à l'ancien backend

| Avant (Express) | Maintenant (Supabase) |
|---|---|
| JWT signé maison, secret dans `.env` | Supabase Auth (JWT géré, refresh automatique) |
| Contrôle de rôle dans les routes Express | Contrôle de rôle **dans la base** (RLS + `require_role()` dans chaque fonction RPC) — impossible à contourner même en appelant l'API directement |
| Mots de passe hachés avec bcrypt "maison" | Géré nativement par Supabase Auth |
| Clé WhatsApp dans `backend/.env` | Secrets d'Edge Function (jamais exposés, jamais dans le frontend) |
| Un seul serveur à héberger et surveiller | Rien à héberger : Postgres + Auth + Edge Functions + cron sont managés par Supabase |

## 8. Règles métier (depuis 0002)

- **Réservations** : une réservation future ne bloque plus la chambre ; celle-ci
  passe « réservée » le jour de l'arrivée (synchronisation automatique au
  chargement du tableau de bord et toutes les 5 min via `cron-alerts`). Les
  réservations dont la date de départ est passée sans arrivée deviennent
  « client absent ». Le check-in se fait depuis la réservation et reprend
  l'avance versée.
- **Chevauchements** : check-in, prolongation et réservation refusent toute
  période en conflit avec une autre réservation ou un séjour en cours.
- **Anomalies** : signalée sur une chambre occupée, elle est notée sans changer
  le statut ; la chambre passe en maintenance au check-out.
- **Clients** : une fiche est réutilisée si la même pièce d'identité revient.
- **Rôle entretien** : le tableau de bord ne lui renvoie aucune donnée financière.

## 9. Pistes d'amélioration

- Tests automatisés des fonctions RPC (pgTAP).
- Upload des pièces d'identité via **Supabase Storage** (bucket privé + RLS).
- Templates WhatsApp approuvés (Meta Business Manager).
