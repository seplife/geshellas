import React, { useState } from "react";
import { Save } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { ID_TYPES } from "../../constants.js";

export default function ClientFormModal({ client, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({
    nom: client?.nom || "",
    prenoms: client?.prenoms || "",
    sexe: client?.sexe || "M",
    telephone: client?.telephone || "",
    whatsapp: client?.whatsapp || "",
    email: client?.email || "",
    nationalite: client?.nationalite || "Ivoirienne",
    profession: client?.profession || "",
    adresse: client?.adresse || "",
    type_piece: client?.type_piece || "CNI",
    numero_piece: client?.numero_piece || "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid =
    form.nom.trim() &&
    form.prenoms.trim() &&
    form.telephone.trim() &&
    form.numero_piece.trim();

  const submit = () => {
    if (!valid) return;
    onSubmit({
      nom: form.nom.trim(),
      prenoms: form.prenoms.trim(),
      sexe: form.sexe,
      telephone: form.telephone.trim(),
      whatsapp: form.whatsapp.trim() || form.telephone.trim(),
      email: form.email.trim(),
      nationalite: form.nationalite.trim(),
      profession: form.profession.trim(),
      adresse: form.adresse.trim(),
      type_piece: form.type_piece,
      numero_piece: form.numero_piece.trim(),
    });
  };

  return (
    <Modal
      title={`Modifier le client — ${client?.nom || ""} ${client?.prenoms || ""}`}
      subtitle="Mettre à jour les informations de la fiche client."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={Save} disabled={!valid} loading={submitting} onClick={submit}>
            Enregistrer les modifications
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid sm:grid-cols-2 gap-3"
      >
        <Field label="Nom" required>
          <Input value={form.nom} onChange={set("nom")} autoComplete="off" />
        </Field>
        <Field label="Prénoms" required>
          <Input value={form.prenoms} onChange={set("prenoms")} autoComplete="off" />
        </Field>
        <Field label="Téléphone" required>
          <Input value={form.telephone} onChange={set("telephone")} inputMode="tel" />
        </Field>
        <Field label="WhatsApp">
          <Input value={form.whatsapp} onChange={set("whatsapp")} inputMode="tel" />
        </Field>
        <Field label="Type de pièce" required>
          <Select value={form.type_piece} onChange={set("type_piece")}>
            {ID_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Numéro de pièce" required>
          <Input value={form.numero_piece} onChange={set("numero_piece")} autoComplete="off" />
        </Field>
        <Field label="Sexe">
          <Select value={form.sexe} onChange={set("sexe")}>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </Select>
        </Field>
        <Field label="Nationalité">
          <Input value={form.nationalite} onChange={set("nationalite")} />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Profession">
          <Input value={form.profession} onChange={set("profession")} />
        </Field>
        <Field label="Adresse" className="sm:col-span-2">
          <Input value={form.adresse} onChange={set("adresse")} />
        </Field>
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
