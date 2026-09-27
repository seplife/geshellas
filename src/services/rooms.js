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
 * Appelle onChange() toutes les 30 secondes et renvoie une fonction
 * de désabonnement (clearInterval).
 */
export function subscribeRooms(onChange) {
  const id = setInterval(() => onChange(), 30_000);
  return () => clearInterval(id);
}
