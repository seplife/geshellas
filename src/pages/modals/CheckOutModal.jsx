import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { fmtFCFA } from "../../lib/format.js";

export default function CheckOutModal({ stay, onClose, onSubmit, submitting }) {
  const [montantSupp, setMontantSupp] = useState(0);
  const soldeApres = Number(stay.solde) - Number(montantSupp || 0);

  return (
    <Modal title={`Check-out — Chambre ${stay.chambre_numero}`} onClose={onClose}>
      <div className="text-sm mb-3 text-stone-500 dark:text-stone-400 leading-relaxed">
        Client : <strong className="text-stone-800 dark:text-stone-100">{stay.client_nom} {stay.client_prenoms}</strong><br />
        Montant total : {fmtFCFA(stay.montant_total)} · Déjà payé : {fmtFCFA(stay.montant_paye)}<br />
        Solde actuel :{" "}
        <strong className={Number(stay.solde) > 0 ? "text-rose-600" : "text-emerald-600"}>{fmtFCFA(stay.solde)}</strong>
      </div>
      <Field label="Paiement complémentaire au départ (FCFA)">
        <Input type="number" min={0} value={montantSupp} onChange={(e) => setMontantSupp(e.target.value)} />
      </Field>
      <div className="mt-2 text-sm">
        Solde après paiement :{" "}
        <strong className={soldeApres > 0 ? "text-rose-600" : "text-emerald-600"}>{fmtFCFA(soldeApres)}</strong>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button variant="danger" loading={submitting} onClick={() => onSubmit(stay.id, { montant_supplementaire: Number(montantSupp) })}>
          Valider le check-out
        </Button>
      </div>
    </Modal>
  );
}
