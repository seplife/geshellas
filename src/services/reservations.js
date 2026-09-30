import { supabase, raise } from "../lib/supabaseClient.js";

export async function listReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, chambres(numero, type, prix_nuit)")
    .order("date_arrivee", { ascending: true });
  if (error) raise(error);

  return (data || []).map((r) => ({
    ...r,
    chambre_numero: r.chambres?.numero || "",
    chambre_type: r.chambres?.type || "",
    prix_nuit: r.chambres?.prix_nuit || 0,
  }));
}

export async function createReservation(payload) {
  const { data, error } = await supabase.rpc("create_reservation", {
    p_nom_client: payload.nom_client,
    p_telephone: payload.telephone || null,
    p_chambre_id: payload.chambre_id,
    p_date_arrivee: payload.date_arrivee,
    p_date_depart: payload.date_depart,
    p_montant: payload.montant ?? 0,
    p_avance: payload.avance ?? 0,
    p_mode_paiement: payload.mode_paiement ?? "Espèces",
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

