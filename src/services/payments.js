import { supabase, friendlyError } from "../lib/supabaseClient.js";

export async function listPayments() {
  const { data, error } = await supabase
    .from("paiements")
    .select("*, sejours:sejour_id(numero, chambre_id, chambres:chambre_id(numero), clients:client_id(nom, prenoms))")
    .order("date_paiement", { ascending: false });
  if (error) throw new Error(friendlyError(error));
  return data.map((p) => ({
    ...p,
    sejour_numero: p.sejours?.numero,
    chambre_numero: p.sejours?.chambres?.numero,
    client_nom: p.sejours?.clients?.nom,
    client_prenoms: p.sejours?.clients?.prenoms,
  }));
}

export async function recordPayment(payload) {
  const { data, error } = await supabase.rpc("record_payment", {
    p_sejour_id: payload.sejour_id,
    p_montant: payload.montant,
    p_mode_paiement: payload.mode_paiement,
    p_reference: payload.reference || null,
  });
  if (error) throw new Error(friendlyError(error));
  return data;
}
