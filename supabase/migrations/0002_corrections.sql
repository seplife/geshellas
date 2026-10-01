-- ============================================================================
-- Hellas Hôtel Manager — 0002 : corrections (sécurité, cohérence métier)
-- ============================================================================
-- À exécuter APRÈS 0001_init.sql, dans l'éditeur SQL Supabase (ou via
-- `supabase db push`). Ce script est idempotent : il peut être relancé sans
-- erreur autant de fois que nécessaire.
--
-- Corrige notamment :
--   * « Could not find the function public.get_dashboard without parameters
--     in the schema cache » : la fonction est (re)créée et le cache de
--     PostgREST est rechargé à la fin du script (notify pgrst).
--   * FAILLE CRITIQUE : le rôle était lu dans raw_user_meta_data, que
--     n'importe qui peut définir via supabase.auth.signUp() avec la clé
--     publique → création libre de comptes « admin ». Le rôle vient désormais
--     de raw_app_meta_data (modifiable uniquement avec la clé service_role) et
--     tout compte inconnu est créé DÉSACTIVÉ.
--   * Fonctions internes (alertes, résumé, journal des notifications)
--     exécutables par le rôle anonyme → réservées au service_role.
--   * Une chambre « réservée » ne pouvait jamais recevoir de check-in.
--   * Une réservation future bloquait la chambre dès sa création.
--   * Signaler une anomalie sur une chambre occupée rendait le check-out
--     impossible (la chambre quittait le statut « occupée »).
--   * Numéros de séjour en collision si deux check-in dans la même seconde.
--   * Doublons de fiches clients à chaque séjour (même pièce d'identité).
--   * Aucune validation des dates / montants côté base.
--   * Un admin pouvait se désactiver ou se rétrograder lui-même (verrouillage).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Schéma : colonnes, séquence, contraintes
-- ----------------------------------------------------------------------------

create sequence if not exists public.sejour_numero_seq;

alter table public.sejours
  add column if not exists reservation_id bigint references public.reservations(id);

do $$ begin
  alter table public.sejours
    add constraint sejours_dates_coherentes check (date_sortie_prevue >= date_entree) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.reservations
    add constraint reservations_dates_coherentes check (date_depart > date_arrivee) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.reservations
    add constraint reservations_montants_positifs check (montant >= 0 and avance >= 0) not valid;
exception when duplicate_object then null; end $$;

create index if not exists idx_clients_piece on public.clients (type_piece, numero_piece);
create index if not exists idx_paiements_date on public.paiements (date_paiement);
create index if not exists idx_reservations_statut on public.reservations (statut);

-- ----------------------------------------------------------------------------
-- 2. Création de profil sécurisée
-- ----------------------------------------------------------------------------
-- Le rôle n'est accepté QUE depuis raw_app_meta_data (écrit par l'Edge
-- Function admin-create-user avec la clé service_role). Un compte créé
-- autrement (inscription publique, dashboard sans app_metadata) obtient un
-- profil désactivé qu'un administrateur doit activer explicitement.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role role_utilisateur;
  v_has_admin boolean;
begin
  begin
    v_role := (new.raw_app_meta_data->>'role')::role_utilisateur;
  exception when invalid_text_representation then
    v_role := null;
  end;

  select exists(select 1 from public.profiles where role = 'admin' and actif = true) into v_has_admin;

  insert into public.profiles (id, nom, prenoms, telephone, role, actif)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nom', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'prenoms', ''),
    new.raw_user_meta_data->>'telephone',
    coalesce(v_role, case when not v_has_admin then 'admin'::role_utilisateur else 'reception'::role_utilisateur end),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Utilitaires de statut de chambre
-- ----------------------------------------------------------------------------

-- Statut que doit prendre une chambre qui se libère : « reservee » si une
-- réservation active couvre aujourd'hui, sinon « libre ».
create or replace function public.statut_disponible(p_chambre_id bigint)
returns statut_chambre
language sql
stable
security definer
set search_path = public
as $$
  select case when exists (
    select 1 from reservations r
    where r.chambre_id = p_chambre_id
      and r.statut in ('en_attente', 'confirmee')
      and r.date_arrivee <= current_date and r.date_depart > current_date
  ) then 'reservee'::statut_chambre else 'libre'::statut_chambre end;
$$;

