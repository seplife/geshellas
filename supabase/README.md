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

Dans **SQL Editor** de votre projet Supabase, collez et exécutez, dans
l'ordre :

1. Le contenu de `supabase/migrations/0001_init.sql`
2. (Optionnel) Le contenu de `supabase/seed.sql` pour avoir quelques chambres
   de démonstration.

> Si vous préférez la CLI Supabase (`npm i -g supabase`), vous pouvez aussi
> faire `supabase link --project-ref <ref>` puis `supabase db push`.

Ce script crée :
- les tables du domaine (`chambres`, `clients`, `sejours`, `reservations`,
  `paiements`, `notifications`, `parametres`, etc.) ;
- une table `profiles` liée à `auth.users` (nom, rôle) avec un trigger qui la
  remplit automatiquement à la création d'un compte ;
- **Row Level Security** activé partout : lecture ouverte aux utilisateurs
  authentifiés actifs, écriture **interdite** en direct (uniquement via les
  fonctions RPC ci-dessous) ;
- les fonctions RPC qui reproduisent exactement la logique métier de
  l'ancien backend (`check_in`, `check_out`, `extend_stay`, `record_payment`,
  `create_reservation`, `cancel_reservation`, `valider_nettoyage`,
  `signaler_anomalie`, `get_dashboard`, `update_settings`, gestion des
  utilisateurs...).

## 3. Créer le premier administrateur

Aucun utilisateur n'est créé par la migration (impossible de le faire de
façon fiable/portable en SQL pur). Procédure recommandée :

1. **Authentication → Users → Add user** dans le dashboard Supabase.
2. Renseignez l'e-mail et un mot de passe.
3. Dans **User Metadata** (champ JSON), ajoutez :
   ```json
   { "nom": "Admin", "prenoms": "Hellas", "role": "admin" }
   ```
   Le trigger `handle_new_user` créera automatiquement la ligne `profiles`
   correspondante avec le rôle `admin`.
4. Si vous avez créé l'utilisateur sans ces métadonnées, corrigez ensuite
   dans l'éditeur SQL :
   ```sql
   update public.profiles set role = 'admin' where id = '<uid de l'utilisateur>';
   ```

Les comptes suivants (gérant, réception, entretien) se créent ensuite
directement depuis l'application, onglet **Utilisateurs** (réservé aux
admins) — voir section 4.

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
place par le secret `CRON_SECRET` (en-tête `x-cron-secret`).

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

## 8. Limites connues / prochaines étapes suggérées

- Ajouter des tests automatisés sur les fonctions RPC (pgTAP ou Vitest côté
  frontend avec un projet Supabase de test).
- Ajouter l'upload de photos (pièce d'identité, chambres) via **Supabase
  Storage** (bucket privé + policies RLS sur `storage.objects`).
- Envisager des **templates WhatsApp approuvés** (Meta Business Manager) pour
  le tout premier contact avec un nouveau gérant, comme documenté dans
  l'ancien `backend/README.md`.
