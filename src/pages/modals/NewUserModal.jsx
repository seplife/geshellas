import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { ROLE_LABELS } from "../../constants.js";

export default function NewUserModal({ onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({ nom: "", prenoms: "", email: "", telephone: "", role: "reception", password: "" });
  const valid = form.nom && form.prenoms && form.email && form.password.length >= 6;

  return (
    <Modal title="Nouvel utilisateur" subtitle="Crée un compte Supabase Auth avec le rôle choisi." onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom" required><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
          <Field label="Prénoms" required><Input value={form.prenoms} onChange={(e) => setForm({ ...form, prenoms: e.target.value })} /></Field>
        </div>
        <Field label="E-mail" required>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Téléphone">
          <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
        </Field>
        <Field label="Rôle">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {Object.entries(ROLE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Mot de passe temporaire" required hint="Au moins 6 caractères ; à faire changer à la première connexion.">
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button disabled={!valid} loading={submitting} onClick={() => onSubmit(form)}>Créer le compte</Button>
      </div>
    </Modal>
  );
}