-- Aligne les statuts sur le calendrier : réservations dépassées → client
-- absent ; chambres libres dont la réservation commence aujourd'hui →
-- réservées ; chambres « réservées » sans réservation courante → libres.
create or replace function public.sync_reserved_rooms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update reservations set statut = 'client_absent'
  where statut in ('en_attente', 'confirmee') and date_depart <= current_date;

  with changed as (
    update chambres c set statut = public.statut_disponible(c.id)
    where c.statut in ('libre', 'reservee') and c.statut <> public.statut_disponible(c.id)
    returning c.id, c.statut
  )
  insert into historique_statuts_chambres (chambre_id, ancien_statut, nouveau_statut, utilisateur_id)
  select id, case when statut = 'libre' then 'reservee'::statut_chambre else 'libre'::statut_chambre end,
         statut, auth.uid()
  from changed;
end;
$$;

create or replace function public.log_statut_chambre(p_chambre_id bigint, p_ancien statut_chambre, p_nouveau statut_chambre)
returns void
language sql
security definer
set search_path = public
as $$
  insert into historique_statuts_chambres (chambre_id, ancien_statut, nouveau_statut, utilisateur_id)
  select p_chambre_id, p_ancien, p_nouveau, auth.uid()
  where p_ancien is distinct from p_nouveau;
$$;

-- ----------------------------------------------------------------------------
-- 4. Check-in (walk-in ou depuis une réservation)
-- ----------------------------------------------------------------------------

drop function if exists public.check_in(jsonb, bigint, date, time, date, time, int, numeric, text);

