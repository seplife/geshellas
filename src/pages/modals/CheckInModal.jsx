import React, { useMemo, useState } from "react";
import { LogIn } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { ID_TYPES, PAY_MODES } from "../../constants.js";
import { fmtFCFA, todayStr, nowTime, nightsBetween, addDays } from "../../lib/format.js";

function splitName(full = "") {
  const parts = full.trim().split(/\s+/);
  return { nom: parts[0] || "", prenoms: parts.slice(1).join(" ") };
}

export default function CheckInModal({ room, reservation, rooms, onClose, onSubmit, submitting }) {
  const availableRooms = useMemo(
    () => (reservation ? rooms.filter((r) => r.id === room.id) : rooms.filter((r) => r.statut === "libre" || r.id === room?.id)),
    [rooms, room, reservation]
  );
  const today = todayStr();
  const fromResa = reservation ? splitName(reservation.nom_client) : { nom: "", prenoms: "" };

  const [form, setForm] = useState({
    nom: fromResa.nom, prenoms: fromResa.prenoms, sexe: "M",
    telephone: reservation?.telephone || "", whatsapp: "", email: "", nationalite: "Ivoirienne",
    type_piece: "CNI", numero_piece: "",
    chambre_id: room?.id || availableRooms[0]?.id || "",
    date_entree: today, heure_entree: nowTime(),
    date_sortie_prevue: reservation?.date_depart && reservation.date_depart > today ? reservation.date_depart : addDays(today, 1),
    heure_sortie_prevue: "12:00",
    nb_personnes: 1, mode_paiement: "Espèces", avance: 0,
  });
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const selectedRoom = rooms.find((r) => r.id === Number(form.chambre_id));
  const nights = nightsBetween(form.date_entree, form.date_sortie_prevue);
  const montant = selectedRoom ? nights * Number(selectedRoom.prix_nuit) : 0;
  const avanceResa = Number(reservation?.avance || 0);
  const avance = Number(form.avance) || 0;
  const solde = montant - avanceResa - avance;

  const errors = {
    nom: !form.nom.trim() && "Obligatoire",
    prenoms: !form.prenoms.trim() && "Obligatoire",
    telephone: !form.telephone.trim() ? "Obligatoire" : !/^\+?[\d\s.-]{6,}$/.test(form.telephone.trim()) && "Numéro invalide",
    numero_piece: !form.numero_piece.trim() && "Obligatoire",
    chambre_id: !form.chambre_id && "Aucune chambre disponible",
    date_sortie_prevue: form.date_sortie_prevue < form.date_entree && "Avant la date d'arrivée",
    nb_personnes: selectedRoom && Number(form.nb_personnes) > selectedRoom.capacite && `Capacité max. ${selectedRoom.capacite}`,
    avance: avance < 0 && "Montant invalide",
  };
  const valid = !Object.values(errors).some(Boolean);
  const err = (k) => (touched ? errors[k] || null : null);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSubmit({
      client: {
        nom: form.nom.trim(), prenoms: form.prenoms.trim(), sexe: form.sexe, telephone: form.telephone.trim(),
        whatsapp: form.whatsapp.trim(), email: form.email.trim(), nationalite: form.nationalite.trim(),
        type_piece: form.type_piece, numero_piece: form.numero_piece.trim(),
      },
      chambre_id: Number(form.chambre_id),
      date_entree: form.date_entree, heure_entree: form.heure_entree,
      date_sortie_prevue: form.date_sortie_prevue, heure_sortie_prevue: form.heure_sortie_prevue,
      nb_personnes: Number(form.nb_personnes), avance, mode_paiement: form.mode_paiement,
      reservation_id: reservation?.id ?? null,
    });
  };

  return (
    <Modal
      title={`Check-in — Chambre ${selectedRoom?.numero ?? ""}`}
      subtitle={reservation ? `Arrivée de la réservation de ${reservation.nom_client}.` : "Enregistrer le client et démarrer le séjour."}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Annuler</Button>
          <Button icon={LogIn} loading={submitting} onClick={submit}>Valider le check-in</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-5">
        <fieldset className="grid sm:grid-cols-2 gap-3">
          <legend className="section-title mb-2">Client</legend>
          <Field label="Nom" required error={err("nom")}><Input value={form.nom} onChange={set("nom")} autoComplete="off" /></Field>
          <Field label="Prénoms" required error={err("prenoms")}><Input value={form.prenoms} onChange={set("prenoms")} autoComplete="off" /></Field>
          <Field label="Téléphone" required error={err("telephone")}><Input value={form.telephone} onChange={set("telephone")} inputMode="tel" placeholder="+225…" /></Field>
          <Field label="WhatsApp" hint="Identique au téléphone si vide"><Input value={form.whatsapp} onChange={set("whatsapp")} inputMode="tel" /></Field>
          <Field label="Type de pièce">
            <Select value={form.type_piece} onChange={set("type_piece")}>
              {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Numéro de pièce" required error={err("numero_piece")} hint="Une fiche existante est réutilisée">
            <Input value={form.numero_piece} onChange={set("numero_piece")} autoComplete="off" />
          </Field>
          <Field label="Sexe">
            <Select value={form.sexe} onChange={set("sexe")}>
              <option value="M">Masculin</option><option value="F">Féminin</option>
            </Select>
          </Field>
          <Field label="Nationalité"><Input value={form.nationalite} onChange={set("nationalite")} /></Field>
        </fieldset>

        <fieldset className="grid sm:grid-cols-2 gap-3">
          <legend className="section-title mb-2">Séjour</legend>
          <Field label="Chambre" required error={err("chambre_id")}>
            <Select value={form.chambre_id} onChange={set("chambre_id")} disabled={!!reservation}>
              {availableRooms.length === 0 && <option value="">Aucune chambre libre</option>}
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>Chambre {r.numero} — {r.type} — {fmtFCFA(r.prix_nuit)}/nuit</option>
              ))}
            </Select>
          </Field>
          <Field label="Nombre de personnes" error={err("nb_personnes")}>
            <Input type="number" min={1} value={form.nb_personnes} onChange={set("nb_personnes")} />
          </Field>
          <Field label="Arrivée"><Input type="date" value={form.date_entree} onChange={set("date_entree")} /></Field>
          <Field label="Heure d'arrivée"><Input type="time" value={form.heure_entree} onChange={set("heure_entree")} /></Field>
          <Field label="Sortie prévue" error={err("date_sortie_prevue") || (touched && errors.date_sortie_prevue)}>
            <Input type="date" min={form.date_entree} value={form.date_sortie_prevue} onChange={set("date_sortie_prevue")} />
          </Field>
          <Field label="Heure de sortie"><Input type="time" value={form.heure_sortie_prevue} onChange={set("heure_sortie_prevue")} /></Field>
        </fieldset>

        <fieldset className="grid sm:grid-cols-2 gap-3">
          <legend className="section-title mb-2">Paiement</legend>
          <Field label="Avance encaissée maintenant (FCFA)" error={err("avance")}>
            <Input type="number" min={0} step={500} value={form.avance} onChange={set("avance")} />
          </Field>
          <Field label="Mode de paiement">
            <Select value={form.mode_paiement} onChange={set("mode_paiement")}>
              {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
        </fieldset>

        <div className="rounded-xl p-4 text-sm bg-brand-50 dark:bg-brand-700/30 grid grid-cols-2 gap-y-1">
          <span className="text-stone-600 dark:text-stone-300">{nights} nuit(s) × {fmtFCFA(selectedRoom?.prix_nuit || 0)}</span>
          <span className="text-right font-semibold">{fmtFCFA(montant)}</span>
          {avanceResa > 0 && (<><span className="text-stone-600 dark:text-stone-300">Avance de réservation</span><span className="text-right">− {fmtFCFA(avanceResa)}</span></>)}
          {avance > 0 && (<><span className="text-stone-600 dark:text-stone-300">Avance ce jour</span><span className="text-right">− {fmtFCFA(avance)}</span></>)}
          <span className="font-semibold pt-1 border-t border-brand-100 dark:border-brand-600">Reste à payer</span>
          <span className={`text-right font-semibold pt-1 border-t border-brand-100 dark:border-brand-600 ${solde > 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"}`}>{fmtFCFA(solde)}</span>
        </div>
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
