import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Textarea } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";

export default function MaintenanceModal({ room, onClose, onSubmit, submitting }) {
  const [note, setNote] = useState("");

  return (
    <Modal title={`Signaler une anomalie — Chambre ${room?.numero}`} onClose={onClose}>
      <Field label="Description de la panne" required>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
      </Field>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button variant="danger" disabled={!note} loading={submitting} onClick={() => onSubmit(room.id, note)}>
          Mettre en maintenance
        </Button>
      </div>
    </Modal>
  );
}
