import React, { useState } from "react";
import { MessageSquare, RotateCw } from "lucide-react";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { Pill } from "../components/ui/Badge.jsx";
import { Skeleton } from "../components/ui/Spinner.jsx";
import { CAN } from "../constants.js";
import { fmtDateTime } from "../lib/format.js";

const STATUT = {
  envoyee: { label: "Envoyée", tone: "green" },
  echec: { label: "Échec", tone: "red" },
  en_attente: { label: "En attente", tone: "ochre" },
};

const TYPES = {
  "check-in": "Arrivée",
  "check-out": "Départ",
  prolongation: "Prolongation",
  "alerte-fin-sejour": "Fin de séjour proche",
  "resume-journalier": "Résumé du jour",
};

export default function NotificationsPage({ notifications, error, onRetry, role, onResend }) {
  const [filter, setFilter] = useState("tous");
  const list = (notifications || []).filter((n) => filter === "tous" || n.statut === filter);
  const failures = (notifications || []).filter((n) => n.statut === "echec").length;

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <PageHeader title="Notifications WhatsApp" subtitle="Messages envoyés au gérant, avec relance en cas d'échec." />
      <div className="flex gap-2 flex-wrap">
        {[["tous", "Toutes"], ["echec", `Échecs (${failures})`], ["envoyee", "Envoyées"]].map(([k, label]) => (
          <button type="button" key={k} className={`chip ${filter === k ? "chip-active" : ""}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!notifications ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Aucune notification." />
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {list.map((n) => {
            const st = STATUT[n.statut] || { label: n.statut, tone: "gray" };
            return (
              <div key={n.id} className="card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Pill tone={st.tone}>{st.label}</Pill>
                    <span className="text-sm font-medium truncate">{TYPES[n.type] || n.type}</span>
                  </div>
                  <span className="text-[11px] text-stone-500 whitespace-nowrap">{fmtDateTime(n.created_at)}</span>
                </div>
                <pre className="whitespace-pre-wrap text-[13px] font-sans text-stone-700 dark:text-stone-200 bg-stone-50 dark:bg-brand-900/50 rounded-xl p-3 max-h-48 overflow-y-auto">{n.message}</pre>
                <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                  <span>→ {n.destinataire} · {n.tentatives} tentative(s)</span>
                  {n.statut === "echec" && CAN.retryNotification(role) && (
                    <Button size="sm" variant="ghost" icon={RotateCw} onClick={() => onResend(n.id)}>Réessayer</Button>
                  )}
                </div>
                {n.erreur && <div className="text-xs text-rose-600 dark:text-rose-300">Erreur : {n.erreur}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
