import React, { useMemo, useState } from "react";
import { Download, Wallet } from "lucide-react";
import StatCard from "../components/ui/StatCard.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { Skeleton } from "../components/ui/Spinner.jsx";
import { fmtFCFA, fmtDateTime, addDays, todayStr } from "../lib/format.js";

const PERIODS = [
  { key: "jour", label: "Aujourd'hui", days: 0 },
  { key: "7j", label: "7 jours", days: 6 },
  { key: "30j", label: "30 jours", days: 29 },
  { key: "tout", label: "Tout", days: null },
];

function sinceFor(period) {
  const p = PERIODS.find((x) => x.key === period);
  if (!p || p.days === null) return null;
  const [y, m, d] = addDays(todayStr(), -p.days).split("-").map(Number);
  return new Date(y, m - 1, d).toISOString(); // minuit heure locale
}

function exportCsv(rows) {
  const header = ["Date", "Client", "Chambre", "Origine", "Mode", "Référence", "Montant (FCFA)"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((p) =>
    [fmtDateTime(p.date_paiement), p.client_label, p.chambre_numero, p.origine, p.mode_paiement, p.reference, Math.round(p.montant)].map(esc).join(";")
  );
  const blob = new Blob(["﻿" + [header.map(esc).join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `paiements-hellas-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function PaymentsPage({ payments, error, onRetry, onPeriod, initialPeriod = "tout" }) {
  const [period, setPeriod] = useState(initialPeriod);

  const choose = (key) => {
    setPeriod(key);
    onPeriod(sinceFor(key), key);
  };

  const list = useMemo(() => payments || [], [payments]);
  const total = list.reduce((a, p) => a + Number(p.montant), 0);
  const byMode = useMemo(() => {
    const acc = {};
    for (const p of list) acc[p.mode_paiement] = (acc[p.mode_paiement] || 0) + Number(p.montant);
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [list]);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <PageHeader
        title="Paiements"
        subtitle="Encaissements des séjours et avances de réservation."
        actions={list.length > 0 && <Button variant="subtle" icon={Download} onClick={() => exportCsv(list)}>Exporter CSV</Button>}
      />

      <div className="flex gap-2 flex-wrap">
        {PERIODS.map((p) => (
          <button type="button" key={p.key} className={`chip ${period === p.key ? "chip-active" : ""}`} onClick={() => choose(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!payments ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total encaissé" value={fmtFCFA(total)} icon={Wallet} tone="brand" hint={`${list.length} opération(s)`} />
            {byMode.slice(0, 3).map(([mode, montant]) => (
              <StatCard key={mode} label={mode} value={fmtFCFA(montant)} hint={`${Math.round((montant / (total || 1)) * 100)}% du total`} />
            ))}
          </div>

          {list.length === 0 ? (
            <EmptyState icon={Wallet} title="Aucun paiement sur cette période." />
          ) : (
            <div className="card overflow-hidden overflow-x-auto">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Chambre</th>
                    <th className="hidden md:table-cell">Origine</th>
                    <th>Mode</th>
                    <th className="text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap text-stone-500 dark:text-stone-400">{fmtDateTime(p.date_paiement)}</td>
                      <td>{p.client_label || "—"}</td>
                      <td>{p.chambre_numero || "—"}</td>
                      <td className="hidden md:table-cell text-stone-500 dark:text-stone-400">
                        {p.origine}{p.reference ? ` · ${p.reference}` : ""}
                      </td>
                      <td className="whitespace-nowrap">{p.mode_paiement}</td>
                      <td className="text-right font-semibold tabular-nums whitespace-nowrap">{fmtFCFA(p.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
