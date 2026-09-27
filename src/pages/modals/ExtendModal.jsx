import React, { useState } from "react";
import { CalendarPlus } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { PAY_MODES } from "../../constants.js";
import { fmtFCFA, fmtTime, nightsBetween, addDays } from "../../lib/format.js";

export default function ExtendModal({ stay, onClose, onSubmit, submitting }) {
  const current = stay.date_sortie_prevue?.slice(0, 10);
  const [date, setDate] = useState(addDays(current, 1));
  const [heure, setHeure] = useState(fmtTime(stay.heure_sortie_prevue) || "12:00");
  const [paiement, setPaiement] = useState(0);
  const [mode, setMode] = useState("Espèces");

  const prix = Number(stay.prix_nuit) || Number(stay.montant_total) / nightsBetween(stay.date_entree, current);
  const newTotal = nightsBetween(stay.date_entree, date) * prix;
  const supp = newTotal - Number(stay.montant_total);
  const invalid = !date || date <= current;

  return (
    <Modal
      title={`Prolonger — Chambre ${stay.chambre_numero}`}
      subtitle={`${stay.client_nom} ${stay.client_prenoms}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Annuler</Button>
          <Button
            icon={CalendarPlus}
            loading={submitting}
            disabled={invalid}
            onClick={() => onSubmit(stay.id, { nouvelle_date_sortie: date, nouvelle_heure_sortie: heure, paiement_supplementaire: Number(paiement) || 0, mode_paiement: mode })}
          >
            Confirmer
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nouvelle sortie" error={invalid ? "Doit être après la sortie actuelle" : null}>
          <Input type="date" min={addDays(current, 1)} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Heure"><Input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} /></Field>
      </div>
      <div className="my-3 rounded-xl p-3 text-sm bg-ochre-100 dark:bg-ochre-500/10 text-ochre-700 dark:text-ochre-200 flex justify-between">
        <span>{nightsBetween(current, date)} nuit(s) supplémentaire(s)</span>
        <strong className="tabular-nums">+ {fmtFCFA(Math.max(0, supp))}</strong>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Encaissé maintenant (FCFA)">
          <Input type="number" min={0} step={500} value={paiement} onChange={(e) => setPaiement(e.target.value)} />
        </Field>
        <Field label="Mode de paiement">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</Select>
        </Field>
      </div>
    </Modal>
  );
}
