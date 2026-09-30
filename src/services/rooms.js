import { supabase, raise } from "../lib/supabaseClient.js";

export async function listRooms() {
  const { data, error } = await supabase
    .from("chambres")
    .select("*")
    .order("numero", { ascending: true });
  if (error) raise(error);
  return data || [];
}

export async function validerNettoyage(roomId) {
  const { error } = await supabase.rpc("valider_nettoyage", { p_chambre_id: roomId });
  if (error) raise(error);
}

export async function signalerAnomalie(roomId, description) {
  const { error } = await supabase.rpc("signaler_anomalie", {
    p_chambre_id: roomId,
    p_description: description,
  });
  if (error) raise(error);
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

export function subscribeHotel(onChange, onStatus) {
  const channel = supabase
    .channel("hotel-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "chambres" }, (p) => onChange("chambres", p))
    .on("postgres_changes", { event: "*", schema: "public", table: "sejours" }, (p) => onChange("sejours", p))
    .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, (p) => onChange("reservations", p))
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (p) => onChange("notifications", p))
    .subscribe((status) => onStatus?.(status === "SUBSCRIBED"));

  return () => {
    supabase.removeChannel(channel);
  };
}

export const subscribeRooms = subscribeHotel;

