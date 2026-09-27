import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/**
 * Client Supabase avec la clé service_role — n'est utilisé QUE côté Edge
 * Function (jamais exposé au frontend). Contourne RLS volontairement pour
 * lire/écrire les données nécessaires à l'envoi WhatsApp et à
 * l'administration des comptes.
 */
export function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans les secrets de la fonction.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Client "anon" avec le JWT de l'appelant, pour vérifier qui il est. */
export function supabaseAsCaller(authHeader: string | null) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY manquants dans les secrets de la fonction.");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });
}
