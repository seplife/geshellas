import { supabase, raise } from "../lib/supabaseClient.js";
import { localStore } from "../lib/localStore.js";
import { getRoomClimatisation, getPassageHoraire } from "../constants.js";

export async function listRooms() {
  const { data, error } = await supabase
    .from("chambres")
    .select("*")
    .order("numero", { ascending: true });
  if (error) raise(error);

  const localRooms = localStore.listRooms();
  const activeLocalStays = localStore.listStays({ statut: "en_cours" }).filter((s) => s.local_only);

  return (data || []).map((r) => {
    const clim = getRoomClimatisation(r);
    const hasLocalActive = activeLocalStays.some((s) => Number(s.chambre_id) === Number(r.id));
    const localRoom = localRooms.find((lr) => Number(lr.id) === Number(r.id) || lr.numero === r.numero);
    let statut = r.statut;
    if (hasLocalActive && statut === "libre") {
      statut = "occupee";
    } else if (!hasLocalActive && localRoom?.statut === "nettoyage" && statut === "libre") {
      statut = "nettoyage";
    }
    return {
      ...r,
      statut,
      climatisation: clim,
      prix_passage_heure: getPassageHoraire(clim),
    };
  });
}

export async function validerNettoyage(roomId) {
  try {
    localStore.validerNettoyage(roomId);
  } catch {
    /* ignore if not in localStore */
  }
  const { error } = await supabase.rpc("valider_nettoyage", { p_chambre_id: roomId });
  if (error) {
    // Si la chambre était uniquement en nettoyage côté local (passage local), ignorer l'erreur 23514
    if (error.code === "23514") return;
    raise(error);
  }
}

export async function signalerAnomalie(roomId, description) {
  const { error } = await supabase.rpc("signaler_anomalie", {
    p_chambre_id: roomId,
    p_description: description,
  });
  if (error) raise(error);
}

export async function createRoom(room) {
  const { data, error } = await supabase.rpc("create_room", { p_room: room });
  if (error) raise(error);
  return data;
}

export async function updateRoom(id, patch) {
  const { data, error } = await supabase.rpc("update_room", { p_id: id, p_room: patch });
  if (error) raise(error);
  return data;
}

export async function deleteRoom(id) {
  const { error } = await supabase.rpc("delete_room", { p_id: id });
  if (error) {
    // Repli sur DELETE direct si la fonction RPC delete_room n'a pas encore été créée
    if (error.code === "PGRST202" || /delete_room/i.test(error.message || "")) {
      const { error: delErr } = await supabase.from("chambres").delete().eq("id", id);
      if (delErr) raise(delErr);
      return;
    }
    raise(error);
  }
}

export function subscribeHotel(onChange, onStatus) {
  // En développement local, on utilise un rafraîchissement périodique pour éviter
  // l'avertissement de cookie Cloudflare (__cf_bm) sur le WebSocket dans Firefox.
  if (import.meta.env.DEV) {
    onStatus?.(true);
    const id = setInterval(() => {
      onChange("chambres", {});
    }, 20_000);
    return () => clearInterval(id);
  }

  const channel = supabase
    .channel("hotel-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "chambres" }, (p) => onChange("chambres", p))
    .on("postgres_changes", { event: "*", schema: "public", table: "sejours" }, (p) => onChange("sejours", p))
    .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, (p) => onChange("reservations", p))
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (p) => onChange("notifications", p))
    .subscribe((status) => onStatus?.(status === "SUBSCRIBED"));

  return () => {
    supabase.removeChannel(channel);
  };
}

export const subscribeRooms = subscribeHotel;
