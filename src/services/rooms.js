import { supabase, raise } from "../lib/supabaseClient.js";

export async function listRooms() {
  const { data, error } = await supabase.from("chambres").select("*").order("numero");
  if (error) raise(error);
  return data;
}

export async function validerNettoyage(roomId) {
  const { error } = await supabase.rpc("valider_nettoyage", { p_chambre_id: roomId });
  if (error) raise(error);
}

export async function signalerAnomalie(roomId, description) {
  const { error } = await supabase.rpc("signaler_anomalie", { p_chambre_id: roomId, p_description: description });
  if (error) raise(error);
}

/**
 * S'abonne en temps réel aux changements (chambres, séjours, réservations)
 * effectués depuis un autre poste. Renvoie la fonction de désabonnement.
 */
export function subscribeHotel(onChange, onStatus) {
  const channel = supabase.channel("hotel-realtime");
  for (const table of ["chambres", "sejours", "reservations"]) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => onChange(table, payload));
  }
  channel.subscribe((status) => onStatus?.(status === "SUBSCRIBED"));
  return () => supabase.removeChannel(channel);
}

export async function createRoom(room) {
  const { data, error } = await supabase.rpc("create_room", { p_room: room });
  if (error) raise(error);
  return data;
}

export async function updateRoom(id, patch) {
  const { data, error } = await supabase.rpc("update_room", { p_id: id, p_room: patch });
  if (error) raise(error);
  return data;
}
