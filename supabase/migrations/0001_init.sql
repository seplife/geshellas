-- ============================================================================
-- Hellas Hôtel Manager — schéma Supabase
-- ============================================================================
-- Ce fichier remplace entièrement l'ancien backend Express/PostgreSQL.
-- Toute la logique métier sensible (check-in, check-out, paiements, ...) vit
-- dans des fonctions Postgres SECURITY DEFINER : le frontend n'a jamais accès
-- direct en écriture aux tables, il appelle uniquement des RPC contrôlées.
--
-- À exécuter dans l'éditeur SQL de votre projet Supabase (ou via
-- `supabase db push` si vous utilisez la CLI), PUIS 0002_corrections.sql.
-- Ce script est relançable sans erreur. Voir supabase/README.md.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Types
-- ----------------------------------------------------------------------------

do $$ begin
  create type role_utilisateur as enum ('admin', 'gerant', 'reception', 'entretien');
exception when duplicate_object then null; end $$;

do $$ begin
  create type statut_chambre as enum ('libre', 'occupee', 'reservee', 'nettoyage', 'maintenance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type statut_sejour as enum ('en_cours', 'termine', 'annule');
exception when duplicate_object then null; end $$;

do $$ begin
  create type statut_reservation as enum ('en_attente', 'confirmee', 'annulee', 'client_arrive', 'client_absent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type statut_notification as enum ('en_attente', 'envoyee', 'echec');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Profils utilisateurs (1-1 avec auth.users)
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nom         text not null default '',
  prenoms     text not null default '',
  telephone   text,
  role        role_utilisateur not null default 'reception',
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Profil applicatif (rôle, nom) associé à chaque utilisateur Supabase Auth.';

-- Crée automatiquement un profil quand un utilisateur est créé (dashboard,
-- edge function admin-create-user, ou invitation). Le rôle et le nom peuvent
-- être passés via les métadonnées utilisateur (raw_user_meta_data).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nom, prenoms, telephone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'prenoms', ''),
    new.raw_user_meta_data->>'telephone',
    coalesce((new.raw_user_meta_data->>'role')::role_utilisateur, 'reception')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Tables du domaine
-- ----------------------------------------------------------------------------

create table if not exists public.chambres (
  id            bigint generated always as identity primary key,
  numero        text not null unique,
  type          text not null,
  categorie     text,
  prix_nuit     numeric(12,2) not null check (prix_nuit >= 0),
  capacite      integer not null default 2,
  nombre_lits   integer not null default 1,
  etage         integer not null default 1,
  equipements   text,
  description   text,
  photo_url     text,
  statut        statut_chambre not null default 'libre',
  panne_note    text,
  created_at    timestamptz not null default now()
);

create table if not exists public.clients (
  id              bigint generated always as identity primary key,
  nom             text not null,
  prenoms         text not null,
  sexe            text check (sexe in ('M', 'F')),
  date_naissance  date,
  nationalite     text,
  profession      text,
  adresse         text,
  telephone       text not null,
  whatsapp        text,
  email           text,
  type_piece      text not null,
  numero_piece    text not null,
  piece_photo_url text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_clients_telephone on public.clients (telephone);
create index if not exists idx_clients_numero_piece on public.clients (numero_piece);

create table if not exists public.sejours (
  id                    bigint generated always as identity primary key,
  numero                text not null unique,
  client_id             bigint not null references public.clients(id),
  chambre_id            bigint not null references public.chambres(id),
  date_entree           date not null,
  heure_entree          time not null,
  date_sortie_prevue    date not null,
  heure_sortie_prevue   time not null,
  date_sortie_reelle    date,
  heure_sortie_reelle   time,
  nb_personnes          integer not null default 1,
  statut                statut_sejour not null default 'en_cours',
  montant_total         numeric(12,2) not null default 0,
  montant_paye          numeric(12,2) not null default 0,
  solde                 numeric(12,2) not null default 0,
  cree_par              uuid references public.profiles(id),
  created_at            timestamptz not null default now()
);
create index if not exists idx_sejours_statut on public.sejours (statut);
create index if not exists idx_sejours_chambre on public.sejours (chambre_id);

create table if not exists public.reservations (
  id             bigint generated always as identity primary key,
  nom_client     text not null,
  telephone      text,
  client_id      bigint references public.clients(id),
  chambre_id     bigint not null references public.chambres(id),
  date_arrivee   date not null,
  date_depart    date not null,
  statut         statut_reservation not null default 'en_attente',
  montant        numeric(12,2) not null default 0,
  avance         numeric(12,2) not null default 0,
  cree_par       uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index if not exists idx_reservations_chambre_dates on public.reservations (chambre_id, date_arrivee, date_depart);

create table if not exists public.paiements (
  id              bigint generated always as identity primary key,
  sejour_id       bigint references public.sejours(id),
  reservation_id  bigint references public.reservations(id),
  montant         numeric(12,2) not null check (montant > 0),
  mode_paiement   text not null,
  reference       text,
  date_paiement   timestamptz not null default now(),
  utilisateur_id  uuid references public.profiles(id)
);

create table if not exists public.notifications (
  id                bigint generated always as identity primary key,
  type              text not null,
  destinataire      text not null,
  message           text not null,
  statut            statut_notification not null default 'en_attente',
  tentatives        integer not null default 0,
  erreur            text,
  reference_externe text,
  sejour_id         bigint references public.sejours(id),
  date_envoi        timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists public.historique_statuts_chambres (
  id                 bigint generated always as identity primary key,
  chambre_id         bigint not null references public.chambres(id),
  ancien_statut      statut_chambre,
  nouveau_statut     statut_chambre not null,
  utilisateur_id     uuid references public.profiles(id),
  date_modification  timestamptz not null default now()
);

create table if not exists public.journal_activite (
  id             bigint generated always as identity primary key,
  utilisateur_id uuid references public.profiles(id),
  action         text not null,
  details        jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.parametres (
  cle    text primary key,
  valeur text
);

insert into public.parametres (cle, valeur)
values ('manager_whatsapp', '+2250779535795')
on conflict (cle) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Fonctions utilitaires de rôle
-- ----------------------------------------------------------------------------

create or replace function public.current_role_actif()
returns role_utilisateur
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and actif = true;
$$;

create or replace function public.require_role(variadic roles role_utilisateur[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r role_utilisateur;
begin
  r := public.current_role_actif();
  if r is null then
    raise exception 'Authentification requise ou compte désactivé.' using errcode = '28000';
  end if;
  if not (r = any(roles)) then
    raise exception 'Accès non autorisé pour ce rôle.' using errcode = '42501';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------
-- Principe : la lecture est ouverte à tout utilisateur authentifié et actif
-- (matrice fine gérée côté frontend selon le rôle, comme dans l'app d'origine).
-- L'écriture directe sur les tables est INTERDITE : tout passe par les
-- fonctions RPC ci-dessous (SECURITY DEFINER), qui appliquent les règles de
-- rôle et la logique transactionnelle. Aucune policy INSERT/UPDATE/DELETE
-- n'est créée pour les rôles "authenticated" ⇒ refus par défaut.

alter table public.profiles enable row level security;
alter table public.chambres enable row level security;
alter table public.clients enable row level security;
alter table public.sejours enable row level security;
alter table public.reservations enable row level security;
alter table public.paiements enable row level security;
alter table public.notifications enable row level security;
alter table public.historique_statuts_chambres enable row level security;
alter table public.journal_activite enable row level security;
alter table public.parametres enable row level security;

drop policy if exists "profil: lecture de son propre profil" on public.profiles;
create policy "profil: lecture de son propre profil" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profil: admin lit tous les profils" on public.profiles;
create policy "profil: admin lit tous les profils" on public.profiles
  for select using (public.current_role_actif() = 'admin');

drop policy if exists "lecture authentifiée: chambres" on public.chambres;
create policy "lecture authentifiée: chambres" on public.chambres
  for select using (public.current_role_actif() is not null);

drop policy if exists "lecture authentifiée: clients" on public.clients;
create policy "lecture authentifiée: clients" on public.clients
  for select using (public.current_role_actif() is not null);

drop policy if exists "lecture authentifiée: sejours" on public.sejours;
create policy "lecture authentifiée: sejours" on public.sejours
  for select using (public.current_role_actif() is not null);

drop policy if exists "lecture authentifiée: reservations" on public.reservations;
create policy "lecture authentifiée: reservations" on public.reservations
  for select using (public.current_role_actif() is not null);

drop policy if exists "lecture authentifiée: paiements" on public.paiements;
create policy "lecture authentifiée: paiements" on public.paiements
  for select using (public.current_role_actif() in ('admin', 'gerant', 'reception'));

drop policy if exists "lecture authentifiée: notifications" on public.notifications;
create policy "lecture authentifiée: notifications" on public.notifications
  for select using (public.current_role_actif() in ('admin', 'gerant'));

drop policy if exists "lecture authentifiée: historique chambres" on public.historique_statuts_chambres;
create policy "lecture authentifiée: historique chambres" on public.historique_statuts_chambres
  for select using (public.current_role_actif() = 'admin');

drop policy if exists "lecture authentifiée: journal activite" on public.journal_activite;
create policy "lecture authentifiée: journal activite" on public.journal_activite
  for select using (public.current_role_actif() = 'admin');

drop policy if exists "lecture authentifiée: parametres" on public.parametres;
create policy "lecture authentifiée: parametres" on public.parametres
  for select using (public.current_role_actif() = 'admin');

-- Realtime : permet au frontend de s'abonner aux changements (chambres,
-- séjours, notifications) pour un tableau de bord vraiment temps réel.
do $$
declare t text;
begin
  foreach t in array array['chambres', 'sejours', 'reservations', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Fonctions métier (RPC)
-- ----------------------------------------------------------------------------

create or replace function public.nights_between(d1 date, d2 date)
returns integer language sql immutable as $$
  select greatest(1, (d2 - d1)::int);
$$;

-- ---- Check-in -----------------------------------------------------------
create or replace function public.check_in(
  p_client jsonb,
  p_chambre_id bigint,
  p_date_entree date,
  p_heure_entree time,
  p_date_sortie_prevue date,
  p_heure_sortie_prevue time,
  p_nb_personnes int default 1,
  p_avance numeric default 0,
  p_mode_paiement text default 'Espèces'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room chambres%rowtype;
  v_client clients%rowtype;
  v_sejour sejours%rowtype;
  v_nights int;
  v_montant_total numeric;
begin
  perform public.require_role('admin', 'reception');

  select * into v_room from chambres where id = p_chambre_id for update;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;
  if v_room.statut <> 'libre' then
    raise exception 'Cette chambre n''est pas libre.' using errcode = '23514';
  end if;

  insert into clients (nom, prenoms, sexe, date_naissance, nationalite, profession, adresse,
                        telephone, whatsapp, email, type_piece, numero_piece)
  values (
    p_client->>'nom', p_client->>'prenoms', nullif(p_client->>'sexe', ''),
    nullif(p_client->>'date_naissance', '')::date, nullif(p_client->>'nationalite', ''),
    nullif(p_client->>'profession', ''), nullif(p_client->>'adresse', ''),
    p_client->>'telephone', coalesce(nullif(p_client->>'whatsapp', ''), p_client->>'telephone'),
    nullif(p_client->>'email', ''), p_client->>'type_piece', p_client->>'numero_piece'
  )
  returning * into v_client;

  v_nights := public.nights_between(p_date_entree, p_date_sortie_prevue);
  v_montant_total := v_nights * v_room.prix_nuit;

  insert into sejours (numero, client_id, chambre_id, date_entree, heure_entree,
                        date_sortie_prevue, heure_sortie_prevue, nb_personnes,
                        montant_total, montant_paye, solde, cree_par)
  values (
    'SEJ-' || upper(to_hex(extract(epoch from clock_timestamp())::bigint)),
    v_client.id, v_room.id, p_date_entree, p_heure_entree, p_date_sortie_prevue,
    p_heure_sortie_prevue, p_nb_personnes, v_montant_total, coalesce(p_avance, 0),
    v_montant_total - coalesce(p_avance, 0), auth.uid()
  )
  returning * into v_sejour;

  if coalesce(p_avance, 0) > 0 then
    insert into paiements (sejour_id, montant, mode_paiement, utilisateur_id)
    values (v_sejour.id, p_avance, coalesce(p_mode_paiement, 'Espèces'), auth.uid());
  end if;

  update chambres set statut = 'occupee' where id = v_room.id;
  insert into historique_statuts_chambres (chambre_id, ancien_statut, nouveau_statut, utilisateur_id)
  values (v_room.id, 'libre', 'occupee', auth.uid());
  insert into journal_activite (utilisateur_id, action, details)
  values (auth.uid(), 'check-in', jsonb_build_object('sejour_id', v_sejour.id, 'chambre', v_room.numero));

  return jsonb_build_object(
    'client', to_jsonb(v_client),
    'room', to_jsonb(v_room) || jsonb_build_object('statut', 'occupee'),
    'sejour', to_jsonb(v_sejour)
  );
end;
$$;

-- ---- Check-out ------------------------------------------------------------
create or replace function public.check_out(
  p_sejour_id bigint,
  p_montant_supplementaire numeric default 0,
  p_mode_paiement text default 'Espèces'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sejour sejours%rowtype;
  v_chambre_numero text;
  v_montant_paye numeric;
  v_solde numeric;
begin
  perform public.require_role('admin', 'reception');

  select * into v_sejour from sejours where id = p_sejour_id for update;
  if not found then
    raise exception 'Séjour introuvable.' using errcode = 'P0002';
  end if;
  if v_sejour.statut <> 'en_cours' then
    raise exception 'Ce séjour est déjà terminé.' using errcode = '23514';
  end if;
  select numero into v_chambre_numero from chambres where id = v_sejour.chambre_id;

  v_montant_paye := v_sejour.montant_paye + coalesce(p_montant_supplementaire, 0);
  v_solde := v_sejour.montant_total - v_montant_paye;

  update sejours set statut = 'termine', date_sortie_reelle = current_date,
    heure_sortie_reelle = current_time, montant_paye = v_montant_paye, solde = v_solde
  where id = v_sejour.id
  returning * into v_sejour;

  if coalesce(p_montant_supplementaire, 0) > 0 then
    insert into paiements (sejour_id, montant, mode_paiement, utilisateur_id)
    values (v_sejour.id, p_montant_supplementaire, coalesce(p_mode_paiement, 'Espèces'), auth.uid());
  end if;

  update chambres set statut = 'nettoyage' where id = v_sejour.chambre_id;
  insert into historique_statuts_chambres (chambre_id, ancien_statut, nouveau_statut, utilisateur_id)
  values (v_sejour.chambre_id, 'occupee', 'nettoyage', auth.uid());
  insert into journal_activite (utilisateur_id, action, details)
  values (auth.uid(), 'check-out', jsonb_build_object('sejour_id', v_sejour.id));

  return jsonb_build_object('sejour', to_jsonb(v_sejour), 'chambre_numero', v_chambre_numero,
    'client_id', v_sejour.client_id);
end;
$$;

-- ---- Prolongation -----------------------------------------------------------
create or replace function public.extend_stay(
  p_sejour_id bigint,
  p_nouvelle_date_sortie date,
  p_nouvelle_heure_sortie time,
  p_paiement_supplementaire numeric default 0,
  p_mode_paiement text default 'Espèces'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sejour sejours%rowtype;
  v_prix_nuit numeric;
  v_chambre_numero text;
  v_ancienne_sortie date;
  v_nights int;
  v_montant_total numeric;
  v_montant_supplementaire numeric;
  v_montant_paye numeric;
begin
  perform public.require_role('admin', 'reception');

  select * into v_sejour from sejours where id = p_sejour_id for update;
  if not found then
    raise exception 'Séjour introuvable.' using errcode = 'P0002';
  end if;
  if v_sejour.statut <> 'en_cours' then
    raise exception 'Ce séjour n''est plus actif.' using errcode = '23514';
  end if;
  select prix_nuit, numero into v_prix_nuit, v_chambre_numero from chambres where id = v_sejour.chambre_id;

  v_ancienne_sortie := v_sejour.date_sortie_prevue;
  v_nights := public.nights_between(v_sejour.date_entree, p_nouvelle_date_sortie);
  v_montant_total := v_nights * v_prix_nuit;
  v_montant_supplementaire := v_montant_total - v_sejour.montant_total;
  v_montant_paye := v_sejour.montant_paye + coalesce(p_paiement_supplementaire, 0);

  update sejours set date_sortie_prevue = p_nouvelle_date_sortie,
    heure_sortie_prevue = p_nouvelle_heure_sortie, montant_total = v_montant_total,
    montant_paye = v_montant_paye, solde = v_montant_total - v_montant_paye
  where id = v_sejour.id
  returning * into v_sejour;

  if coalesce(p_paiement_supplementaire, 0) > 0 then
    insert into paiements (sejour_id, montant, mode_paiement, utilisateur_id)
    values (v_sejour.id, p_paiement_supplementaire, coalesce(p_mode_paiement, 'Espèces'), auth.uid());
  end if;

  return jsonb_build_object('sejour', to_jsonb(v_sejour), 'chambre_numero', v_chambre_numero,
    'ancienne_sortie', v_ancienne_sortie, 'montant_supplementaire', v_montant_supplementaire,
    'client_id', v_sejour.client_id);
end;
$$;

-- ---- Paiement libre (hors check-out) ---------------------------------------
create or replace function public.record_payment(
  p_sejour_id bigint,
  p_montant numeric,
  p_mode_paiement text,
  p_reference text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sejour sejours%rowtype;
  v_paiement paiements%rowtype;
begin
  perform public.require_role('admin', 'reception');
  if p_montant is null or p_montant <= 0 then
    raise exception 'Montant invalide.' using errcode = '23514';
  end if;

  select * into v_sejour from sejours where id = p_sejour_id for update;
  if not found then
    raise exception 'Séjour introuvable.' using errcode = 'P0002';
  end if;

  update sejours set montant_paye = montant_paye + p_montant, solde = solde - p_montant
  where id = v_sejour.id;

  insert into paiements (sejour_id, montant, mode_paiement, reference, utilisateur_id)
  values (v_sejour.id, p_montant, p_mode_paiement, p_reference, auth.uid())
  returning * into v_paiement;

  return to_jsonb(v_paiement);
end;
$$;

-- ---- Chambres : nettoyage / anomalie ---------------------------------------
create or replace function public.valider_nettoyage(p_chambre_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut statut_chambre;
begin
  perform public.require_role('admin', 'entretien');
  select statut into v_statut from chambres where id = p_chambre_id for update;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;
  if v_statut not in ('nettoyage', 'maintenance') then
    raise exception 'Cette chambre n''est pas en nettoyage ni en maintenance.' using errcode = '23514';
  end if;
  update chambres set statut = 'libre', panne_note = null where id = p_chambre_id;
  insert into historique_statuts_chambres (chambre_id, ancien_statut, nouveau_statut, utilisateur_id)
  values (p_chambre_id, v_statut, 'libre', auth.uid());
end;
$$;

create or replace function public.signaler_anomalie(p_chambre_id bigint, p_description text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut statut_chambre;
begin
  perform public.require_role('admin', 'entretien');
  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'Description requise.' using errcode = '23514';
  end if;
  select statut into v_statut from chambres where id = p_chambre_id for update;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;
  update chambres set statut = 'maintenance', panne_note = p_description where id = p_chambre_id;
  insert into historique_statuts_chambres (chambre_id, ancien_statut, nouveau_statut, utilisateur_id)
  values (p_chambre_id, v_statut, 'maintenance', auth.uid());
end;
$$;

-- ---- Chambres : création / mise à jour (admin) -----------------------------
create or replace function public.create_room(p_room jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room chambres%rowtype;
begin
  perform public.require_role('admin');
  insert into chambres (numero, type, categorie, prix_nuit, capacite, nombre_lits, etage, equipements, description, photo_url)
  values (
    p_room->>'numero', p_room->>'type', coalesce(p_room->>'categorie', p_room->>'type'),
    (p_room->>'prix_nuit')::numeric, coalesce((p_room->>'capacite')::int, 2),
    coalesce((p_room->>'nombre_lits')::int, 1), coalesce((p_room->>'etage')::int, 1),
    p_room->>'equipements', p_room->>'description', p_room->>'photo_url'
  )
  returning * into v_room;
  return to_jsonb(v_room);
end;
$$;

create or replace function public.update_room(p_id bigint, p_room jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room chambres%rowtype;
begin
  perform public.require_role('admin');
  update chambres set
    numero = coalesce(p_room->>'numero', numero),
    type = coalesce(p_room->>'type', type),
    categorie = coalesce(p_room->>'categorie', categorie),
    prix_nuit = coalesce((p_room->>'prix_nuit')::numeric, prix_nuit),
    capacite = coalesce((p_room->>'capacite')::int, capacite),
    nombre_lits = coalesce((p_room->>'nombre_lits')::int, nombre_lits),
    etage = coalesce((p_room->>'etage')::int, etage),
    equipements = coalesce(p_room->>'equipements', equipements),
    description = coalesce(p_room->>'description', description),
    photo_url = coalesce(p_room->>'photo_url', photo_url)
  where id = p_id
  returning * into v_room;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;
  return to_jsonb(v_room);
end;
$$;

-- ---- Réservations -----------------------------------------------------------
create or replace function public.create_reservation(
  p_nom_client text,
  p_telephone text,
  p_chambre_id bigint,
  p_date_arrivee date,
  p_date_depart date,
  p_montant numeric default 0,
  p_avance numeric default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room chambres%rowtype;
  v_reservation reservations%rowtype;
  v_overlap int;
begin
  perform public.require_role('admin', 'reception');

  select count(*) into v_overlap from reservations
  where chambre_id = p_chambre_id and statut in ('en_attente', 'confirmee')
    and date_arrivee < p_date_depart and date_depart > p_date_arrivee;
  if v_overlap > 0 then
    raise exception 'Cette chambre est déjà réservée pour cette période.' using errcode = '23514';
  end if;

  select * into v_room from chambres where id = p_chambre_id for update;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;

  insert into reservations (nom_client, telephone, chambre_id, date_arrivee, date_depart,
                             montant, avance, statut, cree_par)
  values (p_nom_client, p_telephone, p_chambre_id, p_date_arrivee, p_date_depart,
          coalesce(p_montant, 0), coalesce(p_avance, 0), 'confirmee', auth.uid())
  returning * into v_reservation;

  if v_room.statut = 'libre' then
    update chambres set statut = 'reservee' where id = p_chambre_id;
  end if;

  return to_jsonb(v_reservation);
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation reservations%rowtype;
  v_autres int;
begin
  perform public.require_role('admin', 'reception');

  select * into v_reservation from reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Réservation introuvable.' using errcode = 'P0002';
  end if;

  update reservations set statut = 'annulee' where id = p_reservation_id;

  select count(*) into v_autres from reservations
  where chambre_id = v_reservation.chambre_id and statut in ('en_attente', 'confirmee')
    and id <> p_reservation_id;

  if v_autres = 0 then
    update chambres set statut = 'libre' where id = v_reservation.chambre_id and statut = 'reservee';
  end if;
end;
$$;

-- ---- Paramètres (admin) -----------------------------------------------------
create or replace function public.update_settings(p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  v text;
begin
  perform public.require_role('admin');
  for k, v in select * from jsonb_each_text(p_settings) loop
    insert into parametres (cle, valeur) values (k, v)
    on conflict (cle) do update set valeur = excluded.valeur;
  end loop;
end;
$$;

create or replace function public.get_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(cle, valeur), '{}'::jsonb) from parametres;
$$;

-- ---- Utilisateurs (admin) ---------------------------------------------------
create or replace function public.list_users()
returns setof profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.* from profiles p
  where public.current_role_actif() = 'admin'
  order by p.created_at desc;
$$;

create or replace function public.set_user_active(p_user_id uuid, p_actif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_role('admin');
  update profiles set actif = p_actif where id = p_user_id;
end;
$$;

create or replace function public.set_user_role(p_user_id uuid, p_role role_utilisateur)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_role('admin');
  update profiles set role = p_role where id = p_user_id;
end;
$$;

-- ---- Notifications : relance (le vrai envoi est fait par l'edge function) ---
create or replace function public.mark_notification_result(
  p_notification_id bigint,
  p_ok boolean,
  p_tentatives int,
  p_erreur text default null,
  p_reference_externe text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update notifications set
    statut = case when p_ok then 'envoyee' else 'echec' end,
    tentatives = p_tentatives,
    erreur = p_erreur,
    reference_externe = coalesce(p_reference_externe, reference_externe),
    date_envoi = case when p_ok then now() else date_envoi end
  where id = p_notification_id;
end;
$$;

-- ---- Tableau de bord ---------------------------------------------------------
create or replace function public.get_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total int;
  v_libres int;
  v_occupees int;
  v_reservees int;
  v_nettoyage int;
  v_maintenance int;
  v_clients_presents int;
  v_arrivees_jour int;
  v_departs_jour int;
  v_recettes_jour numeric;
  v_retard jsonb;
  v_soldes jsonb;
begin
  perform public.require_role('admin', 'gerant', 'reception', 'entretien');

  select count(*) into v_total from chambres;
  select count(*) into v_libres from chambres where statut = 'libre';
  select count(*) into v_occupees from chambres where statut = 'occupee';
  select count(*) into v_reservees from chambres where statut = 'reservee';
  select count(*) into v_nettoyage from chambres where statut = 'nettoyage';
  select count(*) into v_maintenance from chambres where statut = 'maintenance';
  select count(*) into v_clients_presents from sejours where statut = 'en_cours';
  select count(*) into v_arrivees_jour from sejours where date_entree = current_date;
  select count(*) into v_departs_jour from sejours where statut = 'en_cours' and date_sortie_prevue = current_date;
  select coalesce(sum(montant), 0) into v_recettes_jour from paiements where date_paiement::date = current_date;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_retard from (
    select s.*, c.nom as client_nom, c.prenoms as client_prenoms, ch.numero as chambre_numero
    from sejours s join clients c on c.id = s.client_id join chambres ch on ch.id = s.chambre_id
    where s.statut = 'en_cours' and (s.date_sortie_prevue + s.heure_sortie_prevue::interval) < now()
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_soldes from (
    select s.*, c.nom as client_nom, c.prenoms as client_prenoms, ch.numero as chambre_numero
    from sejours s join clients c on c.id = s.client_id join chambres ch on ch.id = s.chambre_id
    where s.statut = 'en_cours' and s.solde > 0
  ) t;

  return jsonb_build_object(
    'total_chambres', v_total, 'libres', v_libres, 'occupees', v_occupees,
    'reservees', v_reservees, 'nettoyage', v_nettoyage, 'maintenance', v_maintenance,
    'clients_presents', v_clients_presents, 'arrivees_jour', v_arrivees_jour,
    'departs_jour', v_departs_jour, 'recettes_jour', v_recettes_jour,
    'taux_occupation', case when v_total > 0 then round((v_occupees::numeric / v_total) * 100) else 0 end,
    'sejours_en_retard', v_retard, 'soldes_restants', v_soldes
  );
end;
$$;

-- ---- Alertes fin de séjour (utilisé par la cron edge function) -------------
create or replace function public.get_upcoming_checkouts(p_window_minutes int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
    select s.*, c.nom as client_nom, c.prenoms as client_prenoms, ch.numero as chambre_numero
    from sejours s join clients c on c.id = s.client_id join chambres ch on ch.id = s.chambre_id
    where s.statut = 'en_cours'
      and (s.date_sortie_prevue + s.heure_sortie_prevue::interval)
          between now() and now() + make_interval(mins => p_window_minutes)
  ) t;
$$;

create or replace function public.get_daily_summary(p_day date default current_date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'arrivees', (select count(*) from sejours where date_entree = p_day),
    'departs', (select count(*) from sejours where date_sortie_reelle = p_day),
    'occupees', (select count(*) from chambres where statut = 'occupee'),
    'libres', (select count(*) from chambres where statut = 'libre'),
    'recettes', (select coalesce(sum(montant), 0) from paiements where date_paiement::date = p_day)
  );
$$;

-- Toutes les fonctions RPC ci-dessus sont exécutables par les utilisateurs
-- authentifiés ; le contrôle de rôle fin est fait à l'intérieur de chaque
-- fonction via require_role().
grant execute on all functions in schema public to authenticated;
grant usage on schema public to authenticated;
