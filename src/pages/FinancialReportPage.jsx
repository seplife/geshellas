import React, { useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  BedDouble,
  Printer,
  TrendingUp,
  Wallet,
  Fan,
  Snowflake,
} from "lucide-react";
import StatCard from "../components/ui/StatCard.jsx";
import Button from "../components/ui/Button.jsx";
import { Select } from "../components/ui/Field.jsx";
import { Pill } from "../components/ui/Badge.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { Skeleton } from "../components/ui/Spinner.jsx";
import {
  fmtFCFA,
  fmtShortFCFA,
  fmtDateTime,
  fmtDateShort,
  MONTH_NAMES,
} from "../lib/format.js";

function exportMonthCsv(report) {
  if (!report?.selectedMonth) return;
  const m = report.selectedMonth;
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const summaryRows = [
    ["RAPPORT FINANCIER MENSUEL — HELLAS HÔTEL (DIVO)", m.label],
    [],
    ["Indicateur", "Montant (FCFA)", "Détail"],
    ["Recettes totales du mois", Math.round(m.total_recettes), `${m.nb_paiements} opération(s)`],
    ["Recettes Séjours (Nuitées)", Math.round(m.recettes_nuitees), `${m.nb_sejours_nuitee} séjour(s) / ${m.nb_nuits_vendues} nuit(s)`],
    ["Recettes Passages (Total)", Math.round(m.recettes_passages), `${m.nb_passages} passage(s) / ${m.heures_passages} heure(s)`],
    ["  - Passages Chambres ventilées (2 000 FCFA/h)", Math.round(m.recettes_passages_ventilee), `${m.nb_passages_ventilee} passage(s)`],
    ["  - Passages Chambres climatisées (2 500 FCFA/h)", Math.round(m.recettes_passages_climatisee), `${m.nb_passages_climatisee} passage(s)`],
    ["Avances de réservations", Math.round(m.recettes_reservations), ""],
    ["Moyenne journalière", Math.round(m.moyenne_journaliere), ""],
    ["Impayés (soldes restants du mois)", Math.round(m.impayes_mois), ""],
    [],
    ["DÉTAIL DES ENCAISSEMENTS DU MOIS"],
    ["Date", "Client", "Chambre", "Catégorie", "Origine", "Mode de paiement", "Référence", "Montant (FCFA)"],
  ];

  const txRows = (m.paiements || []).map((p) => [
    fmtDateTime(p.date_paiement),
    p.client_label || "—",
    p.chambre_numero || "—",
    p.type_sejour === "passage"
      ? `Passage (${p.type_climatisation === "ventilee" ? "Ventilée 2000F/h" : "Climatisée 2500F/h"})`
      : p.type_sejour === "reservation"
        ? "Réservation"
        : "Nuitée",
    p.origine || "",
    p.mode_paiement || "",
    p.reference || "",
    Math.round(Number(p.montant) || 0),
  ]);

  const csvContent = [...summaryRows, ...txRows]
    .map((row) => row.map(esc).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rapport-financier-${m.year}-${String(m.month).padStart(2, "0")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportAnnualCsv(report) {
  if (!report?.annualMonths) return;
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "Mois",
    "Séjours Nuitées (FCFA)",
    "Passages Ventilées 2000F/h (FCFA)",
    "Passages Climatisées 2500F/h (FCFA)",
    "Total Passages (FCFA)",
    "Avances Réservations (FCFA)",
    "Nb Opérations",
    "Total Mois (FCFA)",
  ];
  const rows = report.annualMonths.map((m) => [
    `${m.label} ${report.year}`,
    Math.round(m.recettes_nuitees),
    Math.round(m.recettes_passages_ventilee),
    Math.round(m.recettes_passages_climatisee),
    Math.round(m.recettes_passages),
    Math.round(m.recettes_reservations),
    m.nb_paiements,
    Math.round(m.total),
  ]);
  rows.push([
    `TOTAL ${report.year}`,
    Math.round(report.annualNuitees),
    Math.round(report.annualMonths.reduce((a, x) => a + x.recettes_passages_ventilee, 0)),
    Math.round(report.annualMonths.reduce((a, x) => a + x.recettes_passages_climatisee, 0)),
    Math.round(report.annualPassages),
    Math.round(report.annualReservations),
    report.annualMonths.reduce((a, x) => a + x.nb_paiements, 0),
    Math.round(report.annualTotal),
  ]);

  const csvContent = [header, ...rows].map((r) => r.map(esc).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rapport-annuel-hellas-${report.year}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function FinancialReportPage({
  report,
  error,
  onRetry,
  selectedYear,
  selectedMonth,
  onChangePeriod,
}) {
  const [txFilter, setTxFilter] = useState("tous");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const years = useMemo(() => {
    const base = new Set([currentYear - 2, currentYear - 1, currentYear, currentYear + 1]);
    if (selectedYear) base.add(Number(selectedYear));
    return [...base].sort((a, b) => b - a);
  }, [currentYear, selectedYear]);

  const goPrevMonth = () => {
    if (selectedMonth <= 1) {
      onChangePeriod(selectedYear - 1, 12);
    } else {
      onChangePeriod(selectedYear, selectedMonth - 1);
    }
  };

  const goNextMonth = () => {
    if (selectedMonth >= 12) {
      onChangePeriod(selectedYear + 1, 1);
    } else {
      onChangePeriod(selectedYear, selectedMonth + 1);
    }
  };

  const m = report?.selectedMonth;
  const annualMonths = useMemo(() => report?.annualMonths || [], [report]);

  const filteredTx = useMemo(() => {
    const list = m?.paiements || [];
    if (txFilter === "tous") return list;
    return list.filter((p) => p.type_sejour === txFilter);
  }, [m, txFilter]);

  const maxAnnualMonth = useMemo(
    () => Math.max(...annualMonths.map((x) => Number(x.total) || 0), 1),
    [annualMonths]
  );

  const maxDayRevenue = useMemo(
    () => Math.max(...(m?.par_jour || []).map((d) => Number(d.total) || 0), 1),
    [m]
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Rapport financier par mois"
        subtitle="Analyse mensuelle et annuelle des recettes : nuitées, passages à l'heure et réservations."
        actions={
          m && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="subtle"
                icon={Download}
                onClick={() => exportMonthCsv(report)}
              >
                CSV du mois
              </Button>
              <Button
                variant="subtle"
                icon={Download}
                onClick={() => exportAnnualCsv(report)}
              >
                CSV annuel
              </Button>
              <Button
                variant="subtle"
                icon={Printer}
                onClick={() => window.print()}
              >
                Imprimer
              </Button>
            </div>
          )
        }
      />

      {/* Barre de sélection du mois et de l'année */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand-600 dark:text-ochre-300" />
          <span className="font-semibold font-display text-base">
            Période : {MONTH_NAMES[(selectedMonth || 1) - 1]} {selectedYear}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-icon border border-stone-200 dark:border-brand-700"
            onClick={goPrevMonth}
            title="Mois précédent"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <Select
            value={selectedMonth}
            onChange={(e) => onChangePeriod(selectedYear, Number(e.target.value))}
            className="w-auto min-w-[140px]"
            aria-label="Sélectionner le mois"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </Select>

          <Select
            value={selectedYear}
            onChange={(e) => onChangePeriod(Number(e.target.value), selectedMonth)}
            className="w-auto min-w-[100px]"
            aria-label="Sélectionner l'année"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>

          <button
            type="button"
            className="btn-icon border border-stone-200 dark:border-brand-700"
            onClick={goNextMonth}
            title="Mois suivant"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {(selectedYear !== currentYear || selectedMonth !== currentMonth) && (
            <Button
              size="sm"
              variant="subtle"
              onClick={() => onChangePeriod(currentYear, currentMonth)}
            >
              Mois en cours
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!report || !m ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* KPIs du mois sélectionné */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label={`Recettes — ${m.label}`}
              value={fmtFCFA(m.total_recettes)}
              icon={Wallet}
              tone="brand"
              hint={
                m.evolution_pct !== null
                  ? `${m.evolution_pct >= 0 ? "+" : ""}${m.evolution_pct}% vs mois préc. (${m.nb_paiements} op.)`
                  : `${m.nb_paiements} encaissement(s)`
              }
            />
            <StatCard
              label="Séjours (Nuitées)"
              value={fmtFCFA(m.recettes_nuitees)}
              icon={BedDouble}
              tone="green"
              hint={`${m.nb_sejours_nuitee} séjour(s) · ${m.nb_nuits_vendues} nuit(s)`}
            />
            <StatCard
              label="Passages (À l'heure)"
              value={fmtFCFA(m.recettes_passages)}
              icon={Clock}
              tone="ochre"
              hint={`${m.nb_passages} passage(s) · ${m.heures_passages} heure(s)`}
            />
            <StatCard
              label="Moyenne / jour"
              value={fmtFCFA(m.moyenne_journaliere)}
              icon={TrendingUp}
              tone="blue"
              hint={
                m.impayes_mois > 0
                  ? `Impayés du mois : ${fmtFCFA(m.impayes_mois)}`
                  : "Aucun impayé sur ce mois"
              }
            />
          </div>

          {/* Graphiques : 1) Comparatif des 12 mois de l'année  2) Évolution jour par jour du mois */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Graphique des 12 mois */}
            <div className="card p-5 flex flex-col">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="section-title">
                    Recettes par mois — Année {report.year}
                  </h2>
                  <p className="text-xs text-stone-500">
                    Cliquez sur un mois pour afficher son détail
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  Total {report.year} : {fmtFCFA(report.annualTotal)}
                </span>
              </div>

              <div className="relative h-44 flex items-end gap-1.5 sm:gap-2 border-b border-stone-200 dark:border-brand-700 pt-6">
                {annualMonths.map((am) => {
                  const isSelected = am.month === selectedMonth;
                  const val = Number(am.total) || 0;
                  return (
                    <button
                      key={am.month}
                      type="button"
                      onClick={() => onChangePeriod(selectedYear, am.month)}
                      className="group relative flex-1 h-full flex flex-col justify-end items-center focus:outline-none"
                      title={`${am.label} ${report.year} : ${fmtFCFA(val)}`}
                    >
                      <div className="pointer-events-none absolute -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap rounded-lg bg-stone-900 text-white text-xs px-2 py-1 shadow-pop dark:bg-stone-100 dark:text-stone-900">
                        {am.label} : {fmtFCFA(val)}
                      </div>
                      <div
                        className={`w-full max-w-[30px] rounded-t transition-all ${
                          isSelected
                            ? "bg-ochre-500 dark:bg-ochre-400 ring-2 ring-ochre-400/40"
                            : "bg-brand-300 dark:bg-brand-600 group-hover:bg-brand-500"
                        }`}
                        style={{
                          height:
                            val > 0
                              ? `${Math.max(4, (val / maxAnnualMonth) * 100)}%`
                              : "2px",
                        }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1.5 sm:gap-2 mt-2">
                {annualMonths.map((am) => {
                  const isSelected = am.month === selectedMonth;
                  return (
                    <button
                      key={am.month}
                      type="button"
                      onClick={() => onChangePeriod(selectedYear, am.month)}
                      className={`flex-1 text-center rounded py-0.5 ${
                        isSelected
                          ? "font-bold text-brand-700 dark:text-ochre-300 bg-brand-50 dark:bg-brand-800"
                          : "text-stone-500"
                      }`}
                    >
                      <div className="text-[10px]">{am.shortLabel}</div>
                      <div className="text-[9px] text-stone-400 tabular-nums hidden sm:block">
                        {fmtShortFCFA(am.total)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Graphique journalier du mois sélectionné */}
            <div className="card p-5 flex flex-col">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="section-title">
                    Recettes journalières — {m.label}
                  </h2>
                  <p className="text-xs text-stone-500">
                    Nuitées et passages jour par jour
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {fmtFCFA(m.total_recettes)}
                </span>
              </div>

              <div className="relative h-44 flex items-end gap-0.5 sm:gap-1 border-b border-stone-200 dark:border-brand-700 pt-6">
                {m.par_jour.map((d) => {
                  const v = Number(d.total) || 0;
                  return (
                    <div
                      key={d.jour}
                      className="group relative flex-1 h-full flex flex-col justify-end items-center"
                    >
                      <div className="pointer-events-none absolute -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap rounded-lg bg-stone-900 text-white text-xs px-2 py-1 shadow-pop dark:bg-stone-100 dark:text-stone-900">
                        {fmtDateShort(d.jour)} : {fmtFCFA(v)}
                        {d.passages > 0 && ` (Passages: ${fmtFCFA(d.passages)})`}
                      </div>
                      <div
                        className="w-full rounded-t bg-brand-500 dark:bg-brand-300 group-hover:bg-ochre-500 transition-colors"
                        style={{
                          height:
                            v > 0
                              ? `${Math.max(4, (v / maxDayRevenue) * 100)}%`
                              : "2px",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-stone-400 mt-2">
                <span>1er {MONTH_NAMES[selectedMonth - 1].toLowerCase()}</span>
                <span>15 {MONTH_NAMES[selectedMonth - 1].toLowerCase()}</span>
                <span>
                  {m.par_jour.length} {MONTH_NAMES[selectedMonth - 1].toLowerCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Ventilation du mois : Par source (Nuitées vs Passages 2000/2500) & Par mode de paiement */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Par source de revenus */}
            <div className="card p-5 flex flex-col gap-4">
              <h2 className="section-title">
                Répartition par type de prestation — {m.label}
              </h2>
              <div className="flex flex-col gap-3">
                {[
                  {
                    label: "Séjours classiques (Nuitées)",
                    sub: `${m.nb_sejours_nuitee} séjour(s) · ${m.nb_nuits_vendues} nuit(s)`,
                    montant: m.recettes_nuitees,
                    icon: BedDouble,
                    bar: "bg-brand-600",
                  },
                  {
                    label: "Passages — Chambres climatisées (2 500 FCFA/h)",
                    sub: `${m.nb_passages_climatisee} passage(s) enregistré(s)`,
                    montant: m.recettes_passages_climatisee,
                    icon: Snowflake,
                    bar: "bg-sky-500",
                  },
                  {
                    label: "Passages — Chambres ventilées (2 000 FCFA/h)",
                    sub: `${m.nb_passages_ventilee} passage(s) enregistré(s)`,
                    montant: m.recettes_passages_ventilee,
                    icon: Fan,
                    bar: "bg-amber-500",
                  },
                  {
                    label: "Avances de réservations",
                    sub: "Acomptes encaissés sur réservations",
                    montant: m.recettes_reservations,
                    icon: Calendar,
                    bar: "bg-emerald-500",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const pct =
                    m.total_recettes > 0
                      ? Math.round((item.montant / m.total_recettes) * 100)
                      : 0;
                  return (
                    <div
                      key={item.label}
                      className="p-3 rounded-xl bg-stone-50 dark:bg-brand-900/40 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="h-4 w-4 text-stone-500 shrink-0" />
                          <span className="font-medium truncate">{item.label}</span>
                        </div>
                        <span className="font-semibold tabular-nums whitespace-nowrap">
                          {fmtFCFA(item.montant)}{" "}
                          <span className="text-xs font-normal text-stone-400">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="text-xs text-stone-500">{item.sub}</div>
                      <div className="h-1.5 w-full rounded-full bg-stone-200 dark:bg-brand-800 overflow-hidden">
                        <div
                          className={`h-full ${item.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Par mode de paiement */}
            <div className="card p-5 flex flex-col gap-4">
              <h2 className="section-title">
                Encaissements par mode de paiement — {m.label}
              </h2>
              {m.par_mode.length === 0 ? (
                <p className="text-sm text-stone-500">
                  Aucun encaissement enregistré sur ce mois.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {m.par_mode.map((pm) => (
                    <div
                      key={pm.mode}
                      className="p-3 rounded-xl bg-stone-50 dark:bg-brand-900/40 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{pm.mode}</span>
                        <span className="font-semibold tabular-nums">
                          {fmtFCFA(pm.montant)}{" "}
                          <span className="text-xs font-normal text-stone-400">
                            ({pm.pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="text-xs text-stone-500">
                        {pm.count} transaction(s)
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-stone-200 dark:bg-brand-800 overflow-hidden">
                        <div
                          className="h-full bg-ochre-500"
                          style={{ width: `${pm.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tableau récapitulatif des 12 mois de l'année */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-stone-100 dark:border-brand-700 flex items-center justify-between">
              <div>
                <h2 className="section-title">
                  Bilan financier mensuel — Année {report.year}
                </h2>
                <p className="text-xs text-stone-500">
                  Synthèse mois par mois des nuitées, passages (ventilées 2 000 F/h & climatisées 2 500 F/h) et réservations
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th className="text-right">Séjours (Nuitées)</th>
                    <th className="text-right">Passages Ventilées (2 000 F/h)</th>
                    <th className="text-right">Passages Climatisées (2 500 F/h)</th>
                    <th className="text-right">Total Passages</th>
                    <th className="text-right">Réservations</th>
                    <th className="text-center">Opérations</th>
                    <th className="text-right">Total du mois</th>
                  </tr>
                </thead>
                <tbody>
                  {annualMonths.map((am) => {
                    const isSelected = am.month === selectedMonth;
                    return (
                      <tr
                        key={am.month}
                        onClick={() => onChangePeriod(selectedYear, am.month)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-brand-50/90 dark:bg-brand-700/40 font-medium"
                            : "hover:bg-stone-50 dark:hover:bg-brand-800/40"
                        }`}
                      >
                        <td className="whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            {isSelected && (
                              <span className="h-2 w-2 rounded-full bg-ochre-500" />
                            )}
                            {am.label} {report.year}
                          </span>
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {fmtFCFA(am.recettes_nuitees)}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {fmtFCFA(am.recettes_passages_ventilee)}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {fmtFCFA(am.recettes_passages_climatisee)}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap font-medium text-ochre-700 dark:text-ochre-300">
                          {fmtFCFA(am.recettes_passages)}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {fmtFCFA(am.recettes_reservations)}
                        </td>
                        <td className="text-center tabular-nums">
                          {am.nb_paiements}
                        </td>
                        <td className="text-right font-semibold tabular-nums whitespace-nowrap">
                          {fmtFCFA(am.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-100/80 dark:bg-brand-900 font-bold border-t-2 border-stone-200 dark:border-brand-600">
                    <td>TOTAL ANNUEL {report.year}</td>
                    <td className="text-right tabular-nums whitespace-nowrap">
                      {fmtFCFA(report.annualNuitees)}
                    </td>
                    <td className="text-right tabular-nums whitespace-nowrap">
                      {fmtFCFA(
                        annualMonths.reduce(
                          (a, x) => a + x.recettes_passages_ventilee,
                          0
                        )
                      )}
                    </td>
                    <td className="text-right tabular-nums whitespace-nowrap">
                      {fmtFCFA(
                        annualMonths.reduce(
                          (a, x) => a + x.recettes_passages_climatisee,
                          0
                        )
                      )}
                    </td>
                    <td className="text-right tabular-nums whitespace-nowrap text-ochre-700 dark:text-ochre-300">
                      {fmtFCFA(report.annualPassages)}
                    </td>
                    <td className="text-right tabular-nums whitespace-nowrap">
                      {fmtFCFA(report.annualReservations)}
                    </td>
                    <td className="text-center tabular-nums">
                      {annualMonths.reduce((a, x) => a + x.nb_paiements, 0)}
                    </td>
                    <td className="text-right tabular-nums whitespace-nowrap text-brand-700 dark:text-ochre-300">
                      {fmtFCFA(report.annualTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Performance par chambre sur le mois */}
          {m.par_chambre.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-stone-100 dark:border-brand-700">
                <h2 className="section-title">
                  Recettes par chambre — {m.label}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Chambre</th>
                      <th>Type & Climatisation</th>
                      <th className="text-center">Séjours (Nuits)</th>
                      <th className="text-center">Passages (Heures)</th>
                      <th className="text-right">Recettes Nuitées</th>
                      <th className="text-right">Recettes Passages</th>
                      <th className="text-right">Total encaissé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.par_chambre.map((rc) => {
                      const isVent = rc.climatisation === "ventilee";
                      return (
                        <tr key={rc.id}>
                          <td className="font-semibold">Chambre {rc.numero}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span>{rc.type}</span>
                              <Pill tone={isVent ? "ochre" : "blue"}>
                                {isVent ? "Ventilée · 2 000 F/h" : "Climatisée · 2 500 F/h"}
                              </Pill>
                            </div>
                          </td>
                          <td className="text-center tabular-nums">
                            {rc.nb_sejours} ({rc.nuits_vendues} n.)
                          </td>
                          <td className="text-center tabular-nums">
                            {rc.nb_passages} ({rc.heures_passages} h)
                          </td>
                          <td className="text-right tabular-nums">
                            {fmtFCFA(rc.recettes_nuitees)}
                          </td>
                          <td className="text-right tabular-nums">
                            {fmtFCFA(rc.recettes_passages)}
                          </td>
                          <td className="text-right font-semibold tabular-nums">
                            {fmtFCFA(rc.recettes)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Journal détaillé des encaissements du mois */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-stone-100 dark:border-brand-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="section-title">
                  Journal des encaissements — {m.label}
                </h2>
                <p className="text-xs text-stone-500">
                  {filteredTx.length} opération(s) affichée(s)
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "tous", label: "Tout" },
                  { key: "nuitee", label: "Nuitées" },
                  { key: "passage", label: "Passages" },
                  { key: "reservation", label: "Réservations" },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`chip ${txFilter === f.key ? "chip-active" : ""}`}
                    onClick={() => setTxFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTx.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={BarChart3}
                  title={`Aucun encaissement pour ${m.label}.`}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Date & Heure</th>
                      <th>Client</th>
                      <th>Chambre</th>
                      <th>Prestation</th>
                      <th>Origine / Réf.</th>
                      <th>Mode</th>
                      <th className="text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap text-stone-500 dark:text-stone-400">
                          {fmtDateTime(p.date_paiement)}
                        </td>
                        <td>{p.client_label || "—"}</td>
                        <td>{p.chambre_numero ? `Ch. ${p.chambre_numero}` : "—"}</td>
                        <td>
                          {p.type_sejour === "passage" ? (
                            <Pill
                              tone={
                                p.type_climatisation === "ventilee"
                                  ? "ochre"
                                  : "blue"
                              }
                            >
                              Passage{" "}
                              {p.type_climatisation === "ventilee"
                                ? "Ventilée"
                                : "Climatisée"}
                            </Pill>
                          ) : p.type_sejour === "reservation" ? (
                            <Pill tone="ochre">Réservation</Pill>
                          ) : (
                            <Pill tone="green">Nuitée</Pill>
                          )}
                        </td>
                        <td className="text-stone-500 dark:text-stone-400 text-xs">
                          {p.origine}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </td>
                        <td className="whitespace-nowrap">{p.mode_paiement}</td>
                        <td className="text-right font-semibold tabular-nums whitespace-nowrap">
                          {fmtFCFA(p.montant)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
