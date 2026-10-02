import { supabase, raise } from "../lib/supabaseClient.js";
import { localStore } from "../lib/localStore.js";
import { getRoomClimatisation, getPassageHoraire } from "../constants.js";
import { invokeFunction } from "./_fn.js";

function notifyAsync(body) {
  invokeFunction("notify", body).catch((err) => {
    console.warn("Notification WhatsApp non envoyée:", err.message);
  });
}

function isMissingRpc(error) {
  const msg = error?.message || "";
  return (
    error?.code === "PGRST202" ||
    error?.code === "42501" ||
    /schema cache|create_passage|extend_passage|update_passage|delete_passage/i.test(msg)
  );
}

export async function listStays({ statut, type_sejour } = {}) {
  let query = supabase
    .from("sejours")
    .select("*, clients(nom, prenoms, telephone), chambres(numero, prix_nuit, type, equipements)")
    .order("created_at", { ascending: false });

  if (statut) query = query.eq("statut", statut);

  const { data, error } = await query;
  if (error) raise(error);

  const { patches, deletedIds } = localStore.getSejourOverrides();

  const remoteList = (data || [])
    .filter((s) => !deletedIds.includes(Number(s.id)))
    .map((s) => {
      const patch = patches[String(s.id)] || {};
      const merged = { ...s, ...patch };
      const isPassage =
        merged.type_sejour === "passage" || String(merged.numero || "").startsWith("PAS-");
      const clim = merged.type_climatisation || getRoomClimatisation(s.chambres);
      return {
        ...merged,
        type_sejour: isPassage ? "passage" : "nuitee",
        type_climatisation: isPassage ? clim : merged.type_climatisation || null,
        tarif_horaire: isPassage
          ? Number(merged.tarif_horaire) || getPassageHoraire(clim)
          : null,
        duree_heures: isPassage
          ? Number(merged.duree_heures) ||
            Math.max(1, Math.round(Number(merged.montant_total || 0) / getPassageHoraire(clim)))
          : null,
        client_nom: patch.client_nom || s.clients?.nom || (isPassage ? "Client" : ""),
        client_prenoms:
          patch.client_prenoms || s.clients?.prenoms || (isPassage ? "de passage" : ""),
        client_telephone: patch.client_telephone || s.clients?.telephone || "",
        chambre_numero: patch.chambre_numero || s.chambres?.numero || "",
        prix_nuit: s.chambres?.prix_nuit || 0,
      };
    });

  // Fusionner les éventuels passages enregistrés en local (repli si migration 0005 non encore jouée)
  const localOnly = localStore
    .listStays({ statut })
    .filter(
      (ls) =>
        ls.local_only &&
        !deletedIds.includes(Number(ls.id)) &&
        !remoteList.some((rs) => rs.numero === ls.numero)
    );

  let merged = [...localOnly, ...remoteList];
  if (type_sejour) {
    merged = merged.filter((s) => s.type_sejour === type_sejour);
  }
  return merged;
}

export async function listPassages({ statut } = {}) {
  return listStays({ statut, type_sejour: "passage" });
}

export async function createPassage(payload) {
  const clim = payload.type_climatisation === "ventilee" ? "ventilee" : "climatisee";
  const duree = Math.max(1, Number(payload.duree_heures) || 1);
  const tarif = clim === "ventilee" ? 2000 : 2500;
  const total = duree * tarif;
  const paye =
    payload.montant_paye !== undefined &&
    payload.montant_paye !== null &&
    payload.montant_paye !== ""
      ? Number(payload.montant_paye)
      : total;

  const { data, error } = await supabase.rpc("create_passage", {
    p_chambre_id: payload.chambre_id,
    p_type_climatisation: clim,
    p_duree_heures: duree,
    p_date_entree: payload.date_entree,
    p_heure_entree: payload.heure_entree,
    p_nb_personnes: payload.nb_personnes ?? 1,
    p_montant_paye: paye,
    p_mode_paiement: payload.mode_paiement ?? "Espèces",
    p_client: payload.client ?? {},
  });

  if (error) {
    if (isMissingRpc(error)) {
      return localStore.createPassage(payload);
    }
    raise(error);
  }
  return data;
}

export async function updatePassage(sejourId, payload) {
  const localList = localStore.listStays();
  const isLocal = localList.some((s) => s.local_only && Number(s.id) === Number(sejourId));
  if (isLocal) {
    return localStore.updatePassage(sejourId, payload);
  }

  const { data, error } = await supabase.rpc("update_passage", {
    p_sejour_id: sejourId,
    p_passage: payload,
  });

  if (error) {
    if (isMissingRpc(error)) {
      return localStore.updatePassage(sejourId, payload);
    }
    raise(error);
  }
  return data;
}

export async function deletePassage(sejourId) {
  const localList = localStore.listStays();
  const isLocal = localList.some((s) => s.local_only && Number(s.id) === Number(sejourId));
  if (isLocal) {
    localStore.deletePassage(sejourId);
    return;
  }

  const { error } = await supabase.rpc("delete_passage", {
    p_sejour_id: sejourId,
  });

  if (error) {
    if (isMissingRpc(error)) {
      localStore.deletePassage(sejourId);
      return;
    }
    raise(error);
  }
}

export async function extendPassage(sejourId, payload = {}) {
  const localList = localStore.listStays();
  const isLocal = localList.some((s) => s.local_only && Number(s.id) === Number(sejourId));
  if (isLocal) {
    return localStore.extendPassage(sejourId, payload);
  }

  const { data, error } = await supabase.rpc("extend_passage", {
    p_sejour_id: sejourId,
    p_heures_supplementaires: Math.max(1, Number(payload.heures_supplementaires) || 1),
    p_paiement_supplementaire: Number(payload.paiement_supplementaire) || 0,
    p_mode_paiement: payload.mode_paiement ?? "Espèces",
  });

  if (error) {
    if (isMissingRpc(error)) {
      return localStore.extendPassage(sejourId, payload);
    }
    raise(error);
  }
  return data;
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
  const localList = localStore.listStays();
  const isLocal = localList.some((s) => s.local_only && Number(s.id) === Number(sejourId));
  if (isLocal) {
    return localStore.checkOut(sejourId, payload);
  }

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
