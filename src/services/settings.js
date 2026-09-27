import { api } from "../lib/apiClient.js";

export async function getSettings() {
  return api.get("/settings");
}

export async function updateSettings(settings) {
  return api.put("/settings", settings);
}
