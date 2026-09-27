import { supabase, friendlyError } from "../lib/supabaseClient.js";

export async function listReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, chambres:chambre_id(numero)")
    .order("date_arrivee");
  if (error) throw new Error(friendlyError(error));
  return data.map((r) => ({ ...r, chambre_numero: r.chambres?.numero }));
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
  });
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function cancelReservation(id) {
  const { error } = await supabase.rpc("cancel_reservation", { p_reservation_id: id });
  if (error) throw new Error(friendlyError(error));
}
