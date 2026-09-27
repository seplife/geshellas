import { supabase, raise } from "../lib/supabaseClient.js";

/** Neutralise les caractères qui ont un sens dans la syntaxe de filtre PostgREST. */
const sanitize = (q) => q.replace(/[,()%*\\]/g, " ").trim();

export async function listClients(q) {
  let query = supabase.from("clients").select("*").order("created_at", { ascending: false }).limit(100);
  const term = q ? sanitize(q) : "";
  if (term) {
    query = query.or(
      `nom.ilike.%${term}%,prenoms.ilike.%${term}%,telephone.ilike.%${term}%,numero_piece.ilike.%${term}%`
    );
  }
  const { data, error } = await query;
  if (error) raise(error);
  return data;
}

export async function getClient(id) {
  const { data: client, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) raise(error);
  const { data: sejours, error: sejoursErr } = await supabase
    .from("sejours")
    .select("*, chambres:chambre_id(numero)")
    .eq("client_id", id)
    .order("date_entree", { ascending: false });
  if (sejoursErr) raise(sejoursErr);
  return { ...client, sejours: sejours.map((s) => ({ ...s, chambre_numero: s.chambres?.numero })) };
}
