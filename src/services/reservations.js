import { supabase, raise } from "../lib/supabaseClient.js";

export async function listReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, chambres:chambre_id(numero, type, prix_nuit, capacite)")
    .order("date_arrivee")
    .limit(500);
  if (error) raise(error);
  return data.map((r) => ({ ...r, chambre_numero: r.chambres?.numero, chambre: r.chambres }));
}

export async function createReservation(payload) {
  const { data, error } = await supabase.rpc("create_reservation", {
    p_nom_client: payload.nom_client,
    p_telephone: payload.telephone || null,
    p_chambre_id: payload.chambre_id,
    p_date_arrivee: payload.date_arrivee,
    p_date_depart: payload.date_depart,
    p_montant: payload.montant,
    p_avance: payload.avance,
    p_mode_paiement: payload.mode_paiement,
  });
  if (error) raise(error);
  return data;
}

export async function cancelReservation(id) {
  const { error } = await supabase.rpc("cancel_reservation", { p_reservation_id: id });
  if (error) raise(error);
}

export async function markReservationAbsent(id) {
  const { error } = await supabase.rpc("mark_reservation_absent", { p_reservation_id: id });
  if (error) raise(error);
}
