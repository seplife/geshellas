import { api } from "../lib/apiClient.js";

export async function listClients(q) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return api.get(`/clients${qs}`);
}

export async function getClient(id) {
  return api.get(`/clients/${id}`);
}
