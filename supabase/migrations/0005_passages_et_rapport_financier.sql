-- ============================================================================
-- Migration 0005 : Module Passages (2000 FCFA/h ventilée, 2500 FCFA/h climatisée)
--                  & Rapport financier mensuel
-- ============================================================================
-- À exécuter dans l'éditeur SQL de votre projet Supabase (SQL Editor → Run).
-- Ce script est idempotent (peut être relancé sans erreur).
-- ============================================================================

-- 1. Colonnes de climatisation et tarif horaire sur les chambres
alter table public.chambres
  add column if not exists climatisation text not null default 'climatisee',
  add column if not exists prix_passage_heure numeric(12,2) not null default 2500;

do $$ begin
  alter table public.chambres
    add constraint chambres_climatisation_check check (climatisation in ('ventilee', 'climatisee')) not valid;
exception when duplicate_object then null; end $$;

-- Initialiser selon le type ou les équipements existants
update public.chambres
set climatisation = case
      when (coalesce(type, '') || ' ' || coalesce(categorie, '') || ' ' || coalesce(equipements, '')) ilike '%ventil%'
       and (coalesce(type, '') || ' ' || coalesce(categorie, '') || ' ' || coalesce(equipements, '')) not ilike '%clim%'
      then 'ventilee'
      else 'climatisee'
    end,
    prix_passage_heure = case
      when (coalesce(type, '') || ' ' || coalesce(categorie, '') || ' ' || coalesce(equipements, '')) ilike '%ventil%'
       and (coalesce(type, '') || ' ' || coalesce(categorie, '') || ' ' || coalesce(equipements, '')) not ilike '%clim%'
      then 2000
      else 2500
    end;

-- 2. Colonnes de passage sur les séjours
alter table public.sejours
  add column if not exists type_sejour text not null default 'nuitee',
  add column if not exists type_climatisation text,
  add column if not exists duree_heures integer,
  add column if not exists tarif_horaire numeric(12,2);

do $$ begin
  alter table public.sejours
    add constraint sejours_type_sejour_check check (type_sejour in ('nuitee', 'passage')) not valid;
exception when duplicate_object then null; end $$;

create index if not exists idx_sejours_type_sejour on public.sejours (type_sejour);

-- 3. Mise à jour de create_room et update_room pour gérer climatisation / prix_passage_heure
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
  v_clim text := coalesce(nullif(trim(p_room->>'climatisation'), ''),
    case when v_type ilike '%ventil%' then 'ventilee' else 'climatisee' end);
  v_prix_heure numeric;
