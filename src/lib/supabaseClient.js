import { createClient } from "@supabase/supabase-js";

const url = "https://jyrlfxrsdloizrfgaunc.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cmxmeHJzZGxvaXpyZmdhdW5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODE1ODEsImV4cCI6MjEwMjA1NzU4MX0.ckJKRUbI08k_oaonBZjBPXUQOyfWGekAVafFcQBg-58";

if (!url || !anonKey) {
  // Erreur volontairement bruyante : sans ces deux variables, rien ne peut
  // fonctionner (auth, données, edge functions).
  console.error(
    "VITE_SUPABASE_URL et/ou VITE_SUPABASE_ANON_KEY sont manquants. " +
      "Copiez .env.example vers .env.local et renseignez les valeurs de votre projet Supabase."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "hellas-auth",
  },
});

/**
 * Traduit les erreurs Supabase/Postgres les plus courantes en messages
 * compréhensibles côté écran, sans exposer de détails techniques.
 */
export function friendlyError(error) {
  if (!error) return "Une erreur est survenue.";
  const msg = error.message || String(error);
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return "Impossible de joindre Supabase. Vérifiez votre connexion internet.";
  }
  if (msg.includes("Invalid login credentials")) {
    return "Identifiants invalides.";
  }
  return msg;
}
