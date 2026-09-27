import { supabase, friendlyError } from "../lib/supabaseClient.js";

export async function listStays({ statut } = {}) {
  let query = supabase
    .from("sejours")
    .select("*, clients:client_id(nom, prenoms, telephone), chambres:chambre_id(numero)")
    .order("created_at", { ascending: false });
  if (statut) query = query.eq("statut", statut);
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return data.map((s) => ({
    ...s,
    client_nom: s.clients?.nom,
    client_prenoms: s.clients?.prenoms,
    client_telephone: s.clients?.telephone,
    chambre_numero: s.chambres?.numero,
  }));
}

/** Notifie le gérant en tâche de fond — un échec d'envoi n'affecte jamais l'opération déjà validée. */
function notifyInBackground(payload) {
  supabase.functions.invoke("notify", { body: payload }).catch((e) => console.error("Notification échouée:", e));
}

export async function checkIn(payload) {
  const { data, error } = await supabase.rpc("check_in", {
    p_client: payload.client,
    p_chambre_id: payload.chambre_id,
    p_date_entree: payload.date_entree,
    p_heure_entree: payload.heure_entree,
    p_date_sortie_prevue: payload.date_sortie_prevue,
    p_heure_sortie_prevue: payload.heure_sortie_prevue,
    p_nb_personnes: payload.nb_personnes,
    p_avance: payload.avance,
    p_mode_paiement: payload.mode_paiement,
  });
  if (error) throw new Error(friendlyError(error));
  notifyInBackground({ action: "send", type: "check-in", sejour_id: data.sejour.id });
  return data;
}

export async function checkOut(sejourId, payload) {
  const { data, error } = await supabase.rpc("check_out", {
    p_sejour_id: sejourId,
    p_montant_supplementaire: payload.montant_supplementaire,
    p_mode_paiement: payload.mode_paiement,
  });
  if (error) throw new Error(friendlyError(error));
  notifyInBackground({ action: "send", type: "check-out", sejour_id: sejourId });
  return data.sejour;
}

export async function extendStay(sejourId, payload) {
  const { data, error } = await supabase.rpc("extend_stay", {
    p_sejour_id: sejourId,
    p_nouvelle_date_sortie: payload.nouvelle_date_sortie,
    p_nouvelle_heure_sortie: payload.nouvelle_heure_sortie,
    p_paiement_supplementaire: payload.paiement_supplementaire,
    p_mode_paiement: payload.mode_paiement,
  });
  if (error) throw new Error(friendlyError(error));
  notifyInBackground({
    action: "send",
    type: "prolongation",
    sejour_id: sejourId,
    ancienne_sortie: data.ancienne_sortie,
    montant_supplementaire: data.montant_supplementaire,
  });
  return data.sejour;
}
