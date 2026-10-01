-- ============================================================================
-- Migration 0004 : Inscription directe, activation des profils & suppression de chambre
-- ============================================================================
-- À exécuter dans l'éditeur SQL de votre projet Supabase (SQL Editor → Run).
-- Ce script est idempotent (peut être relancé sans erreur).
-- ============================================================================

-- 1. S'assurer que tous les comptes déjà inscrits dans auth.users ont un profil actif
insert into public.profiles (id, nom, prenoms, telephone, role, actif)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'nom', ''), split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'prenoms', ''),
  u.raw_user_meta_data->>'telephone',
  'admin'::role_utilisateur,
  true
from auth.users u
on conflict (id) do update
  set actif = true,
      role = case when public.profiles.role = 'reception' then 'admin'::role_utilisateur else public.profiles.role end;

-- 2. Mettre à jour le trigger d'inscription pour que les nouveaux comptes créés
-- depuis l'écran « Créer un compte » soient immédiatement actifs.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role role_utilisateur;
begin
  begin
    v_role := coalesce(
      (new.raw_app_meta_data->>'role')::role_utilisateur,
      (new.raw_user_meta_data->>'role')::role_utilisateur
    );
  exception when invalid_text_representation then
    v_role := null;
  end;

  insert into public.profiles (id, nom, prenoms, telephone, role, actif)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nom', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'prenoms', ''),
    new.raw_user_meta_data->>'telephone',
    coalesce(v_role, 'admin'::role_utilisateur),
    true
  )
  on conflict (id) do update
    set actif = true;
  return new;
end;
$$;

-- 3. Autoriser l'ajout, la modification et la suppression de chambres
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
  perform public.require_role('admin', 'gerant', 'reception');
  if nullif(p_room->>'prix_nuit', '') is not null and (p_room->>'prix_nuit')::numeric < 0 then
    raise exception 'Prix par nuit invalide.' using errcode = '23514';
  end if;
  if v_numero is not null and exists (select 1 from chambres where numero = v_numero and id <> p_id) then
    raise exception 'La chambre % existe déjà.', v_numero using errcode = '23505';
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
    photo_url = case when p_room ? 'photo_url' then nullif(p_room->>'photo_url', '') else photo_url end
  where id = p_id
  returning * into v_room;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;
  return to_jsonb(v_room);
end;
$$;

create or replace function public.delete_room(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room chambres%rowtype;
begin
  perform public.require_role('admin', 'gerant', 'reception');

  select * into v_room from chambres where id = p_id for update;
  if not found then
    raise exception 'Chambre introuvable.' using errcode = 'P0002';
  end if;

  if exists (select 1 from sejours where chambre_id = p_id and statut = 'en_cours') then
    raise exception 'Impossible de supprimer la chambre % car un séjour y est actuellement en cours.', v_room.numero using errcode = '23514';
  end if;

  -- Nettoyage des dépendances avant suppression de la chambre
  delete from historique_statuts_chambres where chambre_id = p_id;
  delete from paiements where sejour_id in (select id from sejours where chambre_id = p_id)
                           or reservation_id in (select id from reservations where chambre_id = p_id);
  delete from notifications where sejour_id in (select id from sejours where chambre_id = p_id);
  delete from sejours where chambre_id = p_id;
  delete from reservations where chambre_id = p_id;
  delete from chambres where id = p_id;
end;
$$;

-- 4. Droits de lecture/exécution complets pour les utilisateurs connectés
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.current_role_actif() to anon;

notify pgrst, 'reload schema';
