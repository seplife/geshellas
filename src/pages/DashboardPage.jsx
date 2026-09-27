import React from "react";
import StatCard from "../components/ui/StatCard.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import { fmtFCFA, fmtDate } from "../lib/format.js";

export default function DashboardPage({ dashboard }) {
  if (!dashboard) return <Spinner label="Chargement du tableau de bord…" />;
  const m = dashboard;
  const hasAlerts = m.sejours_en_retard.length > 0 || m.soldes_restants.length > 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-brand-700 dark:text-brand-100">Tableau de bord</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">Vue d'ensemble en temps réel de l'Hôtel Hellas.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Chambres au total" value={m.total_chambres} />
        <StatCard label="Libres" value={m.libres} accent="#2F9E63" />
        <StatCard label="Occupées" value={m.occupees} accent="#D64545" />
        <StatCard label="Réservées" value={m.reservees} accent="#C98A2C" />
        <StatCard label="En nettoyage" value={m.nettoyage} accent="#2F80C7" />
        <StatCard label="En maintenance" value={m.maintenance} accent="#78716c" />
        <StatCard label="Clients présents" value={m.clients_presents} />
        <StatCard label="Taux d'occupation" value={`${m.taux_occupation}%`} accent="#1F5D50" />
        <StatCard label="Arrivées aujourd'hui" value={m.arrivees_jour} />
        <StatCard label="Départs prévus" value={m.departs_jour} />
        <StatCard label="Recettes du jour" value={fmtFCFA(m.recettes_jour)} accent="#C98A2C" />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-2 text-brand-700 dark:text-brand-100">Alertes</h2>
        <div className="flex flex-col gap-2">
          {!hasAlerts && (
            <div className="text-sm rounded-xl p-3 bg-brand-50 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100">
              ✅ Aucune alerte pour le moment.
            </div>
          )}
          {m.sejours_en_retard.map((s) => (
            <div key={`retard-${s.id}`} className="text-sm rounded-xl p-3 bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
              ⏰ Sortie dépassée — {s.client_nom} {s.client_prenoms}, chambre {s.chambre_numero} (prévue{" "}
              {fmtDate(s.date_sortie_prevue)} {s.heure_sortie_prevue})
            </div>
          ))}
          {m.soldes_restants.map((s) => (
            <div key={`solde-${s.id}`} className="text-sm rounded-xl p-3 bg-ochre-100 text-ochre-700 dark:bg-ochre-500/10 dark:text-ochre-200">
              💰 Solde restant de {fmtFCFA(s.solde)} — {s.client_nom} {s.client_prenoms}, chambre {s.chambre_numero}.
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
