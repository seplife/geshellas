import { supabase, raise } from "../lib/supabaseClient.js";
import { localStore } from "../lib/localStore.js";

export async function listPayments({ since } = {}) {
  let query = supabase
    .from("paiements")
    .select(
      "*, sejours(id, numero, client_id, chambre_id, chambres(numero), clients(id, nom, prenoms)), reservations(nom_client, chambres(numero))"
    )
    .order("date_paiement", { ascending: false })
    .limit(1000);

  if (since) query = query.gte("date_paiement", since);

  const { data, error } = await query;
  if (error) raise(error);

  const { patches: sejourPatches, deletedIds: deletedSejourIds } =
    localStore.getSejourOverrides();
  const { patches: clientPatches, deletedIds: deletedClientIds } =
    localStore.getClientOverrides();

  const seenPatchedSejours = new Set();

  const remoteList = (data || [])
    .filter((p) => {
      const sid = Number(p.sejour_id || p.sejours?.id || 0);
      const cid = Number(p.sejours?.client_id || p.sejours?.clients?.id || 0);
      if (sid && deletedSejourIds.includes(sid)) return false;
      if (cid && deletedClientIds.includes(cid)) return false;
      const sPatch = sid ? sejourPatches[String(sid)] : null;
      if (sPatch) {
        if (sPatch.montant_paye !== undefined && Number(sPatch.montant_paye) <= 0) {
          return false;
        }
        if (seenPatchedSejours.has(sid)) {
          return false;
        }
        seenPatchedSejours.add(sid);
      }
      return true;
    })
    .map((p) => {
      const sid = Number(p.sejour_id || p.sejours?.id || 0);
      const cid = Number(p.sejours?.client_id || p.sejours?.clients?.id || 0);
      const sPatch = sid ? sejourPatches[String(sid)] || {} : {};
      const cPatch = cid ? clientPatches[String(cid)] || {} : {};
      const sejour = p.sejours;
      const resa = p.reservations;
      const isPassage =
        sPatch.type_climatisation !== undefined ||
        String(sejour?.numero || "").startsWith("PAS-") ||
        /passage/i.test(p.reference || "");

      const clientLabel =
        cPatch.nom || cPatch.prenoms
          ? `${cPatch.nom || sejour?.clients?.nom || ""} ${
              cPatch.prenoms || sejour?.clients?.prenoms || ""
            }`.trim()
          : sPatch.client_nom || sPatch.client_prenoms
            ? `${sPatch.client_nom || sejour?.clients?.nom || ""} ${
                sPatch.client_prenoms || sejour?.clients?.prenoms || ""
              }`.trim()
            : sejour?.clients
              ? `${sejour.clients.nom} ${sejour.clients.prenoms}`.trim()
              : resa?.nom_client || (isPassage ? "Client de passage" : "");

      const chambreNumero =
        sPatch.chambre_numero ||
        sejour?.chambres?.numero ||
        resa?.chambres?.numero ||
        "";
      const origine = sejour?.numero
        ? `${isPassage ? "Passage" : "Séjour"} ${sejour.numero}`
        : resa
          ? "Réservation"
          : "Paiement";

      return {
        ...p,
        montant:
          sPatch.montant_paye !== undefined
            ? Number(sPatch.montant_paye)
            : Number(p.montant),
        mode_paiement: sPatch.mode_paiement || p.mode_paiement,
        reference: sPatch.reference || p.reference,
        type_sejour: isPassage
          ? "passage"
          : sejour
            ? "nuitee"
            : resa
              ? "reservation"
              : "autre",
        type_climatisation: sPatch.type_climatisation || null,
        duree_heures: sPatch.duree_heures || null,
        client_label: clientLabel,
        chambre_numero: chambreNumero,
        origine,
      };
    });

  const localOnly = localStore
    .listPayments({ since })
    .filter((lp) => lp.local_only);

  // Ajouter les éventuels paiements créés lors de la modification d'un passage qui n'avait aucun paiement initial
  for (const [sidStr, sPatch] of Object.entries(sejourPatches)) {
    const sid = Number(sidStr);
    if (
      !deletedSejourIds.includes(sid) &&
      !seenPatchedSejours.has(sid) &&
      !localOnly.some((lp) => Number(lp.sejour_id) === sid) &&
      Number(sPatch.montant_paye) > 0
    ) {
      const payDate = sPatch.updated_at || new Date().toISOString();
      if (!since || payDate >= since) {
        remoteList.push({
          id: `patch-${sid}`,
          sejour_id: sid,
          montant: Number(sPatch.montant_paye),
          mode_paiement: sPatch.mode_paiement || "Espèces",
          reference:
            sPatch.reference ||
            `Passage ${sPatch.duree_heures || 1}h (${
              sPatch.type_climatisation === "ventilee" ? "Ventilée" : "Climatisée"
            })`,
          date_paiement: payDate,
          type_sejour: "passage",
          type_climatisation: sPatch.type_climatisation || "climatisee",
          duree_heures: sPatch.duree_heures || 1,
          client_label: `${sPatch.client_nom || "Client"} ${
            sPatch.client_prenoms || "de passage"
          }`.trim(),
          chambre_numero: sPatch.chambre_numero || "",
          origine: `Passage #${sid}`,
        });
      }
    }
  }

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
