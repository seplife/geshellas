import React, { useMemo, useState } from "react";
import { CalendarDays, LogIn, Phone, Plus, UserX, X } from "lucide-react";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { Pill } from "../components/ui/Badge.jsx";
import { Skeleton } from "../components/ui/Spinner.jsx";
import { CAN, RESERVATION_STATUS } from "../constants.js";
import { fmtFCFA, fmtDate, nightsBetween, todayStr } from "../lib/format.js";

const ACTIVE = ["en_attente", "confirmee"];

export default function ReservationsPage({ reservations, error, onRetry, role, onCreate, onCheckIn, onCancel, onNoShow }) {
  const today = todayStr();
  const [view, setView] = useState(null);
  const canOperate = CAN.operate(role);

  const groups = useMemo(() => {
    const all = reservations || [];
    const active = all.filter((r) => ACTIVE.includes(r.statut));
    return {
      jour: active.filter((r) => r.date_arrivee <= today),
      avenir: active.filter((r) => r.date_arrivee > today),
      historique: all.filter((r) => !ACTIVE.includes(r.statut)).reverse(),
    };
  }, [reservations, today]);

  const tabs = [
    { key: "jour", label: "Arrivées du jour" },
    { key: "avenir", label: "À venir" },
    { key: "historique", label: "Historique" },
  ];
  // Par défaut : les arrivées du jour s'il y en a, sinon les réservations à venir.
  const current = view || (groups.jour.length > 0 ? "jour" : "avenir");
  const list = groups[current];

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <PageHeader
        title="Réservations"
        subtitle="Planification des arrivées. La chambre est bloquée le jour de l'arrivée."
        actions={canOperate && <Button icon={Plus} onClick={onCreate}>Nouvelle réservation</Button>}
      />
      {error && <ErrorState message={error} onRetry={onRetry} />}

      <div className="flex gap-2 flex-wrap" role="tablist">
        {tabs.map((t) => (
          <button
            type="button"
            role="tab"
            aria-selected={current === t.key}
            key={t.key}
            className={`chip ${current === t.key ? "chip-active" : ""}`}
            onClick={() => setView(t.key)}
          >
            {t.label} <span className="opacity-70">{groups[t.key].length}</span>
          </button>
        ))}
      </div>

      {!reservations ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={current === "jour" ? "Aucune arrivée prévue aujourd'hui." : current === "avenir" ? "Aucune réservation à venir." : "Aucune réservation passée."}
        />
      ) : (
        <div className="card divide-y divide-stone-100 dark:divide-brand-700/50">
          {list.map((r) => {
            const st = RESERVATION_STATUS[r.statut] || { label: r.statut, tone: "gray" };
            const active = ACTIVE.includes(r.statut);
            const arrived = r.date_arrivee <= today;
            const nights = nightsBetween(r.date_arrivee, r.date_depart);
            return (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-brand-50 dark:bg-brand-700/40 text-brand-700 dark:text-brand-100 flex flex-col items-center justify-center leading-none">
                    <span className="text-[10px] uppercase">Ch.</span>
                    <span className="text-sm font-semibold">{r.chambre_numero}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.nom_client}</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 flex flex-wrap gap-x-2">
                      <span>{fmtDate(r.date_arrivee)} → {fmtDate(r.date_depart)} · {nights} nuit(s)</span>
                      {r.telephone && (
                        <a href={`tel:${r.telephone}`} className="inline-flex items-center gap-1 hover:underline">
                          <Phone className="h-3 w-3" aria-hidden="true" />{r.telephone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap sm:justify-end">
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{fmtFCFA(r.montant)}</div>
                    {Number(r.avance) > 0 && <div className="text-[11px] text-stone-500">Avance {fmtFCFA(r.avance)}</div>}
                  </div>
                  <Pill tone={st.tone}>{st.label}</Pill>
                  {active && canOperate && (
                    <div className="flex gap-1.5">
                      {arrived && <Button size="sm" icon={LogIn} onClick={() => onCheckIn(r)}>Check-in</Button>}
                      {arrived && <Button size="sm" variant="subtle" icon={UserX} onClick={() => onNoShow(r)} title="Client absent">Absent</Button>}
                      <Button size="sm" variant="ghost" icon={X} onClick={() => onCancel(r)}>Annuler</Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
