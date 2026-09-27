import React, { useState } from "react";
import { UserPlus } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { ROLE_LABELS } from "../../constants.js";

export default function NewUserModal({ onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({ nom: "", prenoms: "", email: "", telephone: "", role: "reception", password: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const valid = form.nom.trim() && form.prenoms.trim() && emailOk && form.password.length >= 8;

  return (
    <Modal
      title="Nouvel utilisateur"
      subtitle="Le compte est actif immédiatement avec le rôle choisi."
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Annuler</Button>
          <Button icon={UserPlus} disabled={!valid} loading={submitting} onClick={() => onSubmit({ ...form, email: form.email.trim() })}>
            Créer le compte
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom" required><Input value={form.nom} onChange={set("nom")} /></Field>
          <Field label="Prénoms" required><Input value={form.prenoms} onChange={set("prenoms")} /></Field>
        </div>
        <Field label="E-mail" required error={form.email && !emailOk ? "Adresse invalide" : null}>
          <Input type="email" value={form.email} onChange={set("email")} autoComplete="off" />
        </Field>
        <Field label="Téléphone"><Input value={form.telephone} onChange={set("telephone")} inputMode="tel" /></Field>
        <Field label="Rôle">
          <Select value={form.role} onChange={set("role")}>
            {Object.entries(ROLE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Mot de passe temporaire" required hint="8 caractères minimum ; à transmettre de façon sécurisée.">
          <Input type="text" value={form.password} onChange={set("password")} autoComplete="new-password" />
        </Field>
      </div>
    </Modal>
  );
}
