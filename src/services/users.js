import { api } from "../lib/apiClient.js";

export async function listUsers() {
  return api.get("/users");
}

export async function createUser(payload) {
  return api.post("/users", payload);
}

export async function setUserActive(id, actif) {
  return api.put(`/users/${id}/active`, { actif });
}

export async function setUserRole(id, role) {
  return api.put(`/users/${id}/role`, { role });
}
