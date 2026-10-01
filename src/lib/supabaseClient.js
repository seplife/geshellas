import { createClient } from "@supabase/supabase-js";

// Valeurs publiques du projet de production. La clé « anon » est publique par
// conception (la sécurité repose sur RLS et les fonctions SECURITY DEFINER) ;
// elle sert de repli si les variables d'environnement ne sont pas fournies au
// build (ex. secrets GitHub Actions non configurés).
const DEFAULT_URL = "https://yfstlcgdxxjoazyyourz.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmc3RsY2dkeHhqb2F6eXlvdXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTYwMTYsImV4cCI6MjEwNjM3MjAxNn0.T0gYzRsUTbVPxufAesLkXy5JNocesM3jVbUW02hgmdo";

// En développement local, passer par le proxy Vite (/supabase) évite tout
// blocage CORS ou rejet de certificat TLS (ex. horloge système décalée).
const url =
  import.meta.env.DEV && typeof window !== "undefined"
    ? `${window.location.origin}/supabase`
    : import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

const STORAGE_KEY = "hellas-auth";

// Corrige le décalage d'horloge éventuel du poste client (ex. date système en 2026)
// dans la session déjà stockée pour éviter que @supabase/auth-js ne considère le JWT
// comme expiré et n'envoie les requêtes avec la clé anonyme (erreur 42501).
if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const nowSec = Math.floor(Date.now() / 1000);
      if (parsed && parsed.access_token && parsed.expires_at && parsed.expires_at <= nowSec) {
        parsed.expires_at = nowSec + (Number(parsed.expires_in) || 3600);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    }
  } catch {
    /* ignore */
  }
}

async function clockTolerantFetch(input, init) {
  const res = await fetch(input, init);
  const reqUrl = typeof input === "string" ? input : input?.url || "";
  if (reqUrl.includes("/auth/v1/") && res.ok) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const clone = res.clone();
        const data = await clone.json();
        if (data && typeof data === "object" && data.access_token && data.expires_in) {
          data.expires_at = Math.floor(Date.now() / 1000) + Number(data.expires_in);
          return new Response(JSON.stringify(data), {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
          });
        }
      } catch {
        /* ignore */
      }
    }
  }
  return res;
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: STORAGE_KEY,
  },
  global: {
    fetch: clockTolerantFetch,
  },
});

/**
 * Traduit les erreurs Supabase / PostgREST / Postgres en messages clairs, sans
 * exposer de détails techniques inutiles au personnel.
 */
export function friendlyError(error) {
  if (!error) return "Une erreur est survenue.";
  const msg = error.message || String(error);
  const code = error.code || "";

  if (code === "PGRST202" || /schema cache/i.test(msg)) {
    return (
      "La base de données n'est pas à jour : une fonction attendue est introuvable. " +
      "Exécutez le script supabase/migrations/0004_chambres_et_inscription.sql dans l'éditeur SQL Supabase."
    );
  }
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion internet.";
  }
  if (msg.includes("Invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (msg.includes("Email not confirmed")) return "Adresse e-mail non confirmée.";
  if (code === "PGRST301" || /JWT expired/i.test(msg)) return "Votre session a expiré. Reconnectez-vous.";
  if (code === "23505") return "Cet élément existe déjà (doublon).";
  if (code === "28000" || /compte désactivé/i.test(msg)) {
    return (
      "Votre profil n'est pas encore activé dans Supabase. " +
      "Exécutez le script supabase/migrations/0004_chambres_et_inscription.sql dans l'éditeur SQL Supabase."
    );
  }
  if (code === "42501" && /permission denied/i.test(msg)) {
    return (
      "Action non autorisée pour votre compte. " +
      "Exécutez le script supabase/migrations/0004_chambres_et_inscription.sql dans l'éditeur SQL Supabase pour activer les droits."
    );
  }
  if (/FunctionsFetchError|Failed to send a request to the Edge Function/i.test(msg)) {
    return "Service de notification indisponible (Edge Function non déployée ?).";
  }
  return msg;
}

/** Lève une Error lisible à partir d'une erreur Supabase. */
export function raise(error) {
  const e = new Error(friendlyError(error));
  e.code = error?.code;
  throw e;
}

