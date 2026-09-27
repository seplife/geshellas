import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { PAY_MODES } from "../../constants.js";
import { fmtFCFA } from "../../lib/format.js";

export default function PayModal({ stay, onClose, onSubmit, submitting }) {
  const [montant, setMontant] = useState(Math.max(0, Number(stay.solde)));
  const [mode, setMode] = useState("Espèces");

  return (
    <Modal title="Enregistrer un paiement" onClose={onClose}>
      <div className="text-sm mb-3 text-stone-500 dark:text-stone-400">
        Solde actuel : <strong className="text-stone-800 dark:text-stone-100">{fmtFCFA(stay.solde)}</strong>
      </div>
      <div className="flex flex-col gap-3">
        <Field label="Montant (FCFA)">
          <Input type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} />
        </Field>
        <Field label="Mode de paiement">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button
          disabled={!(Number(montant) > 0)}
          loading={submitting}
          onClick={() => onSubmit({ sejour_id: stay.id, montant: Number(montant), mode_paiement: mode })}
        >
          Enregistrer
        </Button>
      </div>
    </Modal>
  );
}
