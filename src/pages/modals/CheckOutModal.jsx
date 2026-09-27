import React, { useState } from "react";
import { LogOut } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { PAY_MODES } from "../../constants.js";
import { fmtFCFA, fmtDate } from "../../lib/format.js";

export default function CheckOutModal({ stay, onClose, onSubmit, submitting }) {
  const solde = Number(stay.solde);
  const [montant, setMontant] = useState(Math.max(0, solde));
  const [mode, setMode] = useState("Espèces");
  const soldeApres = solde - (Number(montant) || 0);

  return (
    <Modal
      title={`Check-out — Chambre ${stay.chambre_numero}`}
      subtitle={`${stay.client_nom} ${stay.client_prenoms} · arrivé le ${fmtDate(stay.date_entree)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Annuler</Button>
          <Button
            variant="danger"
            icon={LogOut}
            loading={submitting}
            disabled={Number(montant) < 0}
            onClick={() => onSubmit(stay.id, { montant_supplementaire: Number(montant) || 0, mode_paiement: mode })}
          >
            Valider le départ
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-y-1.5 text-sm mb-4">
        <dt className="text-stone-500">Montant du séjour</dt><dd className="text-right tabular-nums">{fmtFCFA(stay.montant_total)}</dd>
        <dt className="text-stone-500">Déjà payé</dt><dd className="text-right tabular-nums">{fmtFCFA(stay.montant_paye)}</dd>
        <dt className="font-medium">Solde actuel</dt>
        <dd className={`text-right font-semibold tabular-nums ${solde > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtFCFA(solde)}</dd>
      </dl>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Encaissé au départ (FCFA)">
          <Input type="number" min={0} step={500} value={montant} onChange={(e) => setMontant(e.target.value)} />
        </Field>
        <Field label="Mode de paiement">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</Select>
        </Field>
      </div>
      <div className={`mt-3 text-sm rounded-xl p-3 ${soldeApres > 0 ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"}`}>
        {soldeApres > 0
          ? `Le client partira avec un impayé de ${fmtFCFA(soldeApres)}.`
          : soldeApres < 0
            ? `Trop-perçu de ${fmtFCFA(-soldeApres)} à rendre au client.`
            : "Séjour entièrement réglé."}
      </div>
    </Modal>
  );
}
