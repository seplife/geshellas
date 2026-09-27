import { supabase, friendlyError } from "../lib/supabaseClient.js";

export async function getDashboard() {
  const { data, error } = await supabase.rpc("get_dashboard");
  if (error) throw new Error(friendlyError(error));
  return data;
}