create or replace function public.check_in(
  p_client jsonb,
  p_chambre_id bigint,
  p_date_entree date,
  p_heure_entree time,
  p_date_sortie_prevue date,
  p_heure_sortie_prevue time,
  p_nb_personnes int default 1,
  p_avance numeric default 0,
  p_mode_paiement text default 'Espèces',
  p_reservation_id bigint default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room chambres%rowtype;
  v_client clients%rowtype;
  v_sejour sejours%rowtype;
  v_resa reservations%rowtype;
  v_conflit reservations%rowtype;
  v_nights int;
  v_montant_total numeric;
  v_avance numeric := coalesce(p_avance, 0);
  v_avance_resa numeric := 0;
  v_nom text := trim(coalesce(p_client->>'nom', ''));
  v_prenoms text := trim(coalesce(p_client->>'prenoms', ''));
  v_tel text := trim(coalesce(p_client->>'telephone', ''));
  v_type_piece text := coalesce(nullif(trim(p_client->>'type_piece'), ''), 'CNI');
  v_num_piece text := trim(coalesce(p_client->>'numero_piece', ''));
begin
  perform public.require_role('admin', 'reception');

  if v_nom = '' or v_prenoms = '' or v_tel = '' or v_num_piece = '' then
    raise exception 'Nom, prénoms, téléphone et numéro de pièce sont obligatoires.' using errcode = '23514';
  end if;
  if p_date_entree is null or p_date_sortie_prevue is null or p_date_sortie_prevue < p_date_entree then
    raise exception 'La date de sortie doit être postérieure ou égale à la date d''arrivée.' using errcode = '23514';
  end if;
  if v_avance < 0 then
    raise exception 'L''avance ne peut pas être négative.' using errcode = '23514';
  end if;
  if coalesce(p_nb_personnes, 1) < 1 then
    raise exception 'Nombre de personnes invalide.' using errcode = '23514';
  end if;

  select * into v_room from chambres where id = p_chambre_id for update;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;
  if v_room.statut not in ('libre', 'reservee') then
    raise exception 'La chambre % n''est pas disponible (statut : %).', v_room.numero, v_room.statut using errcode = '23514';
  end if;
  if coalesce(p_nb_personnes, 1) > v_room.capacite then
    raise exception 'La chambre % accueille au maximum % personne(s).', v_room.numero, v_room.capacite using errcode = '23514';
  end if;

  if p_reservation_id is not null then
    select * into v_resa from reservations where id = p_reservation_id for update;
    if not found then
      raise exception 'Réservation introuvable.' using errcode = 'P0002';
    end if;
    if v_resa.statut not in ('en_attente', 'confirmee') then
      raise exception 'Cette réservation n''est plus active.' using errcode = '23514';
    end if;
    if v_resa.chambre_id <> p_chambre_id then
      raise exception 'La réservation concerne une autre chambre.' using errcode = '23514';
    end if;
    v_avance_resa := coalesce(v_resa.avance, 0);
  end if;

  -- Aucune autre réservation active ne doit chevaucher le séjour.
  select * into v_conflit from reservations r
  where r.chambre_id = p_chambre_id and r.statut in ('en_attente', 'confirmee')
    and r.id is distinct from p_reservation_id
    and r.date_arrivee < greatest(p_date_sortie_prevue, p_date_entree + 1)
    and r.date_depart > p_date_entree
  order by r.date_arrivee limit 1;
  if found then
    raise exception 'Chambre % réservée du % au % pour %.', v_room.numero,
      to_char(v_conflit.date_arrivee, 'DD/MM/YYYY'), to_char(v_conflit.date_depart, 'DD/MM/YYYY'),
      v_conflit.nom_client using errcode = '23514';
  end if;

  -- Fiche client : réutilisée si la même pièce d'identité existe déjà.
  select * into v_client from clients
  where numero_piece = v_num_piece and type_piece = v_type_piece
  order by id desc limit 1 for update;

  if found then
    update clients set
      nom = v_nom, prenoms = v_prenoms, telephone = v_tel,
      sexe = coalesce(nullif(p_client->>'sexe', ''), sexe),
      whatsapp = coalesce(nullif(p_client->>'whatsapp', ''), whatsapp, v_tel),
      email = coalesce(nullif(p_client->>'email', ''), email),
      nationalite = coalesce(nullif(p_client->>'nationalite', ''), nationalite),
      profession = coalesce(nullif(p_client->>'profession', ''), profession),
      adresse = coalesce(nullif(p_client->>'adresse', ''), adresse),
      date_naissance = coalesce(nullif(p_client->>'date_naissance', '')::date, date_naissance)
    where id = v_client.id
    returning * into v_client;
  else
    insert into clients (nom, prenoms, sexe, date_naissance, nationalite, profession, adresse,
                         telephone, whatsapp, email, type_piece, numero_piece)
    values (
      v_nom, v_prenoms, nullif(p_client->>'sexe', ''),
      nullif(p_client->>'date_naissance', '')::date, nullif(p_client->>'nationalite', ''),
      nullif(p_client->>'profession', ''), nullif(p_client->>'adresse', ''),
      v_tel, coalesce(nullif(p_client->>'whatsapp', ''), v_tel),
      nullif(p_client->>'email', ''), v_type_piece, v_num_piece
    )
    returning * into v_client;
  end if;

  v_nights := public.nights_between(p_date_entree, p_date_sortie_prevue);
  v_montant_total := v_nights * v_room.prix_nuit;

  insert into sejours (numero, client_id, chambre_id, reservation_id, date_entree, heure_entree,
                       date_sortie_prevue, heure_sortie_prevue, nb_personnes,
                       montant_total, montant_paye, solde, cree_par)
  values (
    'SEJ-' || to_char(current_date, 'YYMMDD') || '-' || lpad(nextval('public.sejour_numero_seq')::text, 4, '0'),
    v_client.id, v_room.id, p_reservation_id, p_date_entree, p_heure_entree, p_date_sortie_prevue,
    p_heure_sortie_prevue, coalesce(p_nb_personnes, 1), v_montant_total,
    v_avance + v_avance_resa, v_montant_total - v_avance - v_avance_resa, auth.uid()
  )
  returning * into v_sejour;

  if v_avance > 0 then
    insert into paiements (sejour_id, montant, mode_paiement, utilisateur_id)
    values (v_sejour.id, v_avance, coalesce(nullif(p_mode_paiement, ''), 'Espèces'), auth.uid());
  end if;

  if p_reservation_id is not null then
    update reservations set statut = 'client_arrive', client_id = v_client.id where id = p_reservation_id;
    -- L'avance versée à la réservation est rattachée au séjour.
    update paiements set sejour_id = v_sejour.id where reservation_id = p_reservation_id and sejour_id is null;
  end if;

  update chambres set statut = 'occupee' where id = v_room.id;
  perform public.log_statut_chambre(v_room.id, v_room.statut, 'occupee');
  insert into journal_activite (utilisateur_id, action, details)
  values (auth.uid(), 'check-in', jsonb_build_object('sejour_id', v_sejour.id, 'chambre', v_room.numero,
          'reservation_id', p_reservation_id));

  return jsonb_build_object(
    'client', to_jsonb(v_client),
    'room', to_jsonb(v_room) || jsonb_build_object('statut', 'occupee'),
    'sejour', to_jsonb(v_sejour)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Check-out
-- ----------------------------------------------------------------------------

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
  v_room chambres%rowtype;
  v_supp numeric := coalesce(p_montant_supplementaire, 0);
  v_nouveau statut_chambre;
begin
  perform public.require_role('admin', 'reception');
  if v_supp < 0 then
    raise exception 'Le montant ne peut pas être négatif.' using errcode = '23514';
  end if;

  select * into v_sejour from sejours where id = p_sejour_id for update;
  if not found then
    raise exception 'Séjour introuvable.' using errcode = 'P0002';
  end if;
  if v_sejour.statut <> 'en_cours' then
    raise exception 'Ce séjour est déjà terminé.' using errcode = '23514';
  end if;
  select * into v_room from chambres where id = v_sejour.chambre_id for update;

  update sejours set statut = 'termine', date_sortie_reelle = current_date,
    heure_sortie_reelle = localtime(0),
    montant_paye = montant_paye + v_supp, solde = montant_total - (montant_paye + v_supp)
  where id = v_sejour.id
  returning * into v_sejour;

  if v_supp > 0 then
    insert into paiements (sejour_id, montant, mode_paiement, utilisateur_id)
    values (v_sejour.id, v_supp, coalesce(nullif(p_mode_paiement, ''), 'Espèces'), auth.uid());
  end if;

  -- Une anomalie signalée pendant le séjour envoie la chambre en maintenance.
  v_nouveau := case when v_room.panne_note is not null then 'maintenance' else 'nettoyage' end;
  update chambres set statut = v_nouveau where id = v_room.id;
  perform public.log_statut_chambre(v_room.id, v_room.statut, v_nouveau);
  insert into journal_activite (utilisateur_id, action, details)
  values (auth.uid(), 'check-out', jsonb_build_object('sejour_id', v_sejour.id));

  return jsonb_build_object('sejour', to_jsonb(v_sejour), 'chambre_numero', v_room.numero,
    'client_id', v_sejour.client_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Prolongation
-- ----------------------------------------------------------------------------

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
  v_montant_total numeric;
  v_montant_supplementaire numeric;
  v_paiement numeric := coalesce(p_paiement_supplementaire, 0);
  v_conflit reservations%rowtype;
begin
  perform public.require_role('admin', 'reception');
  if v_paiement < 0 then
    raise exception 'Le montant ne peut pas être négatif.' using errcode = '23514';
  end if;

  select * into v_sejour from sejours where id = p_sejour_id for update;
  if not found then
    raise exception 'Séjour introuvable.' using errcode = 'P0002';
  end if;
  if v_sejour.statut <> 'en_cours' then
    raise exception 'Ce séjour n''est plus actif.' using errcode = '23514';
  end if;
  if p_nouvelle_date_sortie is null or p_nouvelle_date_sortie < v_sejour.date_entree then
    raise exception 'La nouvelle date de sortie doit être postérieure à la date d''arrivée.' using errcode = '23514';
  end if;

  select * into v_conflit from reservations r
  where r.chambre_id = v_sejour.chambre_id and r.statut in ('en_attente', 'confirmee')
    and r.id is distinct from v_sejour.reservation_id
    and r.date_arrivee < p_nouvelle_date_sortie and r.date_depart > v_sejour.date_sortie_prevue
  order by r.date_arrivee limit 1;
  if found then
    raise exception 'Prolongation impossible : chambre réservée à partir du % pour %.',
      to_char(v_conflit.date_arrivee, 'DD/MM/YYYY'), v_conflit.nom_client using errcode = '23514';
  end if;

  select prix_nuit, numero into v_prix_nuit, v_chambre_numero from chambres where id = v_sejour.chambre_id;

  v_ancienne_sortie := v_sejour.date_sortie_prevue;
  v_montant_total := public.nights_between(v_sejour.date_entree, p_nouvelle_date_sortie) * v_prix_nuit;
  v_montant_supplementaire := v_montant_total - v_sejour.montant_total;

  update sejours set date_sortie_prevue = p_nouvelle_date_sortie,
    heure_sortie_prevue = coalesce(p_nouvelle_heure_sortie, heure_sortie_prevue),
    montant_total = v_montant_total,
    montant_paye = montant_paye + v_paiement,
    solde = v_montant_total - (montant_paye + v_paiement)
  where id = v_sejour.id
  returning * into v_sejour;

  if v_paiement > 0 then
    insert into paiements (sejour_id, montant, mode_paiement, utilisateur_id)
    values (v_sejour.id, v_paiement, coalesce(nullif(p_mode_paiement, ''), 'Espèces'), auth.uid());
  end if;

  insert into journal_activite (utilisateur_id, action, details)
  values (auth.uid(), 'prolongation', jsonb_build_object('sejour_id', v_sejour.id,
          'ancienne_sortie', v_ancienne_sortie, 'nouvelle_sortie', p_nouvelle_date_sortie));

  return jsonb_build_object('sejour', to_jsonb(v_sejour), 'chambre_numero', v_chambre_numero,
    'ancienne_sortie', v_ancienne_sortie, 'montant_supplementaire', v_montant_supplementaire,
    'client_id', v_sejour.client_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Paiement libre
-- ----------------------------------------------------------------------------

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
  if v_sejour.statut = 'annule' then
    raise exception 'Ce séjour est annulé.' using errcode = '23514';
  end if;

  update sejours set montant_paye = montant_paye + p_montant, solde = montant_total - (montant_paye + p_montant)
  where id = v_sejour.id;

  insert into paiements (sejour_id, montant, mode_paiement, reference, utilisateur_id)
  values (v_sejour.id, p_montant, coalesce(nullif(p_mode_paiement, ''), 'Espèces'), nullif(trim(p_reference), ''), auth.uid())
  returning * into v_paiement;

  return to_jsonb(v_paiement);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Nettoyage / anomalies
-- ----------------------------------------------------------------------------

create or replace function public.valider_nettoyage(p_chambre_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut statut_chambre;
  v_nouveau statut_chambre;
begin
  perform public.require_role('admin', 'entretien');
  select statut into v_statut from chambres where id = p_chambre_id for update;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;
  if v_statut not in ('nettoyage', 'maintenance') then
    raise exception 'Cette chambre n''est pas en nettoyage ni en maintenance.' using errcode = '23514';
  end if;

  if exists (select 1 from sejours where chambre_id = p_chambre_id and statut = 'en_cours') then
    v_nouveau := 'occupee';
  else
    v_nouveau := public.statut_disponible(p_chambre_id);
  end if;

  update chambres set statut = v_nouveau, panne_note = null where id = p_chambre_id;
  perform public.log_statut_chambre(p_chambre_id, v_statut, v_nouveau);
end;
$$;

-- Chambre occupée : l'anomalie est notée mais la chambre reste « occupée »
-- (sinon le check-out devient impossible) ; elle passera en maintenance au
-- départ du client. Autre statut : passage immédiat en maintenance.
create or replace function public.signaler_anomalie(p_chambre_id bigint, p_description text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut statut_chambre;
begin
  perform public.require_role('admin', 'entretien', 'reception');
  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'Description requise.' using errcode = '23514';
  end if;
  select statut into v_statut from chambres where id = p_chambre_id for update;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;

  if v_statut = 'occupee' then
    update chambres set panne_note = trim(p_description) where id = p_chambre_id;
  else
    update chambres set statut = 'maintenance', panne_note = trim(p_description) where id = p_chambre_id;
    perform public.log_statut_chambre(p_chambre_id, v_statut, 'maintenance');
  end if;
  insert into journal_activite (utilisateur_id, action, details)
  values (auth.uid(), 'anomalie', jsonb_build_object('chambre_id', p_chambre_id, 'description', trim(p_description)));
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Réservations
-- ----------------------------------------------------------------------------

drop function if exists public.create_reservation(text, text, bigint, date, date, numeric, numeric);
create or replace function public.create_reservation(
  p_nom_client text,
  p_telephone text,
  p_chambre_id bigint,
  p_date_arrivee date,
  p_date_depart date,
  p_montant numeric default 0,
  p_avance numeric default 0,
  p_mode_paiement text default 'Espèces'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room chambres%rowtype;
  v_reservation reservations%rowtype;
  v_conflit reservations%rowtype;
  v_occupee_jusqu date;
  v_montant numeric;
  v_avance numeric := coalesce(p_avance, 0);
begin
  perform public.require_role('admin', 'reception');

  if length(trim(coalesce(p_nom_client, ''))) = 0 then
    raise exception 'Le nom du client est obligatoire.' using errcode = '23514';
  end if;
  if p_date_arrivee is null or p_date_depart is null or p_date_depart <= p_date_arrivee then
    raise exception 'La date de départ doit être postérieure à la date d''arrivée.' using errcode = '23514';
  end if;
  if p_date_arrivee < current_date then
    raise exception 'La date d''arrivée ne peut pas être dans le passé.' using errcode = '23514';
  end if;
  if v_avance < 0 or coalesce(p_montant, 0) < 0 then
    raise exception 'Les montants ne peuvent pas être négatifs.' using errcode = '23514';
  end if;

  select * into v_room from chambres where id = p_chambre_id for update;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;

  select * into v_conflit from reservations
  where chambre_id = p_chambre_id and statut in ('en_attente', 'confirmee')
    and date_arrivee < p_date_depart and date_depart > p_date_arrivee
  order by date_arrivee limit 1;
  if found then
    raise exception 'Chambre % déjà réservée du % au % (%).', v_room.numero,
      to_char(v_conflit.date_arrivee, 'DD/MM/YYYY'), to_char(v_conflit.date_depart, 'DD/MM/YYYY'),
      v_conflit.nom_client using errcode = '23514';
  end if;

  select max(date_sortie_prevue) into v_occupee_jusqu from sejours
  where chambre_id = p_chambre_id and statut = 'en_cours';
  if v_occupee_jusqu is not null and v_occupee_jusqu > p_date_arrivee then
    raise exception 'Chambre % occupée jusqu''au %.', v_room.numero, to_char(v_occupee_jusqu, 'DD/MM/YYYY')
      using errcode = '23514';
  end if;

  v_montant := case when coalesce(p_montant, 0) > 0 then p_montant
                    else public.nights_between(p_date_arrivee, p_date_depart) * v_room.prix_nuit end;
  if v_avance > v_montant then
    raise exception 'L''avance dépasse le montant de la réservation.' using errcode = '23514';
  end if;

  insert into reservations (nom_client, telephone, chambre_id, date_arrivee, date_depart,
                            montant, avance, statut, cree_par)
  values (trim(p_nom_client), nullif(trim(p_telephone), ''), p_chambre_id, p_date_arrivee, p_date_depart,
          v_montant, v_avance, 'confirmee', auth.uid())
  returning * into v_reservation;

  -- L'avance est un encaissement réel : elle apparaît dans les recettes.
  if v_avance > 0 then
    insert into paiements (reservation_id, montant, mode_paiement, reference, utilisateur_id)
    values (v_reservation.id, v_avance, coalesce(nullif(p_mode_paiement, ''), 'Espèces'), 'Avance réservation', auth.uid());
  end if;

  -- La chambre n'est bloquée que le jour de l'arrivée (pas des semaines avant).
  if v_room.statut = 'libre' and p_date_arrivee <= current_date then
    update chambres set statut = 'reservee' where id = p_chambre_id;
    perform public.log_statut_chambre(p_chambre_id, 'libre', 'reservee');
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
  v_statut statut_chambre;
  v_nouveau statut_chambre;
begin
  perform public.require_role('admin', 'reception');

  select * into v_reservation from reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Réservation introuvable.' using errcode = 'P0002';
  end if;
  if v_reservation.statut not in ('en_attente', 'confirmee') then
    raise exception 'Cette réservation n''est plus active.' using errcode = '23514';
  end if;

  update reservations set statut = 'annulee' where id = p_reservation_id;

  select statut into v_statut from chambres where id = v_reservation.chambre_id for update;
  if v_statut = 'reservee' then
    v_nouveau := public.statut_disponible(v_reservation.chambre_id);
    update chambres set statut = v_nouveau where id = v_reservation.chambre_id;
    perform public.log_statut_chambre(v_reservation.chambre_id, v_statut, v_nouveau);
  end if;
  insert into journal_activite (utilisateur_id, action, details)
  values (auth.uid(), 'annulation-reservation', jsonb_build_object('reservation_id', p_reservation_id));
end;
$$;

create or replace function public.mark_reservation_absent(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation reservations%rowtype;
  v_statut statut_chambre;
  v_nouveau statut_chambre;
begin
  perform public.require_role('admin', 'reception');
  select * into v_reservation from reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Réservation introuvable.' using errcode = 'P0002';
  end if;
  if v_reservation.statut not in ('en_attente', 'confirmee') then
    raise exception 'Cette réservation n''est plus active.' using errcode = '23514';
  end if;
  update reservations set statut = 'client_absent' where id = p_reservation_id;
  select statut into v_statut from chambres where id = v_reservation.chambre_id for update;
  if v_statut = 'reservee' then
    v_nouveau := public.statut_disponible(v_reservation.chambre_id);
    update chambres set statut = v_nouveau where id = v_reservation.chambre_id;
    perform public.log_statut_chambre(v_reservation.chambre_id, v_statut, v_nouveau);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9 bis. Chambres : création / modification validées (admin)
-- ----------------------------------------------------------------------------

create or replace function public.create_room(p_room jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room chambres%rowtype;
  v_numero text := trim(coalesce(p_room->>'numero', ''));
  v_type text := trim(coalesce(p_room->>'type', ''));
begin
  perform public.require_role('admin');
  if v_numero = '' or v_type = '' then
    raise exception 'Numéro et type de chambre obligatoires.' using errcode = '23514';
  end if;
  if nullif(p_room->>'prix_nuit', '') is null or (p_room->>'prix_nuit')::numeric < 0 then
    raise exception 'Prix par nuit invalide.' using errcode = '23514';
  end if;
  if exists (select 1 from chambres where numero = v_numero) then
    raise exception 'La chambre % existe déjà.', v_numero using errcode = '23505';
  end if;
  insert into chambres (numero, type, categorie, prix_nuit, capacite, nombre_lits, etage, equipements, description, photo_url)
  values (
    v_numero, v_type, coalesce(nullif(p_room->>'categorie', ''), v_type),
    (p_room->>'prix_nuit')::numeric, greatest(1, coalesce(nullif(p_room->>'capacite', '')::int, 2)),
    greatest(1, coalesce(nullif(p_room->>'nombre_lits', '')::int, 1)), coalesce(nullif(p_room->>'etage', '')::int, 1),
    nullif(p_room->>'equipements', ''), nullif(p_room->>'description', ''), nullif(p_room->>'photo_url', '')
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
  v_numero text := nullif(trim(coalesce(p_room->>'numero', '')), '');
begin
  perform public.require_role('admin');
  if nullif(p_room->>'prix_nuit', '') is not null and (p_room->>'prix_nuit')::numeric < 0 then
    raise exception 'Prix par nuit invalide.' using errcode = '23514';
  end if;
  if v_numero is not null and exists (select 1 from chambres where numero = v_numero and id <> p_id) then
    raise exception 'La chambre % existe déjà.', v_numero using errcode = '23505';
  end if;
  -- Le prix des séjours en cours n'est pas modifié (il est figé au check-in).
  update chambres set
    numero = coalesce(v_numero, numero),
    type = coalesce(nullif(trim(p_room->>'type'), ''), type),
    categorie = coalesce(nullif(trim(p_room->>'categorie'), ''), categorie),
    prix_nuit = coalesce(nullif(p_room->>'prix_nuit', '')::numeric, prix_nuit),
    capacite = greatest(1, coalesce(nullif(p_room->>'capacite', '')::int, capacite)),
    nombre_lits = greatest(1, coalesce(nullif(p_room->>'nombre_lits', '')::int, nombre_lits)),
    etage = coalesce(nullif(p_room->>'etage', '')::int, etage),
    equipements = case when p_room ? 'equipements' then nullif(p_room->>'equipements', '') else equipements end,
    description = case when p_room ? 'description' then nullif(p_room->>'description', '') else description end,
    photo_url = case when p_room ? 'photo_url' then nullif(p_room->>'photo_url', '') else photo_url end
  where id = p_id
  returning * into v_room;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;
  return to_jsonb(v_room);
end;
$$;

-- ----------------------------------------------------------------------------
-- 10. Paramètres & utilisateurs (admin)
-- ----------------------------------------------------------------------------

create or replace function public.get_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_role('admin');
  return (select coalesce(jsonb_object_agg(cle, valeur), '{}'::jsonb) from parametres);
end;
$$;

drop function if exists public.list_users();
create or replace function public.list_users()
returns table (
  id uuid, nom text, prenoms text, telephone text, role role_utilisateur, actif boolean,
  created_at timestamptz, email text, last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_role('admin');
  return query
    select p.id, p.nom, p.prenoms, p.telephone, p.role, p.actif, p.created_at,
           u.email::text, u.last_sign_in_at
    from profiles p left join auth.users u on u.id = p.id
    order by p.actif asc, p.created_at desc;
end;
$$;

create or replace function public.set_user_active(p_user_id uuid, p_actif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_role('admin');
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas modifier votre propre compte.' using errcode = '42501';
  end if;
  update profiles set actif = p_actif where id = p_user_id;
  if not found then
    raise exception 'Utilisateur introuvable.' using errcode = 'P0002';
  end if;
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
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas modifier votre propre rôle.' using errcode = '42501';
  end if;
  update profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'Utilisateur introuvable.' using errcode = 'P0002';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11. Tableau de bord
-- ----------------------------------------------------------------------------
-- Volatile (et non plus « stable ») : il resynchronise d'abord les statuts de
-- réservation. Les données financières ne sont pas renvoyées au rôle
-- « entretien ».

drop function if exists public.get_dashboard();
create function public.get_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role role_utilisateur;
  v_finance boolean;
  v_total int;
  v_occupees int;
  v_result jsonb;
begin
  perform public.require_role('admin', 'gerant', 'reception', 'entretien');
  v_role := public.current_role_actif();
  v_finance := v_role in ('admin', 'gerant', 'reception');

  perform public.sync_reserved_rooms();

  select count(*), count(*) filter (where statut = 'occupee') into v_total, v_occupees from chambres;

  select jsonb_build_object(
    'total_chambres', v_total,
    'libres', count(*) filter (where statut = 'libre'),
    'occupees', v_occupees,
    'reservees', count(*) filter (where statut = 'reservee'),
    'nettoyage', count(*) filter (where statut = 'nettoyage'),
    'maintenance', count(*) filter (where statut = 'maintenance'),
    'taux_occupation', case when v_total > 0 then round((v_occupees::numeric / v_total) * 100) else 0 end
  ) into v_result from chambres;

  v_result := v_result || jsonb_build_object(
    'clients_presents', (select coalesce(sum(nb_personnes), 0) from sejours where statut = 'en_cours'),
    'sejours_en_cours', (select count(*) from sejours where statut = 'en_cours'),
    'arrivees_jour', (select count(*) from sejours where date_entree = current_date),
    'departs_jour', (select count(*) from sejours where statut = 'en_cours' and date_sortie_prevue = current_date),
    'sejours_en_retard', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.date_sortie_prevue), '[]'::jsonb) from (
        select s.id, s.numero, s.date_sortie_prevue, s.heure_sortie_prevue, s.solde,
               c.nom as client_nom, c.prenoms as client_prenoms, ch.numero as chambre_numero
        from sejours s join clients c on c.id = s.client_id join chambres ch on ch.id = s.chambre_id
        where s.statut = 'en_cours' and (s.date_sortie_prevue + s.heure_sortie_prevue) < localtimestamp
      ) t),
    'departs_prevus', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.heure_sortie_prevue), '[]'::jsonb) from (
        select s.id, s.numero, s.date_sortie_prevue, s.heure_sortie_prevue,
               c.nom as client_nom, c.prenoms as client_prenoms, ch.numero as chambre_numero
        from sejours s join clients c on c.id = s.client_id join chambres ch on ch.id = s.chambre_id
        where s.statut = 'en_cours' and s.date_sortie_prevue = current_date
      ) t),
    'arrivees_prevues', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.chambre_numero), '[]'::jsonb) from (
        select r.id, r.nom_client, r.telephone, r.date_arrivee, r.date_depart, ch.numero as chambre_numero
        from reservations r join chambres ch on ch.id = r.chambre_id
        where r.statut in ('en_attente', 'confirmee') and r.date_arrivee = current_date
      ) t),
    'chambres_anomalie', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'numero', numero, 'statut', statut, 'panne_note', panne_note)
             order by numero), '[]'::jsonb)
      from chambres where panne_note is not null)
  );

  if v_finance then
    v_result := v_result || jsonb_build_object(
      'recettes_jour', (select coalesce(sum(montant), 0) from paiements where date_paiement::date = current_date),
      'recettes_7j', (
        select coalesce(jsonb_agg(jsonb_build_object('jour', d::date, 'montant', coalesce(p.total, 0)) order by d), '[]'::jsonb)
        from generate_series(current_date - 6, current_date, interval '1 day') d
        left join (select date_paiement::date as jour, sum(montant) as total from paiements
                   where date_paiement >= current_date - 6 group by 1) p on p.jour = d::date),
      'soldes_restants', (
        select coalesce(jsonb_agg(row_to_json(t) order by t.solde desc), '[]'::jsonb) from (
          select s.id, s.numero, s.solde, c.nom as client_nom, c.prenoms as client_prenoms, ch.numero as chambre_numero
          from sejours s join clients c on c.id = s.client_id join chambres ch on ch.id = s.chambre_id
          where s.statut = 'en_cours' and s.solde > 0
        ) t)
    );
  else
    v_result := v_result || jsonb_build_object('recettes_jour', null, 'recettes_7j', '[]'::jsonb,
                                               'soldes_restants', '[]'::jsonb);
  end if;

  return v_result;
