import React, { useEffect, useState } from "react";
import { Phone, Mail, IdCard } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { Pill } from "../../components/ui/Badge.jsx";
import { getClient } from "../../services/clients.js";
import { fmtDate, fmtFCFA } from "../../lib/format.js";

const SEJOUR_STATUS = { en_cours: ["En cours", "blue"], termine: ["Terminé", "gray"], annule: ["Annulé", "gray"] };

export default function ClientDetailModal({ client, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getClient(client.id).then((d) => alive && setDetail(d)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [client.id]);

  const sejours = detail?.sejours || [];
  const totalDepense = sejours.reduce((a, s) => a + Number(s.montant_paye || 0), 0);
  const impaye = sejours.reduce((a, s) => a + Math.max(0, Number(s.solde || 0)), 0);

  return (
    <Modal title={`${client.nom} ${client.prenoms}`} subtitle={`Client depuis le ${fmtDate(client.created_at)}`} onClose={onClose} wide>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-600 dark:text-stone-300 mb-4">
        <a href={`tel:${client.telephone}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="h-4 w-4" aria-hidden="true" />{client.telephone}</a>
        {client.email && <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="h-4 w-4" aria-hidden="true" />{client.email}</a>}
        <span className="inline-flex items-center gap-1.5"><IdCard className="h-4 w-4" aria-hidden="true" />{client.type_piece} · {client.numero_piece}</span>
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}
      {!detail && !error && <Spinner label="Chargement de l'historique…" />}
      {detail && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl p-3 bg-stone-50 dark:bg-brand-900/50"><div className="text-xs text-stone-500">Séjours</div><div className="text-lg font-semibold">{sejours.length}</div></div>
            <div className="rounded-xl p-3 bg-stone-50 dark:bg-brand-900/50"><div className="text-xs text-stone-500">Total payé</div><div className="text-lg font-semibold tabular-nums">{fmtFCFA(totalDepense)}</div></div>
            <div className="rounded-xl p-3 bg-stone-50 dark:bg-brand-900/50"><div className="text-xs text-stone-500">Impayés</div><div className={`text-lg font-semibold tabular-nums ${impaye > 0 ? "text-rose-600" : ""}`}>{fmtFCFA(impaye)}</div></div>
          </div>
          <h4 className="section-title mb-2">Historique des séjours</h4>
          {sejours.length === 0 ? (
            <p className="text-sm text-stone-500">Aucun séjour.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="table-clean">
                <thead><tr><th>N°</th><th>Chambre</th><th>Dates</th><th>Statut</th><th className="text-right">Montant</th><th className="text-right">Solde</th></tr></thead>
                <tbody>
                  {sejours.map((s) => {
                    const [label, tone] = SEJOUR_STATUS[s.statut] || [s.statut, "gray"];
                    return (
                      <tr key={s.id}>
                        <td className="text-xs text-stone-500 whitespace-nowrap">{s.numero}</td>
                        <td>{s.chambre_numero}</td>
                        <td className="whitespace-nowrap">{fmtDate(s.date_entree)} → {fmtDate(s.date_sortie_reelle || s.date_sortie_prevue)}</td>
                        <td><Pill tone={tone}>{label}</Pill></td>
                        <td className="text-right tabular-nums">{fmtFCFA(s.montant_total)}</td>
                        <td className={`text-right tabular-nums ${Number(s.solde) > 0 ? "text-rose-600" : ""}`}>{fmtFCFA(s.solde)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
