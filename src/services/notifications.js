import { supabase, friendlyError } from "../lib/supabaseClient.js";

export async function listNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function retryNotification(id) {
  const { data, error } = await supabase.functions.invoke("notify", { body: { action: "retry", notification_id: id } });
  if (error) throw new Error(friendlyError(error));
  return data;
}
