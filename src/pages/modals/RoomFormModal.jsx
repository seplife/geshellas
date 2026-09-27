import React, { useState } from "react";
import { Save } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select, Textarea } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";

const TYPES = ["Standard", "Confort", "Suite", "Ventilée", "Climatisée"];

export default function RoomFormModal({ room, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({
    numero: room?.numero || "", type: room?.type || "Standard", prix_nuit: room?.prix_nuit ?? "",
    capacite: room?.capacite ?? 2, nombre_lits: room?.nombre_lits ?? 1, etage: room?.etage ?? 1,
    equipements: room?.equipements || "", description: room?.description || "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.numero.trim() && form.type.trim() && Number(form.prix_nuit) >= 0 && form.prix_nuit !== "" && Number(form.capacite) >= 1;

  const submit = () =>
    onSubmit({
      numero: form.numero.trim(), type: form.type.trim(), categorie: form.type.trim(),
      prix_nuit: Number(form.prix_nuit), capacite: Number(form.capacite), nombre_lits: Number(form.nombre_lits),
      etage: Number(form.etage), equipements: form.equipements.trim(), description: form.description.trim(),
    });

  return (
    <Modal
      title={room ? `Modifier la chambre ${room.numero}` : "Nouvelle chambre"}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Annuler</Button>
          <Button icon={Save} disabled={!valid} loading={submitting} onClick={submit}>Enregistrer</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Numéro" required><Input value={form.numero} onChange={set("numero")} /></Field>
        <Field label="Type" required>
          <Select value={TYPES.includes(form.type) ? form.type : "__autre"} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value === "__autre" ? "" : e.target.value }))}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
            <option value="__autre">Autre…</option>
          </Select>
        </Field>
        {!TYPES.includes(form.type) && (
          <Field label="Type personnalisé" required className="col-span-2"><Input value={form.type} onChange={set("type")} /></Field>
        )}
        <Field label="Prix / nuit (FCFA)" required><Input type="number" min={0} step={500} value={form.prix_nuit} onChange={set("prix_nuit")} /></Field>
        <Field label="Étage"><Input type="number" min={0} value={form.etage} onChange={set("etage")} /></Field>
        <Field label="Capacité (pers.)"><Input type="number" min={1} value={form.capacite} onChange={set("capacite")} /></Field>
        <Field label="Nombre de lits"><Input type="number" min={1} value={form.nombre_lits} onChange={set("nombre_lits")} /></Field>
        <Field label="Équipements" className="col-span-2"><Input value={form.equipements} onChange={set("equipements")} placeholder="Clim, TV, Wi-Fi…" /></Field>
        <Field label="Description" className="col-span-2"><Textarea rows={2} value={form.description} onChange={set("description")} /></Field>
      </div>
    </Modal>
  );
}
