import { supabase, friendlyError } from "../lib/supabaseClient.js";

export async function listUsers() {
  const { data, error } = await supabase.rpc("list_users");
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function createUser(payload) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", { body: payload });
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function setUserActive(id, actif) {
  const { error } = await supabase.rpc("set_user_active", { p_user_id: id, p_actif: actif });
  if (error) throw new Error(friendlyError(error));
}

export async function setUserRole(id, role) {
  const { error } = await supabase.rpc("set_user_role", { p_user_id: id, p_role: role });
  if (error) throw new Error(friendlyError(error));
}
