import { supabase, raise } from "../lib/supabaseClient.js";
import { localStore } from "../lib/localStore.js";

export async function listPayments({ since } = {}) {
  let query = supabase
    .from("paiements")
    .select("*, sejours(numero, chambres(numero), clients(nom, prenoms)), reservations(nom_client, chambres(numero))")
    .order("date_paiement", { ascending: false })
    .limit(1000);

  if (since) query = query.gte("date_paiement", since);

  const { data, error } = await query;
  if (error) raise(error);

  const remoteList = (data || []).map((p) => {
    const sejour = p.sejours;
    const resa = p.reservations;
    const isPassage =
      String(sejour?.numero || "").startsWith("PAS-") ||
      /passage/i.test(p.reference || "");
    const clientLabel = sejour?.clients
      ? `${sejour.clients.nom} ${sejour.clients.prenoms}`.trim()
      : resa?.nom_client || (isPassage ? "Client de passage" : "");
    const chambreNumero = sejour?.chambres?.numero || resa?.chambres?.numero || "";
    const origine = sejour?.numero
      ? `${isPassage ? "Passage" : "Séjour"} ${sejour.numero}`
      : resa
        ? "Réservation"
        : "Paiement";
    return {
      ...p,
      type_sejour: isPassage ? "passage" : sejour ? "nuitee" : resa ? "reservation" : "autre",
      client_label: clientLabel,
      chambre_numero: chambreNumero,
      origine,
    };
  });

  const localOnly = localStore
    .listPayments({ since })
    .filter((lp) => lp.local_only);

  return [...localOnly, ...remoteList].sort((a, b) =>
    String(b.date_paiement || "").localeCompare(String(a.date_paiement || ""))
  );
}

export async function recordPayment(payload) {
  const localStays = localStore.listStays();
  const isLocal = localStays.some((s) => s.local_only && Number(s.id) === Number(payload.sejour_id));
  if (isLocal) {
    return localStore.recordPayment(payload);
  }

  const { data, error } = await supabase.rpc("record_payment", {
    p_sejour_id: payload.sejour_id,
    p_montant: payload.montant,
    p_mode_paiement: payload.mode_paiement,
    p_reference: payload.reference || null,
  });
  if (error) raise(error);
  return data;
}
