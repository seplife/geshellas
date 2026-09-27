import { supabase, raise } from "../lib/supabaseClient.js";

/** Appelle une Edge Function et remonte le message d'erreur renvoyé par celle-ci. */
export async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let detail = null;
    try {
      detail = await error.context?.json?.();
    } catch {
      /* corps non JSON */
    }
    raise(detail?.error ? { message: detail.error } : error);
  }
  return data;
}
