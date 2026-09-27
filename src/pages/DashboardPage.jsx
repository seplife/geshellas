import React from "react";
import {
  BedDouble, DoorOpen, LogIn, LogOut, Percent, Users, Wallet, AlarmClock, Coins, Wrench, CalendarCheck, CheckCircle2,
} from "lucide-react";
import StatCard from "../components/ui/StatCard.jsx";
import { Skeleton } from "../components/ui/Spinner.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { STATUS } from "../components/ui/Badge.jsx";
import { fmtFCFA, fmtShortFCFA, fmtDate, fmtTime, fmtWeekday, fmtDateShort } from "../lib/format.js";

function OccupancyBar({ m }) {
  const parts = ["occupee", "reservee", "nettoyage", "maintenance", "libre"].map((k) => ({
    key: k,
    value: m[k === "occupee" ? "occupees" : k === "reservee" ? "reservees" : k === "libre" ? "libres" : k] || 0,
  }));
  const total = m.total_chambres || 0;
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="section-title">Répartition des chambres</h2>
        <span className="text-xs text-stone-500">{total} au total</span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-stone-500">Aucune chambre configurée.</p>
      ) : (
        <>
          <div className="flex h-3 w-full gap-0.5 rounded-full overflow-hidden" role="img" aria-label="Répartition des chambres par statut">
            {parts.filter((p) => p.value > 0).map((p) => (
              <div key={p.key} className={`${STATUS[p.key].tile} h-full`} style={{ width: `${(p.value / total) * 100}%` }} title={`${STATUS[p.key].label} : ${p.value}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
            {parts.map((p) => (
              <div key={p.key} className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS[p.key].tile}`} aria-hidden="true" />
                <span className="text-stone-600 dark:text-stone-300">{STATUS[p.key].label}</span>
                <span className="font-semibold tabular-nums">{p.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Recettes des 7 derniers jours — une seule série, barres fines, valeur au survol. */
function RevenueChart({ days }) {
  const max = Math.max(...days.map((d) => Number(d.montant) || 0), 1);
  const total = days.reduce((a, d) => a + (Number(d.montant) || 0), 0);
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="section-title">Recettes — 7 derniers jours</h2>
        <span className="text-sm font-semibold tabular-nums">{fmtFCFA(total)}</span>
      </div>
      <div className="relative h-40 flex items-end gap-2 sm:gap-3 border-b border-stone-200 dark:border-brand-700">
        {days.map((d, i) => {
          const v = Number(d.montant) || 0;
          const isToday = i === days.length - 1;
          return (
            <div key={d.jour} className="group relative flex-1 h-full flex flex-col justify-end items-center">
              <div className="pointer-events-none absolute -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap rounded-lg bg-stone-900 text-white text-xs px-2 py-1 shadow-pop dark:bg-stone-100 dark:text-stone-900">
                {fmtDateShort(d.jour)} · {fmtFCFA(v)}
              </div>
              <div
                className={`w-full max-w-[36px] rounded-t ${isToday ? "bg-brand-500 dark:bg-brand-300" : "bg-brand-300 dark:bg-brand-600"} group-hover:bg-brand-600 dark:group-hover:bg-brand-200 transition-colors`}
                style={{ height: v > 0 ? `${Math.max(3, (v / max) * 100)}%` : "2px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 sm:gap-3 mt-2">
        {days.map((d) => (
          <div key={d.jour} className="flex-1 text-center">
            <div className="text-[11px] text-stone-500 capitalize">{fmtWeekday(d.jour)}</div>
            <div className="text-[10px] text-stone-400 tabular-nums">{fmtShortFCFA(d.montant)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListCard({ title, icon: Icon, items, empty, render, tone = "default" }) {
  const toneCls = {
    default: "text-brand-600 dark:text-brand-200",
    red: "text-rose-600 dark:text-rose-300",
    ochre: "text-ochre-600 dark:text-ochre-200",
  }[tone];
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${toneCls}`} aria-hidden="true" />
        <h2 className="section-title flex-1">{title}</h2>
        <span className="text-xs font-semibold tabular-nums text-stone-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-stone-400 flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" /> {empty}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-100 dark:divide-brand-700/50 -my-2">{items.map(render)}</ul>
      )}
    </div>
  );
}

export default function DashboardPage({ dashboard: m, error, onRetry, role, onNavigate }) {
  const finance = role !== "entretien";

  if (error && !m) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <PageHeader title="Tableau de bord" />
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }
  if (!m) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const retard = m.sejours_en_retard || [];
  const soldes = m.soldes_restants || [];
  const arrivees = m.arrivees_prevues || [];
  const departs = m.departs_prevus || [];
  const anomalies = m.chambres_anomalie || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de l'hôtel, mise à jour en temps réel." />
      {error && <ErrorState message={error} onRetry={onRetry} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Taux d'occupation" value={`${m.taux_occupation}%`} icon={Percent} tone="brand" hint={`${m.occupees} / ${m.total_chambres} chambres`} />
        <StatCard label="Chambres libres" value={m.libres} icon={DoorOpen} tone="green" />
        <StatCard label="Clients présents" value={m.clients_presents} icon={Users} tone="blue" hint={`${m.sejours_en_cours ?? m.occupees} séjour(s) en cours`} />
        {finance ? (
          <StatCard label="Recettes du jour" value={fmtFCFA(m.recettes_jour)} icon={Wallet} tone="ochre" />
        ) : (
          <StatCard label="À nettoyer" value={m.nettoyage} icon={BedDouble} tone="blue" />
        )}
        <StatCard label="Arrivées aujourd'hui" value={m.arrivees_jour} icon={LogIn} hint={`${arrivees.length} réservation(s) attendue(s)`} />
        <StatCard label="Départs prévus" value={m.departs_jour} icon={LogOut} />
        <StatCard label="Sorties dépassées" value={retard.length} icon={AlarmClock} tone={retard.length ? "red" : "default"} />
        <StatCard label="En maintenance" value={m.maintenance} icon={Wrench} tone={m.maintenance ? "ochre" : "default"} />
      </div>

      <div className={`grid gap-4 ${finance ? "lg:grid-cols-2" : ""}`}>
        <OccupancyBar m={m} />
        {finance && <RevenueChart days={m.recettes_7j || []} />}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ListCard
          title="Sorties dépassées"
          icon={AlarmClock}
          tone="red"
          items={retard}
          empty="Aucun retard."
          render={(s) => (
            <li key={s.id} className="py-2 flex justify-between gap-2 text-sm">
              <span className="min-w-0 truncate"><strong>Ch. {s.chambre_numero}</strong> · {s.client_nom} {s.client_prenoms}</span>
              <span className="text-rose-600 dark:text-rose-300 whitespace-nowrap text-xs">{fmtDate(s.date_sortie_prevue)} {fmtTime(s.heure_sortie_prevue)}</span>
            </li>
          )}
        />
        <ListCard
          title="Arrivées attendues"
          icon={CalendarCheck}
          items={arrivees}
          empty="Aucune réservation aujourd'hui."
          render={(r) => (
            <li key={r.id} className="py-2 flex justify-between gap-2 text-sm">
              <span className="min-w-0 truncate"><strong>Ch. {r.chambre_numero}</strong> · {r.nom_client}</span>
              {onNavigate && role !== "entretien" && (
                <button type="button" className="text-xs text-brand-600 dark:text-brand-200 hover:underline" onClick={() => onNavigate("reservations")}>
                  Voir
                </button>
              )}
            </li>
          )}
        />
        <ListCard
          title="Départs du jour"
          icon={LogOut}
          items={departs}
          empty="Aucun départ prévu."
          render={(s) => (
            <li key={s.id} className="py-2 flex justify-between gap-2 text-sm">
              <span className="min-w-0 truncate"><strong>Ch. {s.chambre_numero}</strong> · {s.client_nom} {s.client_prenoms}</span>
              <span className="text-xs text-stone-500">{fmtTime(s.heure_sortie_prevue)}</span>
            </li>
          )}
        />
        {finance && (
          <ListCard
            title="Soldes à encaisser"
            icon={Coins}
            tone="ochre"
            items={soldes}
            empty="Tous les séjours sont réglés."
            render={(s) => (
              <li key={s.id} className="py-2 flex justify-between gap-2 text-sm">
                <span className="min-w-0 truncate"><strong>Ch. {s.chambre_numero}</strong> · {s.client_nom} {s.client_prenoms}</span>
                <span className="font-semibold tabular-nums whitespace-nowrap">{fmtFCFA(s.solde)}</span>
              </li>
            )}
          />
        )}
        <ListCard
          title="Anomalies signalées"
          icon={Wrench}
          tone="ochre"
          items={anomalies}
          empty="Aucune anomalie."
          render={(c) => (
            <li key={c.id} className="py-2 text-sm">
              <strong>Ch. {c.numero}</strong> <span className="text-xs text-stone-500">({STATUS[c.statut]?.label})</span>
              <div className="text-xs text-stone-500 dark:text-stone-400 truncate">{c.panne_note}</div>
            </li>
          )}
        />
      </div>
    </div>
  );
}
