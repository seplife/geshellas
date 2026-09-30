import { supabase, raise } from "../lib/supabaseClient.js";
import { invokeFunction } from "./_fn.js";

export async function listNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) raise(error);
  return data || [];
}

export async function retryNotification(id) {
  return invokeFunction("notify", { action: "retry", notification_id: id });
}

