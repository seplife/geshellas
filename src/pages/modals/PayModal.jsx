import React, { useState } from "react";
import { Wallet } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { PAY_MODES } from "../../constants.js";
import { fmtFCFA } from "../../lib/format.js";

export default function PayModal({ stay, onClose, onSubmit, submitting }) {
  const [montant, setMontant] = useState(Math.max(0, Number(stay.solde)));
  const [mode, setMode] = useState("Espèces");
  const [reference, setReference] = useState("");
  const needsRef = mode !== "Espèces";

  return (
    <Modal
      title="Enregistrer un paiement"
      subtitle={`Chambre ${stay.chambre_numero} · ${stay.client_nom} ${stay.client_prenoms}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Annuler</Button>
          <Button
            icon={Wallet}
            disabled={!(Number(montant) > 0)}
            loading={submitting}
            onClick={() => onSubmit({ sejour_id: stay.id, montant: Number(montant), mode_paiement: mode, reference })}
          >
            Encaisser {Number(montant) > 0 ? fmtFCFA(montant) : ""}
          </Button>
        </>
      }
    >
      <div className="text-sm mb-4 rounded-xl p-3 bg-stone-50 dark:bg-brand-900/50 flex justify-between">
        <span className="text-stone-500">Solde restant</span>
        <strong className="tabular-nums">{fmtFCFA(stay.solde)}</strong>
      </div>
      <div className="flex flex-col gap-3">
        <Field label="Montant (FCFA)" required>
          <Input type="number" min={0} step={500} value={montant} onChange={(e) => setMontant(e.target.value)} />
        </Field>
        <Field label="Mode de paiement">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</Select>
        </Field>
        {needsRef && (
          <Field label="Référence de transaction" hint="ID de la transaction mobile money / carte">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
