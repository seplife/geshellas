/**
 * Client HTTP centralisé pour l'API Express/MySQL.
 * Remplace entièrement supabaseClient.js.
 *
 * - Lit le token JWT depuis localStorage
 * - Injecte Authorization: Bearer <token> sur chaque requête
 * - Lève une Error avec message lisible en cas d'échec
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function getToken() {
  return localStorage.getItem("hellas-token");
}

export function setToken(token) {
  if (token) localStorage.setItem("hellas-token", token);
  else localStorage.removeItem("hellas-token");
}

async function request(method, path, body) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.message || json.error || `Erreur ${res.status}`);
  }
  return json;
}

export const api = {
  get:    (path)         => request("GET",    path),
  post:   (path, body)   => request("POST",   path, body),
  put:    (path, body)   => request("PUT",    path, body),
  delete: (path)         => request("DELETE", path),
};
