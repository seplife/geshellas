import { supabase, raise } from "../lib/supabaseClient.js";

/** Paiements depuis une date (ISO) — séjours ET avances de réservation. */
export async function listPayments({ since } = {}) {
  let query = supabase
    .from("paiements")
    .select(
      "*, sejours:sejour_id(numero, chambres:chambre_id(numero), clients:client_id(nom, prenoms)), " +
        "reservations:reservation_id(nom_client, chambres:chambre_id(numero))"
    )
    .order("date_paiement", { ascending: false })
    .limit(1000);
  if (since) query = query.gte("date_paiement", since);
  const { data, error } = await query;
  if (error) raise(error);
  return data.map((p) => ({
    ...p,
    sejour_numero: p.sejours?.numero,
    chambre_numero: p.sejours?.chambres?.numero ?? p.reservations?.chambres?.numero,
    client_label: p.sejours?.clients
      ? `${p.sejours.clients.nom} ${p.sejours.clients.prenoms}`
      : p.reservations?.nom_client || null,
    origine: p.sejour_id ? "Séjour" : p.reservation_id ? "Réservation" : "—",
  }));
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
