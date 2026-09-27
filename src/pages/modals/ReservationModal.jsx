import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { todayStr } from "../../lib/format.js";

export default function ReservationModal({ rooms, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({
    nom_client: "", telephone: "", chambre_id: rooms[0]?.id || "",
    date_arrivee: todayStr(), date_depart: todayStr(), montant: 0, avance: 0,
  });
  const valid = form.nom_client && form.chambre_id;

  return (
    <Modal title="Nouvelle réservation" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field label="Nom du client" required>
          <Input value={form.nom_client} onChange={(e) => setForm({ ...form, nom_client: e.target.value })} />
        </Field>
        <Field label="Téléphone">
          <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
        </Field>
        <Field label="Chambre" required>
          <Select value={form.chambre_id} onChange={(e) => setForm({ ...form, chambre_id: e.target.value })}>
            {rooms.length === 0 && <option value="">Aucune chambre libre</option>}
            {rooms.map((r) => <option key={r.id} value={r.id}>Chambre {r.numero} — {r.type}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Arrivée prévue">
            <Input type="date" value={form.date_arrivee} onChange={(e) => setForm({ ...form, date_arrivee: e.target.value })} />
          </Field>
          <Field label="Départ prévu">
            <Input type="date" value={form.date_depart} onChange={(e) => setForm({ ...form, date_depart: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (FCFA)">
            <Input type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
          </Field>
          <Field label="Avance (FCFA)">
            <Input type="number" value={form.avance} onChange={(e) => setForm({ ...form, avance: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button
          disabled={!valid}
          loading={submitting}
          onClick={() => onSubmit({ ...form, chambre_id: Number(form.chambre_id), montant: Number(form.montant), avance: Number(form.avance) })}
        >
          Créer la réservation
        </Button>
      </div>
    </Modal>
  );
}
