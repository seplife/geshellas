import { supabase, friendlyError } from "../lib/supabaseClient.js";

export async function listRooms({ statut, etage } = {}) {
  let query = supabase.from("chambres").select("*").order("numero");
  if (statut) query = query.eq("statut", statut);
  if (etage) query = query.eq("etage", etage);
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function validerNettoyage(roomId) {
  const { error } = await supabase.rpc("valider_nettoyage", { p_chambre_id: roomId });
  if (error) throw new Error(friendlyError(error));
}

export async function signalerAnomalie(roomId, description) {
  const { error } = await supabase.rpc("signaler_anomalie", { p_chambre_id: roomId, p_description: description });
  if (error) throw new Error(friendlyError(error));
}

export async function createRoom(room) {
  const { data, error } = await supabase.rpc("create_room", { p_room: room });
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function updateRoom(id, patch) {
  const { data, error } = await supabase.rpc("update_room", { p_id: id, p_room: patch });
  if (error) throw new Error(friendlyError(error));
  return data;
}

/** S'abonne en temps réel aux changements de statut des chambres. */
export function subscribeRooms(onChange) {
  const channel = supabase
    .channel("chambres-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "chambres" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
