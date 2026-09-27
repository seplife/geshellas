import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { PAY_MODES } from "../../constants.js";
import { fmtFCFA, todayStr, nowTime, nightsBetween } from "../../lib/format.js";

export default function CheckInModal({ room, rooms, onClose, onSubmit, submitting }) {
  const availableRooms = rooms.filter((r) => r.statut === "libre" || r.id === room?.id);
  const [form, setForm] = useState({
    nom: "", prenoms: "", sexe: "M", telephone: "", whatsapp: "", type_piece: "CNI", numero_piece: "",
    chambre_id: room?.id || availableRooms[0]?.id || "",
    date_entree: todayStr(), heure_entree: nowTime(), date_sortie_prevue: todayStr(), heure_sortie_prevue: "12:00",
    nb_personnes: 1, mode_paiement: "Espèces", avance: 0,
  });
  const selectedRoom = rooms.find((r) => r.id === Number(form.chambre_id));
  const nights = selectedRoom ? nightsBetween(form.date_entree, form.date_sortie_prevue) : 0;
  const montant = selectedRoom ? nights * Number(selectedRoom.prix_nuit) : 0;
  const valid = form.nom && form.prenoms && form.telephone && form.numero_piece && form.chambre_id;

  const submit = () =>
    onSubmit({
      client: {
        nom: form.nom, prenoms: form.prenoms, sexe: form.sexe, telephone: form.telephone,
        whatsapp: form.whatsapp, type_piece: form.type_piece, numero_piece: form.numero_piece,
      },
      chambre_id: Number(form.chambre_id),
      date_entree: form.date_entree, heure_entree: form.heure_entree,
      date_sortie_prevue: form.date_sortie_prevue, heure_sortie_prevue: form.heure_sortie_prevue,
      nb_personnes: Number(form.nb_personnes), avance: Number(form.avance), mode_paiement: form.mode_paiement,
    });

  return (
    <Modal title="Enregistrement — Check-in" subtitle="Créer un client et démarrer un séjour." onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nom" required><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
        <Field label="Prénoms" required><Input value={form.prenoms} onChange={(e) => setForm({ ...form, prenoms: e.target.value })} /></Field>
        <Field label="Sexe">
          <Select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
            <option value="M">Masculin</option><option value="F">Féminin</option>
          </Select>
        </Field>
        <Field label="Téléphone" required>
          <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+225…" />
        </Field>
        <Field label="WhatsApp">
          <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="identique si vide" />
        </Field>
        <Field label="Type de pièce">
          <Select value={form.type_piece} onChange={(e) => setForm({ ...form, type_piece: e.target.value })}>
            <option value="CNI">Carte nationale d'identité</option>
            <option value="Passeport">Passeport</option>
            <option value="Permis">Permis de conduire</option>
            <option value="Autre">Autre</option>
          </Select>
        </Field>
        <Field label="Numéro de pièce" required>
          <Input value={form.numero_piece} onChange={(e) => setForm({ ...form, numero_piece: e.target.value })} />
        </Field>
        <Field label="Chambre" required>
          <Select value={form.chambre_id} onChange={(e) => setForm({ ...form, chambre_id: e.target.value })}>
            {availableRooms.map((r) => (
              <option key={r.id} value={r.id}>Chambre {r.numero} — {r.type} — {fmtFCFA(r.prix_nuit)}/nuit</option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre de personnes">
          <Input type="number" min={1} value={form.nb_personnes} onChange={(e) => setForm({ ...form, nb_personnes: e.target.value })} />
        </Field>
        <Field label="Date d'arrivée">
          <Input type="date" value={form.date_entree} onChange={(e) => setForm({ ...form, date_entree: e.target.value })} />
        </Field>
        <Field label="Heure d'entrée">
          <Input type="time" value={form.heure_entree} onChange={(e) => setForm({ ...form, heure_entree: e.target.value })} />
        </Field>
        <Field label="Date de sortie prévue">
          <Input type="date" value={form.date_sortie_prevue} onChange={(e) => setForm({ ...form, date_sortie_prevue: e.target.value })} />
        </Field>
        <Field label="Heure de sortie prévue">
          <Input type="time" value={form.heure_sortie_prevue} onChange={(e) => setForm({ ...form, heure_sortie_prevue: e.target.value })} />
        </Field>
        <Field label="Mode de paiement">
          <Select value={form.mode_paiement} onChange={(e) => setForm({ ...form, mode_paiement: e.target.value })}>
            {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Avance versée (FCFA)">
          <Input type="number" min={0} value={form.avance} onChange={(e) => setForm({ ...form, avance: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 rounded-xl p-3 text-sm flex justify-between bg-brand-50 dark:bg-brand-700/30">
        <span>{nights} nuit(s) — {fmtFCFA(selectedRoom?.prix_nuit || 0)}/nuit</span>
        <strong>Total : {fmtFCFA(montant)}</strong>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button disabled={!valid} loading={submitting} onClick={submit}>Valider le check-in</Button>
      </div>
    </Modal>
  );
}
