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

-- 6. Autoriser aussi le rôle gérant sur check_in, check_out, extend_stay, record_payment
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

notify pgrst, 'reload schema';
