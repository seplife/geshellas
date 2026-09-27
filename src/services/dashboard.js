import { api } from "../lib/apiClient.js";

export async function getDashboard() {
  return api.get("/dashboard");
}
