import { supabase, raise } from "../lib/supabaseClient.js";

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) raise(error);
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Renvoie le profil, ou null s'il n'existe pas. */
export async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) raise(error);
  return data;
}
