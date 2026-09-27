import { supabase, friendlyError } from "../lib/supabaseClient.js";

export async function listClients(q) {
  let query = supabase.from("clients").select("*").order("created_at", { ascending: false }).limit(100);
  if (q) {
    query = query.or(`nom.ilike.%${q}%,prenoms.ilike.%${q}%,telephone.ilike.%${q}%,numero_piece.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function getClient(id) {
  const { data: client, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) throw new Error(friendlyError(error));
  const { data: sejours, error: sejoursErr } = await supabase
    .from("sejours")
    .select("*, chambres:chambre_id(numero)")
    .eq("client_id", id)
    .order("date_entree", { ascending: false });
  if (sejoursErr) throw new Error(friendlyError(sejoursErr));
  return { ...client, sejours: sejours.map((s) => ({ ...s, chambre_numero: s.chambres?.numero })) };
}