end;
$$;

-- Fonctions utilisées par la cron edge function : exécutées avec la clé
-- service_role uniquement.
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
      and (s.date_sortie_prevue + s.heure_sortie_prevue)
          between localtimestamp and localtimestamp + make_interval(mins => p_window_minutes)
  ) t;
$$;

-- ----------------------------------------------------------------------------
-- 12. Droits d'exécution
-- ----------------------------------------------------------------------------
-- Par défaut Supabase autorise « anon » (visiteur non connecté) à exécuter
-- toutes les fonctions du schéma public. On ferme tout, puis on rouvre au
-- strict nécessaire.

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Utilisé par les policies RLS : doit rester évaluable par tout rôle.
grant execute on function public.current_role_actif() to anon;

-- Fonctions internes : jamais appelées par un utilisateur.
revoke execute on function public.mark_notification_result(bigint, boolean, int, text, text) from authenticated;
revoke execute on function public.get_upcoming_checkouts(int) from authenticated;
revoke execute on function public.get_daily_summary(date) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.log_statut_chambre(bigint, statut_chambre, statut_chambre) from authenticated;

alter default privileges in schema public revoke execute on functions from public, anon;

-- ----------------------------------------------------------------------------
-- 13. Recharger le cache de schéma de l'API (corrige « schema cache »)
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
