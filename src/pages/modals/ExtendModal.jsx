import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { fmtFCFA, nightsBetween } from "../../lib/format.js";

export default function ExtendModal({ stay, onClose, onSubmit, submitting }) {
  const [date, setDate] = useState(stay.date_sortie_prevue?.slice(0, 10));
  const [heure, setHeure] = useState(stay.heure_sortie_prevue);
  const [paiement, setPaiement] = useState(0);
  const nights = nightsBetween(stay.date_entree, date);
  const supp = nights * (Number(stay.montant_total) / nightsBetween(stay.date_entree, stay.date_sortie_prevue)) - Number(stay.montant_total);

  return (
    <Modal title={`Prolonger le séjour — Chambre ${stay.chambre_numero}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field label="Nouvelle date de sortie">
          <Input type="date" min={stay.date_sortie_prevue?.slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Nouvelle heure de sortie">
          <Input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
        </Field>
        <div className="rounded-xl p-3 text-sm bg-ochre-100 dark:bg-ochre-500/10 text-ochre-700 dark:text-ochre-200">
          Montant supplémentaire estimé : <strong>{fmtFCFA(Math.max(0, supp))}</strong>
        </div>
        <Field label="Paiement complémentaire encaissé (FCFA)">
          <Input type="number" min={0} value={paiement} onChange={(e) => setPaiement(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button
          loading={submitting}
          onClick={() => onSubmit(stay.id, { nouvelle_date_sortie: date, nouvelle_heure_sortie: heure, paiement_supplementaire: Number(paiement) })}
        >
          Confirmer la prolongation
        </Button>
      </div>
    </Modal>
  );
}