begin
  perform public.require_role('admin', 'gerant', 'reception');
  if v_numero = '' or v_type = '' then
    raise exception 'Numéro et type de chambre obligatoires.' using errcode = '23514';
  end if;
  if nullif(p_room->>'prix_nuit', '') is null or (p_room->>'prix_nuit')::numeric < 0 then
    raise exception 'Prix par nuit invalide.' using errcode = '23514';
  end if;
  if exists (select 1 from chambres where numero = v_numero) then
    raise exception 'La chambre % existe déjà.', v_numero using errcode = '23505';
  end if;
  if v_clim not in ('ventilee', 'climatisee') then
    v_clim := 'climatisee';
  end if;
  v_prix_heure := case when v_clim = 'ventilee' then 2000 else 2500 end;

  insert into chambres (numero, type, categorie, prix_nuit, capacite, nombre_lits, etage, equipements, description, photo_url, climatisation, prix_passage_heure)
  values (
    v_numero, v_type, coalesce(nullif(p_room->>'categorie', ''), v_type),
    (p_room->>'prix_nuit')::numeric, greatest(1, coalesce(nullif(p_room->>'capacite', '')::int, 2)),
    greatest(1, coalesce(nullif(p_room->>'nombre_lits', '')::int, 1)), coalesce(nullif(p_room->>'etage', '')::int, 1),
    nullif(p_room->>'equipements', ''), nullif(p_room->>'description', ''), nullif(p_room->>'photo_url', ''),
    v_clim, v_prix_heure
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
  v_clim text := nullif(trim(coalesce(p_room->>'climatisation', '')), '');
begin
  perform public.require_role('admin', 'gerant', 'reception');
  if nullif(p_room->>'prix_nuit', '') is not null and (p_room->>'prix_nuit')::numeric < 0 then
    raise exception 'Prix par nuit invalide.' using errcode = '23514';
  end if;
  if v_numero is not null and exists (select 1 from chambres where numero = v_numero and id <> p_id) then
    raise exception 'La chambre % existe déjà.', v_numero using errcode = '23505';
  end if;
  if v_clim is not null and v_clim not in ('ventilee', 'climatisee') then
    v_clim := null;
  end if;

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
    photo_url = case when p_room ? 'photo_url' then nullif(p_room->>'photo_url', '') else photo_url end,
    climatisation = coalesce(v_clim, climatisation),
    prix_passage_heure = case
      when coalesce(v_clim, climatisation) = 'ventilee' then 2000
      else 2500
    end
  where id = p_id
  returning * into v_room;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;
  return to_jsonb(v_room);
end;
$$;

-- 4. Enregistrement d'un passage à l'heure
--    2 000 FCFA / heure pour chambre ventilée
--    2 500 FCFA / heure pour chambre climatisée
create or replace function public.create_passage(
  p_chambre_id bigint,
  p_type_climatisation text default 'climatisee',
  p_duree_heures int default 1,
  p_date_entree date default current_date,
  p_heure_entree time default localtime(0),
  p_nb_personnes int default 1,
  p_montant_paye numeric default null,
  p_mode_paiement text default 'Espèces',
  p_client jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room chambres%rowtype;
  v_client clients%rowtype;
  v_sejour sejours%rowtype;
  v_clim text := case when lower(coalesce(p_type_climatisation, '')) = 'ventilee' then 'ventilee' else 'climatisee' end;
  v_tarif numeric := case when lower(coalesce(p_type_climatisation, '')) = 'ventilee' then 2000 else 2500 end;
  v_heures int := greatest(1, coalesce(p_duree_heures, 1));
  v_montant_total numeric;
  v_paye numeric;
  v_date_entree date := coalesce(p_date_entree, current_date);
  v_heure_entree time := coalesce(p_heure_entree, localtime(0));
  v_sortie_ts timestamp;
  v_nom text := coalesce(nullif(trim(p_client->>'nom'), ''), 'Client');
  v_prenoms text := coalesce(nullif(trim(p_client->>'prenoms'), ''), 'de passage');
  v_tel text := coalesce(nullif(trim(p_client->>'telephone'), ''), '-');
  v_type_piece text := coalesce(nullif(trim(p_client->>'type_piece'), ''), 'Autre');
  v_num_piece text := coalesce(nullif(trim(p_client->>'numero_piece'), ''), 'PASSAGE');
begin
  perform public.require_role('admin', 'gerant', 'reception');

  select * into v_room from chambres where id = p_chambre_id for update;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;
  if v_room.statut not in ('libre', 'reservee') then
    raise exception 'La chambre % n''est pas disponible (statut : %).', v_room.numero, v_room.statut using errcode = '23514';
  end if;

  -- Si une vraie pièce est fournie ou si le client générique existe déjà, on réutilise ou crée
  if v_num_piece <> 'PASSAGE' then
    select * into v_client from clients
    where numero_piece = v_num_piece and type_piece = v_type_piece
    order by id desc limit 1 for update;
  else
    select * into v_client from clients
    where numero_piece = 'PASSAGE' and nom = v_nom and prenoms = v_prenoms
    order by id desc limit 1;
  end if;

  if not found or v_client.id is null then
    insert into clients (nom, prenoms, sexe, telephone, whatsapp, type_piece, numero_piece)
    values (v_nom, v_prenoms, coalesce(nullif(p_client->>'sexe', ''), 'M'), v_tel, v_tel, v_type_piece, v_num_piece)
    returning * into v_client;
  end if;

  v_montant_total := v_heures * v_tarif;
  v_paye := greatest(0, coalesce(p_montant_paye, v_montant_total));
  v_sortie_ts := (v_date_entree + v_heure_entree) + make_interval(hours => v_heures);

  insert into sejours (
    numero, client_id, chambre_id, date_entree, heure_entree,
    date_sortie_prevue, heure_sortie_prevue, nb_personnes, statut,
    montant_total, montant_paye, solde, cree_par,
    type_sejour, type_climatisation, duree_heures, tarif_horaire
  )
  values (
    'PAS-' || to_char(current_date, 'YYMMDD') || '-' || lpad(nextval('public.sejour_numero_seq')::text, 4, '0'),
    v_client.id, v_room.id, v_date_entree, v_heure_entree,
    v_sortie_ts::date, v_sortie_ts::time(0), greatest(1, coalesce(p_nb_personnes, 1)), 'en_cours',
    v_montant_total, v_paye, v_montant_total - v_paye, auth.uid(),
    'passage', v_clim, v_heures, v_tarif
  )
  returning * into v_sejour;

  if v_paye > 0 then
    insert into paiements (sejour_id, montant, mode_paiement, reference, utilisateur_id)
    values (
      v_sejour.id,
      v_paye,
      coalesce(nullif(p_mode_paiement, ''), 'Espèces'),
      'Passage ' || v_heures || 'h (' || case when v_clim = 'ventilee' then 'Ventilée' else 'Climatisée' end || ')',
      auth.uid()
    );
  end if;

  update chambres set statut = 'occupee' where id = v_room.id;
  perform public.log_statut_chambre(v_room.id, v_room.statut, 'occupee');
  insert into journal_activite (utilisateur_id, action, details)
  values (auth.uid(), 'passage', jsonb_build_object(
    'sejour_id', v_sejour.id,
    'chambre', v_room.numero,
    'type_climatisation', v_clim,
    'duree_heures', v_heures,
    'tarif_horaire', v_tarif
  ));

  return jsonb_build_object(
    'client', to_jsonb(v_client),
    'room', to_jsonb(v_room) || jsonb_build_object('statut', 'occupee'),
    'sejour', to_jsonb(v_sejour)
  );
end;
$$;

-- 5. Prolongation d'un passage en heures
create or replace function public.extend_passage(
  p_sejour_id bigint,
  p_heures_supplementaires int default 1,
  p_paiement_supplementaire numeric default 0,
  p_mode_paiement text default 'Espèces'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sejour sejours%rowtype;
  v_chambre_numero text;
  v_heures_supp int := greatest(1, coalesce(p_heures_supplementaires, 1));
  v_tarif numeric;
  v_nouvelle_duree int;
  v_montant_supp numeric;
  v_nouveau_total numeric;
  v_paiement numeric := greatest(0, coalesce(p_paiement_supplementaire, 0));
  v_sortie_ts timestamp;
begin
  perform public.require_role('admin', 'gerant', 'reception');

  select * into v_sejour from sejours where id = p_sejour_id for update;
  if not found then
    raise exception 'Passage introuvable.' using errcode = 'P0002';
  end if;
  if v_sejour.statut <> 'en_cours' then
    raise exception 'Ce passage est déjà terminé.' using errcode = '23514';
  end if;

  select numero into v_chambre_numero from chambres where id = v_sejour.chambre_id;
  v_tarif := coalesce(v_sejour.tarif_horaire, case when v_sejour.type_climatisation = 'ventilee' then 2000 else 2500 end);
  v_nouvelle_duree := coalesce(v_sejour.duree_heures, 1) + v_heures_supp;
  v_montant_supp := v_heures_supp * v_tarif;
  v_nouveau_total := v_sejour.montant_total + v_montant_supp;
  v_sortie_ts := (v_sejour.date_sortie_prevue + v_sejour.heure_sortie_prevue) + make_interval(hours => v_heures_supp);

  update sejours set
    duree_heures = v_nouvelle_duree,
    date_sortie_prevue = v_sortie_ts::date,
    heure_sortie_prevue = v_sortie_ts::time(0),
    montant_total = v_nouveau_total,
    montant_paye = montant_paye + v_paiement,
    solde = v_nouveau_total - (montant_paye + v_paiement)
  where id = v_sejour.id
  returning * into v_sejour;

  if v_paiement > 0 then
    insert into paiements (sejour_id, montant, mode_paiement, reference, utilisateur_id)
    values (
      v_sejour.id,
      v_paiement,
      coalesce(nullif(p_mode_paiement, ''), 'Espèces'),
      'Prolongation passage +' || v_heures_supp || 'h',
      auth.uid()
    );
  end if;

  return jsonb_build_object(
    'sejour', to_jsonb(v_sejour),
    'chambre_numero', v_chambre_numero,
    'montant_supplementaire', v_montant_supp
  );
end;
$$;

-- 6. Modification et suppression d'un passage
create or replace function public.update_passage(
  p_sejour_id bigint,
  p_passage jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sejour sejours%rowtype;
  v_old_chambre_id bigint;
  v_new_chambre_id bigint;
  v_clim text;
  v_tarif numeric;
  v_heures int;
  v_date_entree date;
  v_heure_entree time;
  v_sortie_ts timestamp;
  v_montant_total numeric;
  v_montant_paye numeric;
  v_diff_paye numeric;
  v_client jsonb := coalesce(p_passage->'client', '{}'::jsonb);
begin
  perform public.require_role('admin', 'gerant', 'reception');

  select * into v_sejour from sejours where id = p_sejour_id for update;
  if not found then
    raise exception 'Passage introuvable.' using errcode = 'P0002';
  end if;

  v_old_chambre_id := v_sejour.chambre_id;
  v_new_chambre_id := coalesce(nullif(p_passage->>'chambre_id', '')::bigint, v_sejour.chambre_id);
  v_clim := case
    when lower(coalesce(p_passage->>'type_climatisation', v_sejour.type_climatisation, 'climatisee')) = 'ventilee'
    then 'ventilee'
    else 'climatisee'
  end;
  v_tarif := case when v_clim = 'ventilee' then 2000 else 2500 end;
  v_heures := greatest(1, coalesce(nullif(p_passage->>'duree_heures', '')::int, v_sejour.duree_heures, 1));
  v_date_entree := coalesce(nullif(p_passage->>'date_entree', '')::date, v_sejour.date_entree);
  v_heure_entree := coalesce(nullif(p_passage->>'heure_entree', '')::time, v_sejour.heure_entree);
  v_sortie_ts := (v_date_entree + v_heure_entree) + make_interval(hours => v_heures);
  v_montant_total := v_heures * v_tarif;
  v_montant_paye := greatest(0, coalesce(nullif(p_passage->>'montant_paye', '')::numeric, v_sejour.montant_paye));
  v_diff_paye := v_montant_paye - v_sejour.montant_paye;

  -- Si changement de chambre sur un passage en cours
  if v_new_chambre_id <> v_old_chambre_id and v_sejour.statut = 'en_cours' then
    update chambres set statut = 'libre' where id = v_old_chambre_id;
    update chambres set statut = 'occupee' where id = v_new_chambre_id;
  end if;

  -- Mise à jour éventuelle du client associé
  if v_sejour.client_id is not null and (v_client ? 'nom' or v_client ? 'prenoms' or v_client ? 'telephone') then
    update clients set
      nom = coalesce(nullif(trim(v_client->>'nom'), ''), nom),
      prenoms = coalesce(nullif(trim(v_client->>'prenoms'), ''), prenoms),
      telephone = coalesce(nullif(trim(v_client->>'telephone'), ''), telephone),
      type_piece = coalesce(nullif(trim(v_client->>'type_piece'), ''), type_piece),
      numero_piece = coalesce(nullif(trim(v_client->>'numero_piece'), ''), numero_piece)
    where id = v_sejour.client_id;
  end if;

  update sejours set
    chambre_id = v_new_chambre_id,
    type_climatisation = v_clim,
    tarif_horaire = v_tarif,
    duree_heures = v_heures,
    date_entree = v_date_entree,
    heure_entree = v_heure_entree,
    date_sortie_prevue = v_sortie_ts::date,
    heure_sortie_prevue = v_sortie_ts::time(0),
    nb_personnes = greatest(1, coalesce(nullif(p_passage->>'nb_personnes', '')::int, nb_personnes)),
    montant_total = v_montant_total,
    montant_paye = v_montant_paye,
    solde = v_montant_total - v_montant_paye
  where id = p_sejour_id
  returning * into v_sejour;

  -- Synchroniser les paiements associés au passage (montant, mode, référence ou suppression si 0)
  if v_montant_paye <= 0 then
    delete from paiements where sejour_id = p_sejour_id;
  elsif exists (select 1 from paiements where sejour_id = p_sejour_id) then
    -- Conserver l'encaissement principal et supprimer les éventuels doublons pour que le total corresponde exactement
    delete from paiements
    where sejour_id = p_sejour_id
      and id <> (select id from paiements where sejour_id = p_sejour_id order by date_paiement asc, id asc limit 1);

    update paiements
    set montant = v_montant_paye,
        mode_paiement = coalesce(nullif(p_passage->>'mode_paiement', ''), mode_paiement),
        reference = 'Passage ' || v_heures || 'h (' || case when v_clim = 'ventilee' then 'Ventilée' else 'Climatisée' end || ')'
    where sejour_id = p_sejour_id;
  else
    insert into paiements (sejour_id, montant, mode_paiement, reference, utilisateur_id)
    values (
      p_sejour_id,
      v_montant_paye,
      coalesce(nullif(p_passage->>'mode_paiement', ''), 'Espèces'),
      'Passage ' || v_heures || 'h (' || case when v_clim = 'ventilee' then 'Ventilée' else 'Climatisée' end || ')',
      auth.uid()
    );
  end if;

  return to_jsonb(v_sejour);
end;
$$;

create or replace function public.delete_passage(p_sejour_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sejour sejours%rowtype;
begin
  perform public.require_role('admin', 'gerant', 'reception');

  select * into v_sejour from sejours where id = p_sejour_id for update;
  if not found then
    raise exception 'Passage introuvable.' using errcode = 'P0002';
  end if;

  delete from paiements where sejour_id = p_sejour_id;
  delete from notifications where sejour_id = p_sejour_id;
  delete from sejours where id = p_sejour_id;

  -- Si le passage était en cours, remettre la chambre en statut disponible
  if v_sejour.statut = 'en_cours' then
    update chambres set statut = public.statut_disponible(v_sejour.chambre_id)
    where id = v_sejour.chambre_id and statut = 'occupee';
  end if;
end;
$$;

-- 7. Modification et suppression d'un client
create or replace function public.update_client(
  p_id bigint,
  p_client jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client clients%rowtype;
  v_nom text := nullif(trim(coalesce(p_client->>'nom', '')), '');
  v_prenoms text := nullif(trim(coalesce(p_client->>'prenoms', '')), '');
  v_tel text := nullif(trim(coalesce(p_client->>'telephone', '')), '');
begin
  perform public.require_role('admin', 'gerant', 'reception');

  update clients set
    nom = coalesce(v_nom, nom),
    prenoms = coalesce(v_prenoms, prenoms),
    sexe = coalesce(nullif(trim(p_client->>'sexe'), ''), sexe),
    telephone = coalesce(v_tel, telephone),
    whatsapp = case when p_client ? 'whatsapp' then nullif(trim(p_client->>'whatsapp'), '') else whatsapp end,
    email = case when p_client ? 'email' then nullif(trim(p_client->>'email'), '') else email end,
    nationalite = case when p_client ? 'nationalite' then nullif(trim(p_client->>'nationalite'), '') else nationalite end,
    profession = case when p_client ? 'profession' then nullif(trim(p_client->>'profession'), '') else profession end,
    adresse = case when p_client ? 'adresse' then nullif(trim(p_client->>'adresse'), '') else adresse end,
    type_piece = coalesce(nullif(trim(p_client->>'type_piece'), ''), type_piece),
    numero_piece = coalesce(nullif(trim(p_client->>'numero_piece'), ''), numero_piece)
  where id = p_id
  returning * into v_client;

  if not found then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  return to_jsonb(v_client);
end;
$$;

create or replace function public.delete_client(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_sejour record;
begin
  perform public.require_role('admin', 'gerant', 'reception');

  if not exists (select 1 from clients where id = p_id) then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;

  -- Libérer les chambres des éventuels séjours/passages en cours de ce client
  for r_sejour in
    select id, chambre_id from sejours where client_id = p_id and statut = 'en_cours'
  loop
    update sejours set statut = 'annule' where id = r_sejour.id;
    update chambres set statut = public.statut_disponible(r_sejour.chambre_id)
    where id = r_sejour.chambre_id and statut = 'occupee';
  end loop;

  update reservations set client_id = null where client_id = p_id;
  delete from paiements where sejour_id in (select id from sejours where client_id = p_id);
  delete from notifications where sejour_id in (select id from sejours where client_id = p_id);
  delete from sejours where client_id = p_id;
  delete from clients where id = p_id;
end;
$$;

-- 8. Droits d'exécution
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

notify pgrst, 'reload schema';
