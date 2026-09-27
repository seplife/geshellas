import { api } from "../lib/apiClient.js";

export async function listReservations() {
  return api.get("/reservations");
}

export async function createReservation(payload) {
  return api.post("/reservations", payload);
}

export async function cancelReservation(id) {
  return api.delete(`/reservations/${id}`);
}

export async function markReservationAbsent(id) {
  return api.put(`/reservations/${id}/absent`);
}
