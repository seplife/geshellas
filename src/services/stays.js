import { api } from "../lib/apiClient.js";

export async function listStays({ statut } = {}) {
  const qs = statut ? `?statut=${statut}` : "";
  return api.get(`/stays${qs}`);
}

export async function checkIn(payload) {
  return api.post("/stays/checkin", payload);
}

export async function checkOut(sejourId, payload) {
  return api.post(`/stays/checkout/${sejourId}`, payload);
}

export async function extendStay(sejourId, payload) {
  return api.post(`/stays/extend/${sejourId}`, payload);
}
