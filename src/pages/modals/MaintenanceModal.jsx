import React, { useState } from "react";
import { Wrench } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Textarea } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";

export default function MaintenanceModal({ room, onClose, onSubmit, submitting }) {
  const [note, setNote] = useState(room?.panne_note || "");
  const occupied = room?.statut === "occupee";

  return (
    <Modal
      title={`Signaler une anomalie — Chambre ${room?.numero}`}
      subtitle={occupied ? "La chambre reste occupée ; elle passera en maintenance au départ du client." : "La chambre passera en maintenance."}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Annuler</Button>
          <Button variant="danger" icon={Wrench} disabled={!note.trim()} loading={submitting} onClick={() => onSubmit(room.id, note.trim())}>
            Signaler
          </Button>
        </>
      }
    >
      <Field label="Description du problème" required>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Ex. climatisation en panne, fuite d'eau…" />
      </Field>
    </Modal>
  );
}
