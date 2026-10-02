import { supabase, raise } from "../lib/supabaseClient.js";
import { localStore } from "../lib/localStore.js";
import { todayStr } from "../lib/format.js";

export async function getDashboard() {
  const { data, error } = await supabase.rpc("get_dashboard");
  if (error) raise(error);
  if (!data) return data;

  const today = todayStr();
  const localStays = localStore.listStays({ statut: "en_cours" }).filter((s) => s.local_only);
  const localPayToday = localStore
    .listPayments()
    .filter((p) => p.local_only && String(p.date_paiement || "").slice(0, 10) === today)
    .reduce((acc, p) => acc + Number(p.montant || 0), 0);

  if (localStays.length === 0 && localPayToday === 0) {
    return data;
  }

  const total = Number(data.total_chambres) || 0;
  const occupees = Math.min(total, (Number(data.occupees) || 0) + localStays.length);
  const libres = Math.max(0, (Number(data.libres) || 0) - localStays.length);

  const recettes7j = (data.recettes_7j || []).map((d) => {
    const lp = localStore
      .listPayments()
      .filter((p) => p.local_only && String(p.date_paiement || "").slice(0, 10) === String(d.jour).slice(0, 10))
      .reduce((acc, p) => acc + Number(p.montant || 0), 0);
    return { ...d, montant: Number(d.montant || 0) + lp };
  });

  return {
    ...data,
    occupees,
    libres,
    taux_occupation: total > 0 ? Math.round((occupees / total) * 100) : 0,
    sejours_en_cours: (Number(data.sejours_en_cours) || 0) + localStays.length,
    clients_presents:
      (Number(data.clients_presents) || 0) +
      localStays.reduce((a, s) => a + (Number(s.nb_personnes) || 1), 0),
    recettes_jour:
      data.recettes_jour !== null && data.recettes_jour !== undefined
        ? Number(data.recettes_jour) + localPayToday
        : data.recettes_jour,
    recettes_7j: recettes7j,
    soldes_restants: [
      ...(data.soldes_restants || []),
      ...localStays.filter((s) => Number(s.solde) > 0),
    ],
  };
}
