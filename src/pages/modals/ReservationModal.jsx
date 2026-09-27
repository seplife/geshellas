import React, { useState } from "react";
import { CalendarPlus } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { PAY_MODES } from "../../constants.js";
import { fmtFCFA, todayStr, addDays, nightsBetween } from "../../lib/format.js";

export default function ReservationModal({ rooms, onClose, onSubmit, submitting }) {
  // Toutes les chambres hors maintenance : la disponibilité sur la période est vérifiée par la base.
  const choices = rooms.filter((r) => r.statut !== "maintenance");
  const today = todayStr();
  const [form, setForm] = useState({
    nom_client: "", telephone: "", chambre_id: choices[0]?.id || "",
    date_arrivee: today, date_depart: addDays(today, 1), montant: "", avance: 0, mode_paiement: "Espèces",
  });
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const room = rooms.find((r) => r.id === Number(form.chambre_id));
  const nights = nightsBetween(form.date_arrivee, form.date_depart);
  const auto = room ? nights * Number(room.prix_nuit) : 0;
  const montant = form.montant === "" ? auto : Number(form.montant);
  const avance = Number(form.avance) || 0;

  const errors = {
    nom_client: !form.nom_client.trim() && "Obligatoire",
    chambre_id: !form.chambre_id && "Choisissez une chambre",
    date_arrivee: form.date_arrivee < today && "Date passée",
    date_depart: form.date_depart <= form.date_arrivee && "Après l'arrivée",
    avance: (avance < 0 || avance > montant) && "Entre 0 et le montant",
  };
  const valid = !Object.values(errors).some(Boolean);
  const err = (k) => (touched ? errors[k] || null : null);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSubmit({
      nom_client: form.nom_client.trim(), telephone: form.telephone.trim(), chambre_id: Number(form.chambre_id),
      date_arrivee: form.date_arrivee, date_depart: form.date_depart, montant, avance, mode_paiement: form.mode_paiement,
    });
  };

  return (
    <Modal
      title="Nouvelle réservation"
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Annuler</Button>
          <Button icon={CalendarPlus} loading={submitting} onClick={submit}>Créer la réservation</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Nom du client" required error={err("nom_client")}><Input value={form.nom_client} onChange={set("nom_client")} placeholder="Nom et prénoms" /></Field>
        <Field label="Téléphone"><Input value={form.telephone} onChange={set("telephone")} inputMode="tel" placeholder="+225…" /></Field>
        <Field label="Chambre" required error={err("chambre_id")}>
          <Select value={form.chambre_id} onChange={set("chambre_id")}>
            {choices.length === 0 && <option value="">Aucune chambre disponible</option>}
            {choices.map((r) => <option key={r.id} value={r.id}>Chambre {r.numero} — {r.type} — {fmtFCFA(r.prix_nuit)}/nuit</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Arrivée" error={err("date_arrivee")}><Input type="date" min={today} value={form.date_arrivee} onChange={set("date_arrivee")} /></Field>
          <Field label="Départ" error={err("date_depart")}><Input type="date" min={addDays(form.date_arrivee, 1)} value={form.date_depart} onChange={set("date_depart")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (FCFA)" hint={`Calculé : ${fmtFCFA(auto)} (${nights} nuit(s))`}>
            <Input type="number" min={0} step={500} value={form.montant} placeholder={String(auto)} onChange={set("montant")} />
          </Field>
          <Field label="Avance (FCFA)" error={err("avance")}><Input type="number" min={0} step={500} value={form.avance} onChange={set("avance")} /></Field>
        </div>
        {avance > 0 && (
          <Field label="Mode de paiement de l'avance">
            <Select value={form.mode_paiement} onChange={set("mode_paiement")}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
