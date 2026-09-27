import { api } from "../lib/apiClient.js";

export async function listPayments({ since } = {}) {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  return api.get(`/payments${qs}`);
}

export async function recordPayment(payload) {
  return api.post("/payments", payload);
}
