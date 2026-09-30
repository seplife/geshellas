import { supabase, raise } from "../lib/supabaseClient.js";

export async function listPayments({ since } = {}) {
  let query = supabase
    .from("paiements")
    .select("*, sejours(numero, chambres(numero), clients(nom, prenoms)), reservations(nom_client, chambres(numero))")
    .order("date_paiement", { ascending: false })
    .limit(500);

  if (since) query = query.gte("date_paiement", since);

  const { data, error } = await query;
  if (error) raise(error);

  return (data || []).map((p) => {
    const sejour = p.sejours;
    const resa = p.reservations;
    const clientLabel = sejour?.clients
      ? `${sejour.clients.nom} ${sejour.clients.prenoms}`.trim()
      : resa?.nom_client || "";
    const chambreNumero = sejour?.chambres?.numero || resa?.chambres?.numero || "";
    const origine = sejour?.numero ? `Séjour ${sejour.numero}` : resa ? "Réservation" : "Paiement";
    return {
      ...p,
      client_label: clientLabel,
      chambre_numero: chambreNumero,
      origine,
    };
  });
}

export async function recordPayment(payload) {
  const { data, error } = await supabase.rpc("record_payment", {
    p_sejour_id: payload.sejour_id,
    p_montant: payload.montant,
    p_mode_paiement: payload.mode_paiement,
    p_reference: payload.reference || null,
  });
  if (error) raise(error);
  return data;
}

