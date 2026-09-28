-- ============================================================================
-- Migration 0003 : Ajout du numéro WhatsApp de l'administrateur
-- ============================================================================
-- Ajoute la clé "admin_whatsapp" dans la table parametres pour stocker
-- le numéro de l'administrateur (distinct du gérant déjà enregistré sous
-- la clé "manager_whatsapp").
-- À exécuter via `supabase db push` ou dans l'éditeur SQL Supabase.
-- ============================================================================

insert into public.parametres (cle, valeur)
values ('admin_whatsapp', '+2250707874970')
on conflict (cle) do update set valeur = excluded.valeur;

-- S'assurer que le numéro du gérant est à jour
update public.parametres
set valeur = '+2250779535795'
where cle = 'manager_whatsapp';
