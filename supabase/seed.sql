-- ============================================================================
-- Données de démonstration — Hellas Hôtel Manager
-- ============================================================================
-- À exécuter une fois après 0001_init.sql (facultatif). Ne crée AUCUN
-- utilisateur : les comptes se créent depuis le tableau de bord Supabase
-- (Authentication > Add user) — voir supabase/README.md, section "Premier
-- administrateur".
-- ============================================================================

insert into public.chambres (numero, type, categorie, prix_nuit, capacite, nombre_lits, etage, statut)
values
  ('101', 'Standard', 'Standard', 15000, 2, 1, 1, 'libre'),
  ('102', 'Standard', 'Standard', 15000, 2, 1, 1, 'libre'),
  ('103', 'Confort',  'Confort',  20000, 2, 1, 1, 'libre'),
  ('201', 'Confort',  'Confort',  20000, 3, 2, 2, 'libre'),
  ('202', 'Suite',    'Suite',    35000, 4, 2, 2, 'libre'),
  ('203', 'Standard', 'Standard', 15000, 2, 1, 2, 'libre')
on conflict (numero) do nothing;

insert into public.parametres (cle, valeur)
values ('manager_whatsapp', '+2250779535795')
on conflict (cle) do nothing;
