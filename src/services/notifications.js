import { api } from "../lib/apiClient.js";

export async function listNotifications() {
  return api.get("/notifications");
}

export async function retryNotification(id) {
  return api.post(`/notifications/retry/${id}`);
}
