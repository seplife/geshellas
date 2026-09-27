import { supabase, raise } from "../lib/supabaseClient.js";

export async function getDashboard() {
  const { data, error } = await supabase.rpc("get_dashboard");
  if (error) raise(error);
  return data;
}
