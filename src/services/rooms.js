import { api } from "../lib/apiClient.js";

export async function listRooms() {
  return api.get("/rooms");
}

export async function validerNettoyage(roomId) {
  return api.post(`/rooms/clean/${roomId}`);
}

export async function signalerAnomalie(roomId, description) {
  return api.post(`/rooms/maintenance/${roomId}`, { description });
}

export async function createRoom(room) {
  return api.post("/rooms", room);
}

export async function updateRoom(id, patch) {
  return api.put(`/rooms/${id}`, patch);
}

/**
 * Polling-based subscription — remplace Supabase Realtime.
 * Appelle onChange(table, payload) toutes les 30 secondes et
 * renvoie la fonction de désabonnement (clearInterval).
 */
export function subscribeHotel(onChange) {
  const id = setInterval(() => {
    onChange("chambres", {});
    onChange("sejours", {});
    onChange("reservations", {});
  }, 30_000);
  return () => clearInterval(id);
}

// Alias pour rétrocompatibilité
export const subscribeRooms = subscribeHotel;
