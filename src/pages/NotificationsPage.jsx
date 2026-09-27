import React from "react";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { fmtDateTime } from "../lib/format.js";

export default function NotificationsPage({ notifications, onRetry }) {
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-brand-700 dark:text-brand-100">Notifications WhatsApp</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Journal des envois au gérant, avec statut et relance en cas d'échec.
        </p>
      </div>

      {notifications.length === 0 ? (
        <EmptyState title="Aucune notification pour le moment." />
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => {
            const sent = n.statut === "envoyee";
            return (
              <div
                key={n.id}
                className={`rounded-2xl p-4 border ${
                  sent
                    ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                    : "bg-rose-50 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20"
                }`}
              >
                <div className="flex justify-between items-start mb-1.5 gap-2">
                  <div className={`text-[11px] ${sent ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                    {fmtDateTime(n.created_at)} · {n.type} · {n.statut}
                  </div>
                  {n.statut === "echec" && (
                    <Button variant="ghost" onClick={() => onRetry(n.id)}>
                      Réessayer
                    </Button>
                  )}
                </div>
                <pre className="whitespace-pre-wrap text-sm font-sans text-stone-700 dark:text-stone-200">{n.message}</pre>
                {n.erreur && <div className="text-xs mt-1.5 text-rose-700 dark:text-rose-300">Erreur : {n.erreur}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
