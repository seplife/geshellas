import { supabase, friendlyError } from "../lib/supabaseClient.js";

export async function getSettings() {
  const { data, error } = await supabase.rpc("get_settings");
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function updateSettings(settings) {
  const { error } = await supabase.rpc("update_settings", { p_settings: settings });
  if (error) throw new Error(friendlyError(error));
}
