import { createClient } from "@supabase/supabase-js";

// Valeurs publiques du projet de production. La clé « anon » est publique par
// conception (la sécurité repose sur RLS et les fonctions SECURITY DEFINER) ;
// elle sert de repli si les variables d'environnement ne sont pas fournies au
// build (ex. secrets GitHub Actions non configurés).
const DEFAULT_URL = "https://yfstlcgdxxjoazyyourz.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmc3RsY2dkeHhqb2F6eXlvdXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTYwMTYsImV4cCI6MjEwNjM3MjAxNn0.T0gYzRsUTbVPxufAesLkXy5JNocesM3jVbUW02hgmdo"

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "hellas-auth",
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
      "Un administrateur doit exécuter les scripts supabase/migrations (0001 puis 0002) dans l'éditeur SQL Supabase."
    );
  }
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion internet.";
  }
  if (msg.includes("Invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (msg.includes("Email not confirmed")) return "Adresse e-mail non confirmée.";
  if (code === "PGRST301" || /JWT expired/i.test(msg)) return "Votre session a expiré. Reconnectez-vous.";
  if (code === "23505") return "Cet élément existe déjà (doublon).";
  if (code === "42501" && /permission denied/i.test(msg)) return "Action non autorisée pour votre compte.";
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
