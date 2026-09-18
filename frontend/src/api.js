const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "hellas_token";
const USER_KEY = "hellas_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(
      "Impossible de joindre le serveur. Vérifiez que le backend tourne et que VITE_API_URL est correct.",
      0
    );
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new ApiError(data?.error || `Erreur ${response.status}`, response.status);
  }
  return data;
}

export const api = {
  // --- auth ---
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/auth/me"),

  // --- dashboard ---
  dashboard: () => request("/dashboard"),

  // --- rooms ---
  rooms: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/rooms${qs ? `?${qs}` : ""}`);
  },
  validerNettoyage: (roomId) => request(`/rooms/${roomId}/valider-nettoyage`, { method: "POST" }),
  signalerAnomalie: (roomId, description) =>
    request(`/rooms/${roomId}/signaler-anomalie`, { method: "POST", body: { description } }),

  // --- stays (séjours) ---
  stays: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/stays${qs ? `?${qs}` : ""}`);
  },
  checkIn: (payload) => request("/stays/check-in", { method: "POST", body: payload }),
  checkOut: (sejourId, payload) => request(`/stays/${sejourId}/check-out`, { method: "POST", body: payload }),
  extendStay: (sejourId, payload) => request(`/stays/${sejourId}/prolonger`, { method: "POST", body: payload }),

  // --- clients ---
  clients: (q) => request(`/clients${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  client: (id) => request(`/clients/${id}`),

  // --- reservations ---
  reservations: () => request("/reservations"),
  createReservation: (payload) => request("/reservations", { method: "POST", body: payload }),
  cancelReservation: (id) => request(`/reservations/${id}/annuler`, { method: "POST" }),

  // --- payments ---
  payments: () => request("/payments"),
  recordPayment: (payload) => request("/payments", { method: "POST", body: payload }),

  // --- notifications ---
  notifications: () => request("/notifications"),
  retryNotification: (id) => request(`/notifications/${id}/renvoyer`, { method: "POST" }),

  // --- settings ---
  settings: () => request("/settings"),
  updateSettings: (payload) => request("/settings", { method: "PUT", body: payload }),

  // --- users ---
  users: () => request("/users"),
  createUser: (payload) => request("/users", { method: "POST", body: payload }),
  deactivateUser: (id) => request(`/users/${id}/desactiver`, { method: "PUT" }),
};

export { ApiError };
