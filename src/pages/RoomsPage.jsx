import React, { useMemo, useState } from "react";
import Badge, { STATUS } from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import { Select } from "../components/ui/Field.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { fmtFCFA, fmtDate } from "../lib/format.js";

export default function RoomsPage({ rooms, role, activeStays, onCheckIn, onCheckOut, onExtend, onPay, onClean, onMaintenance }) {
  const [filterStatus, setFilterStatus] = useState("tous");
  const [filterFloor, setFilterFloor] = useState("tous");

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.etage))].sort((a, b) => a - b), [rooms]);
  const filtered = rooms.filter(
    (r) => (filterStatus === "tous" || r.statut === filterStatus) && (filterFloor === "tous" || r.etage === Number(filterFloor))
  );
  const canOperate = role === "admin" || role === "reception";
  const canClean = role === "admin" || role === "entretien";
  const canReportIssue = role === "admin" || role === "entretien";
  const stayFor = (roomId) => activeStays.find((s) => s.chambre_id === roomId);

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-700 dark:text-brand-100">Chambres</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {filtered.length} chambre(s) affichée(s) sur {rooms.length}.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-auto">
            <option value="tous">Tous les statuts</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          <Select value={filterFloor} onChange={(e) => setFilterFloor(e.target.value)} className="w-auto">
            <option value="tous">Tous les étages</option>
            {floors.map((f) => (
              <option key={f} value={f}>
                Étage {f}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucune chambre ne correspond à ce filtre." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((room) => {
            const stay = stayFor(room.id);
            return (
              <div key={room.id} className="card rounded-2xl p-4 flex flex-col gap-3 hover:shadow-pop transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold font-display">Chambre {room.numero}</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {room.type} · Étage {room.etage} · {fmtFCFA(room.prix_nuit)}/nuit
                    </div>
                  </div>
                  <Badge statut={room.statut} />
                </div>

                {stay && (
                  <div className="text-xs rounded-xl p-2.5 bg-stone-50 dark:bg-brand-900/40 flex flex-col gap-0.5">
                    <div>
                      Client : <strong>{stay.client_nom} {stay.client_prenoms}</strong>
                    </div>
                    <div>Sortie prévue : {fmtDate(stay.date_sortie_prevue)} {stay.heure_sortie_prevue}</div>
                    <div>
                      Solde :{" "}
                      <span className={Number(stay.solde) > 0 ? "text-rose-600 font-medium" : "text-emerald-600 font-medium"}>
                        {fmtFCFA(stay.solde)}
                      </span>
                    </div>
                  </div>
                )}

                {room.statut === "maintenance" && room.panne_note && (
                  <div className="text-xs rounded-xl p-2.5 bg-stone-100 dark:bg-stone-700/30 text-stone-600 dark:text-stone-300">
                    🔧 {room.panne_note}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-auto pt-1">
                  {room.statut === "libre" && canOperate && (
                    <Button onClick={() => onCheckIn(room)}>Check-in</Button>
                  )}
                  {room.statut === "occupee" && canOperate && stay && (
                    <>
                      <Button variant="subtle" onClick={() => onPay(stay)}>Paiement</Button>
                      <Button variant="subtle" onClick={() => onExtend(stay)}>Prolonger</Button>
                      <Button variant="danger" onClick={() => onCheckOut(stay)}>Check-out</Button>
                    </>
                  )}
                  {room.statut === "nettoyage" && canClean && (
                    <Button onClick={() => onClean(room.id)}>Valider le nettoyage</Button>
                  )}
                  {(room.statut === "libre" || room.statut === "occupee") && canReportIssue && (
                    <Button variant="ghost" onClick={() => onMaintenance(room)}>Signaler une anomalie</Button>
                  )}
                  {room.statut === "maintenance" && role === "admin" && (
                    <Button variant="subtle" onClick={() => onClean(room.id)}>Remettre en service</Button>
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
