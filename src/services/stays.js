import { supabase, raise } from "../lib/supabaseClient.js";
import { invokeFunction } from "./_fn.js";

function notifyAsync(body) {
  invokeFunction("notify", body).catch((err) => {
    console.warn("Notification WhatsApp non envoyée:", err.message);
  });
}

export async function listStays({ statut } = {}) {
  let query = supabase
    .from("sejours")
    .select("*, clients(nom, prenoms, telephone), chambres(numero, prix_nuit)")
    .order("created_at", { ascending: false });

  if (statut) query = query.eq("statut", statut);

  const { data, error } = await query;
  if (error) raise(error);

  return (data || []).map((s) => ({
    ...s,
    client_nom: s.clients?.nom || "",
    client_prenoms: s.clients?.prenoms || "",
    client_telephone: s.clients?.telephone || "",
    chambre_numero: s.chambres?.numero || "",
    prix_nuit: s.chambres?.prix_nuit || 0,
  }));
}

export async function checkIn(payload) {
  const { data, error } = await supabase.rpc("check_in", {
    p_client: payload.client,
    p_chambre_id: payload.chambre_id,
    p_date_entree: payload.date_entree,
    p_heure_entree: payload.heure_entree,
    p_date_sortie_prevue: payload.date_sortie_prevue,
    p_heure_sortie_prevue: payload.heure_sortie_prevue,
    p_nb_personnes: payload.nb_personnes ?? 1,
    p_avance: payload.avance ?? 0,
    p_mode_paiement: payload.mode_paiement ?? "Espèces",
    p_reservation_id: payload.reservation_id ?? null,
  });
  if (error) raise(error);
  if (data?.sejour?.id) {
    notifyAsync({ action: "send", type: "check-in", sejour_id: data.sejour.id });
  }
  return data;
}

export async function checkOut(sejourId, payload = {}) {
  const { data, error } = await supabase.rpc("check_out", {
    p_sejour_id: sejourId,
    p_montant_supplementaire: payload.montant_supplementaire ?? 0,
    p_mode_paiement: payload.mode_paiement ?? "Espèces",
  });
  if (error) raise(error);
  notifyAsync({ action: "send", type: "check-out", sejour_id: sejourId });
  return data;
}

export async function extendStay(sejourId, payload) {
  const { data, error } = await supabase.rpc("extend_stay", {
    p_sejour_id: sejourId,
    p_nouvelle_date_sortie: payload.nouvelle_date_sortie,
    p_nouvelle_heure_sortie: payload.nouvelle_heure_sortie,
    p_paiement_supplementaire: payload.paiement_supplementaire ?? 0,
    p_mode_paiement: payload.mode_paiement ?? "Espèces",
  });
  if (error) raise(error);
  notifyAsync({
    action: "send",
    type: "prolongation",
    sejour_id: sejourId,
    ancienne_sortie: data?.ancienne_sortie,
    montant_supplementaire: data?.montant_supplementaire,
  });
  return data;
}

