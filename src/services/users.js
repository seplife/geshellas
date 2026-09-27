import { supabase, raise } from "../lib/supabaseClient.js";
import { invokeFunction } from "./_fn.js";

export async function listUsers() {
  const { data, error } = await supabase.rpc("list_users");
  if (error) raise(error);
  return data;
}

export function createUser(payload) {
  return invokeFunction("admin-create-user", payload);
}

export async function setUserActive(id, actif) {
  const { error } = await supabase.rpc("set_user_active", { p_user_id: id, p_actif: actif });
  if (error) raise(error);
}

export async function setUserRole(id, role) {
  const { error } = await supabase.rpc("set_user_role", { p_user_id: id, p_role: role });
  if (error) raise(error);
}
