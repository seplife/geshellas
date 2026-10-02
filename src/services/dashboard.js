import { supabase, raise } from "../lib/supabaseClient.js";
import { localStore } from "../lib/localStore.js";
import { addDays, todayStr } from "../lib/format.js";
import { listPayments } from "./payments.js";

export async function getDashboard() {
  const { data, error } = await supabase.rpc("get_dashboard");
  if (error) raise(error);
  if (!data) return data;

  const today = todayStr();
  const { patches: sejourPatches, deletedIds: deletedSejourIds } =
    localStore.getSejourOverrides();
  const { patches: clientPatches, deletedIds: deletedClientIds } =
    localStore.getClientOverrides();

  const localStays = localStore
    .listStays({ statut: "en_cours" })
    .filter((s) => s.local_only);

  const filterAndPatchStayList = (list = []) =>
    list
      .filter(
        (s) =>
          !deletedSejourIds.includes(Number(s.id)) &&
          !deletedClientIds.includes(Number(s.client_id || 0))
      )
      .map((s) => {
        const sp = sejourPatches[String(s.id)] || {};
        const cp = s.client_id ? clientPatches[String(s.client_id)] || {} : {};
        return {
          ...s,
          ...sp,
          nom: cp.nom || sp.client_nom || s.nom,
          prenoms: cp.prenoms || sp.client_prenoms || s.prenoms,
          telephone: cp.telephone || sp.client_telephone || s.telephone,
          chambre: sp.chambre_numero || s.chambre,
          solde: sp.solde !== undefined ? Number(sp.solde) : Number(s.solde || 0),
        };
      });

  let recettesJour = data.recettes_jour;
  let recettes7j = data.recettes_7j || [];

  // Recalculer les recettes des 7 derniers jours à partir des paiements consolidés
  if (data.recettes_jour !== null && data.recettes_jour !== undefined) {
    try {
      const sinceIso = new Date(`${addDays(today, -7)}T00:00:00`).toISOString();
      const recentPayments = await listPayments({ since: sinceIso });
      recettesJour = recentPayments
        .filter((p) => String(p.date_paiement || "").slice(0, 10) === today)
        .reduce((acc, p) => acc + Number(p.montant || 0), 0);

      recettes7j = (data.recettes_7j || []).map((d) => {
        const dayStr = String(d.jour).slice(0, 10);
        const dayTotal = recentPayments
          .filter((p) => String(p.date_paiement || "").slice(0, 10) === dayStr)
          .reduce((acc, p) => acc + Number(p.montant || 0), 0);
        return { ...d, montant: dayTotal };
      });
    } catch {
      /* garder les valeurs RPC en cas d'erreur réseau */
    }
  }

  const total = Number(data.total_chambres) || 0;
  const occupees = Math.min(total, (Number(data.occupees) || 0) + localStays.length);
  const libres = Math.max(0, (Number(data.libres) || 0) - localStays.length);

  const soldesRestants = [
    ...filterAndPatchStayList(data.soldes_restants).filter((s) => Number(s.solde) > 0),
    ...localStays
      .filter((s) => Number(s.solde) > 0)
      .map((s) => ({
        id: s.id,
        numero: s.numero,
        solde: s.solde,
        nom: s.client_nom,
        prenoms: s.client_prenoms,
        telephone: s.client_telephone,
        chambre: s.chambre_numero,
      })),
  ];

  return {
    ...data,
    occupees,
    libres,
    taux_occupation: total > 0 ? Math.round((occupees / total) * 100) : 0,
    sejours_en_cours: Math.max(
      0,
      (Number(data.sejours_en_cours) || 0) + localStays.length
    ),
    clients_presents: Math.max(
      0,
      (Number(data.clients_presents) || 0) +
        localStays.reduce((a, s) => a + (Number(s.nb_personnes) || 1), 0)
    ),
    recettes_jour: recettesJour,
    recettes_7j: recettes7j,
    sejours_en_retard: filterAndPatchStayList(data.sejours_en_retard),
    departs_prevus: filterAndPatchStayList(data.departs_prevus),
    soldes_restants: soldesRestants,
  };
}
