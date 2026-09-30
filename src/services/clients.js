import { supabase, raise } from "../lib/supabaseClient.js";

export async function listClients(q = "") {
  let query = supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const term = q.trim();
  if (term) {
    query = query.or(
      `nom.ilike.%${term}%,prenoms.ilike.%${term}%,telephone.ilike.%${term}%,numero_piece.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) raise(error);
  return data || [];
}

export async function getClient(id) {
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (cErr) raise(cErr);

  const { data: sejours, error: sErr } = await supabase
    .from("sejours")
    .select("*, chambres(numero)")
    .eq("client_id", id)
    .order("date_entree", { ascending: false });
  if (sErr) raise(sErr);

  return {
    ...client,
    sejours: (sejours || []).map((s) => ({
      ...s,
      chambre_numero: s.chambres?.numero || "",
    })),
  };
}

