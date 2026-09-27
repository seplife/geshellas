import React from "react";
import StatCard from "../components/ui/StatCard.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { fmtFCFA, fmtDateTime } from "../lib/format.js";

export default function PaymentsPage({ payments }) {
  const total = payments.reduce((a, p) => a + Number(p.montant), 0);

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-brand-700 dark:text-brand-100">Paiements</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">Suivi financier des séjours.</p>
      </div>
      <StatCard label="Total encaissé" value={fmtFCFA(total)} accent="#1F5D50" />

      {payments.length === 0 ? (
        <EmptyState title="Aucun paiement enregistré." />
      ) : (
        <div className="card rounded-2xl overflow-hidden overflow-x-auto">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Chambre</th>
                <th>Mode</th>
                <th className="text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(p.date_paiement)}</td>
                  <td>{p.client_nom ? `${p.client_nom} ${p.client_prenoms}` : "—"}</td>
                  <td>{p.chambre_numero || "—"}</td>
                  <td>{p.mode_paiement}</td>
                  <td className="text-right font-medium">{fmtFCFA(p.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
