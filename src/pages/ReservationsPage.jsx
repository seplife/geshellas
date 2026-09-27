import React from "react";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { fmtFCFA, fmtDate } from "../lib/format.js";

export default function ReservationsPage({ reservations, onCreate, onCancel }) {
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-brand-700 dark:text-brand-100">Réservations</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">Suivi des réservations à venir.</p>
        </div>
        <Button onClick={onCreate}>+ Nouvelle réservation</Button>
      </div>

      {reservations.length === 0 ? (
        <EmptyState title="Aucune réservation enregistrée." />
      ) : (
        <div className="flex flex-col gap-3">
          {reservations.map((r) => (
            <div key={r.id} className="card rounded-2xl p-4 flex flex-wrap justify-between gap-2 items-center">
              <div>
                <div className="font-semibold">{r.nom_client}</div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  Chambre {r.chambre_numero} · {fmtDate(r.date_arrivee)} → {fmtDate(r.date_depart)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`badge ${
                    r.statut === "annulee"
                      ? "bg-stone-100 text-stone-500 dark:bg-stone-700/40 dark:text-stone-300"
                      : "bg-ochre-100 text-ochre-700 dark:bg-ochre-500/15 dark:text-ochre-200"
                  }`}
                >
                  {r.statut === "annulee" ? "Annulée" : "Confirmée"}
                </span>
                <span className="text-sm font-medium">{fmtFCFA(r.montant)}</span>
                {r.statut !== "annulee" && (
                  <Button variant="ghost" onClick={() => onCancel(r.id)}>
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
