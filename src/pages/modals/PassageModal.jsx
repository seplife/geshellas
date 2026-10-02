import React, { useMemo, useState } from "react";
import { Clock, Fan, Snowflake } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import {
  ID_TYPES,
  PAY_MODES,
  PASSAGE_TARIFS,
  getRoomClimatisation,
} from "../../constants.js";
import {
  fmtFCFA,
  todayStr,
  nowTime,
  addHoursToDateTime,
  fmtDate,
} from "../../lib/format.js";

const QUICK_HOURS = [1, 2, 3, 4, 5, 6];

export default function PassageModal({ room, rooms, onClose, onSubmit, submitting }) {
  const availableRooms = useMemo(
    () => (rooms || []).filter((r) => r.statut === "libre" || r.id === room?.id),
    [rooms, room]
  );

  const initialRoom = room || availableRooms[0] || null;
  const initialClim = getRoomClimatisation(initialRoom);
  const initialTarif = PASSAGE_TARIFS[initialClim]?.prix_heure || 2500;
  const today = todayStr();
  const currentTime = nowTime();

  const [form, setForm] = useState({
    chambre_id: initialRoom?.id || "",
    type_climatisation: initialClim,
    duree_heures: 1,
    date_entree: today,
    heure_entree: currentTime,
    nb_personnes: 2,
    nom: "",
    prenoms: "",
    telephone: "",
    type_piece: "CNI",
    numero_piece: "",
    mode_paiement: "Espèces",
    montant_paye: initialTarif,
    customPaye: false,
  });

  const selectedRoom = useMemo(
    () => (rooms || []).find((r) => Number(r.id) === Number(form.chambre_id)),
    [rooms, form.chambre_id]
  );

  const tarifHoraire =
    PASSAGE_TARIFS[form.type_climatisation]?.prix_heure || 2500;
  const dureeHeures = Math.max(1, Number(form.duree_heures) || 1);
  const montantTotal = dureeHeures * tarifHoraire;
  const montantPaye = form.customPaye
    ? Math.max(0, Number(form.montant_paye) || 0)
    : montantTotal;
  const solde = montantTotal - montantPaye;

  const sortieCalc = useMemo(
    () => addHoursToDateTime(form.date_entree, form.heure_entree, dureeHeures),
    [form.date_entree, form.heure_entree, dureeHeures]
  );

  const handleRoomChange = (e) => {
    const newId = e.target.value;
    const r = (rooms || []).find((x) => Number(x.id) === Number(newId));
    const clim = getRoomClimatisation(r);
    const newTarif = PASSAGE_TARIFS[clim]?.prix_heure || 2500;
    setForm((f) => ({
      ...f,
      chambre_id: newId,
      type_climatisation: clim,
      montant_paye: f.customPaye ? f.montant_paye : Math.max(1, Number(f.duree_heures) || 1) * newTarif,
    }));
  };

  const handleClimChange = (clim) => {
    const newTarif = PASSAGE_TARIFS[clim]?.prix_heure || 2500;
    setForm((f) => ({
      ...f,
      type_climatisation: clim,
      montant_paye: f.customPaye ? f.montant_paye : Math.max(1, Number(f.duree_heures) || 1) * newTarif,
    }));
  };

  const handleHoursChange = (hrs) => {
    const h = Math.max(1, Number(hrs) || 1);
    setForm((f) => ({
      ...f,
      duree_heures: h,
      montant_paye: f.customPaye ? f.montant_paye : h * tarifHoraire,
    }));
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = Boolean(form.chambre_id) && dureeHeures >= 1 && montantPaye >= 0;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      chambre_id: Number(form.chambre_id),
      room: selectedRoom,
      type_climatisation: form.type_climatisation,
      duree_heures: dureeHeures,
      tarif_horaire: tarifHoraire,
      date_entree: form.date_entree,
      heure_entree: form.heure_entree,
      date_sortie_prevue: sortieCalc.date,
      heure_sortie_prevue: sortieCalc.time,
      nb_personnes: Math.max(1, Number(form.nb_personnes) || 1),
      montant_paye: montantPaye,
      mode_paiement: form.mode_paiement,
      client: {
        nom: form.nom.trim() || "Client",
        prenoms: form.prenoms.trim() || "de passage",
        telephone: form.telephone.trim() || "-",
        type_piece: form.type_piece,
        numero_piece: form.numero_piece.trim() || "PASSAGE",
      },
    });
  };

  return (
    <Modal
      title={`Nouveau passage${selectedRoom ? ` — Chambre ${selectedRoom.numero}` : ""}`}
      subtitle="Tarification à l'heure : 2 000 FCFA/h (ventilée) · 2 500 FCFA/h (climatisée)."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={Clock} loading={submitting} disabled={!valid} onClick={submit}>
            Démarrer le passage ({fmtFCFA(montantTotal)})
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-5"
      >
        {/* 1. Choix de la chambre & tarif horaire */}
        <fieldset className="flex flex-col gap-3">
          <legend className="section-title mb-1">Chambre & Tarification horaire</legend>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Chambre disponible" required>
              <Select value={form.chambre_id} onChange={handleRoomChange}>
                {availableRooms.length === 0 && (
                  <option value="">Aucune chambre libre</option>
                )}
                {availableRooms.map((r) => {
                  const c = getRoomClimatisation(r);
                  const t = PASSAGE_TARIFS[c];
                  return (
                    <option key={r.id} value={r.id}>
                      Chambre {r.numero} — {r.type} ({t.shortLabel} · {fmtFCFA(t.prix_heure)}/h)
                    </option>
                  );
                })}
              </Select>
            </Field>
            <Field label="Nombre de personnes">
              <Input
                type="number"
                min={1}
                max={selectedRoom?.capacite || 4}
                value={form.nb_personnes}
                onChange={set("nb_personnes")}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleClimChange("ventilee")}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                form.type_climatisation === "ventilee"
                  ? "border-brand-600 bg-brand-50/80 dark:bg-brand-700/40 dark:border-brand-300 ring-2 ring-brand-500/20"
                  : "border-stone-200 dark:border-brand-700 hover:border-stone-300"
              }`}
            >
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Fan className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Chambre ventilée</div>
                <div className="text-xs text-stone-500 dark:text-stone-300 font-medium">
                  2 000 FCFA / heure
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleClimChange("climatisee")}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                form.type_climatisation === "climatisee"
                  ? "border-brand-600 bg-brand-50/80 dark:bg-brand-700/40 dark:border-brand-300 ring-2 ring-brand-500/20"
                  : "border-stone-200 dark:border-brand-700 hover:border-stone-300"
              }`}
            >
              <div className="h-10 w-10 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 flex items-center justify-center shrink-0">
                <Snowflake className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Chambre climatisée</div>
                <div className="text-xs text-stone-500 dark:text-stone-300 font-medium">
                  2 500 FCFA / heure
                </div>
              </div>
            </button>
          </div>
        </fieldset>

        {/* 2. Durée & Horaires */}
        <fieldset className="flex flex-col gap-3">
          <legend className="section-title mb-1">Durée du passage</legend>

          <div className="flex flex-wrap items-center gap-2">
            {QUICK_HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => handleHoursChange(h)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  dureeHeures === h
                    ? "bg-brand-700 text-white border-brand-700 dark:bg-ochre-400 dark:text-brand-900 dark:border-ochre-400"
                    : "bg-white dark:bg-brand-800 border-stone-200 dark:border-brand-700 hover:bg-stone-50"
                }`}
              >
                {h} {h > 1 ? "heures" : "heure"} · {fmtFCFA(h * tarifHoraire)}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Nombre d'heures" required>
              <Input
                type="number"
                min={1}
                max={24}
                value={form.duree_heures}
                onChange={(e) => handleHoursChange(e.target.value)}
              />
            </Field>
            <Field label="Heure d'entrée">
              <Input type="time" value={form.heure_entree} onChange={set("heure_entree")} />
            </Field>
            <Field label="Sortie prévue (calculée)">
              <div className="input flex items-center justify-between bg-stone-50 dark:bg-brand-900/60 font-semibold">
                <span>{sortieCalc.time}</span>
                <span className="text-xs font-normal text-stone-500">
                  {fmtDate(sortieCalc.date)}
                </span>
              </div>
            </Field>
          </div>
        </fieldset>

        {/* 3. Client (optionnel pour passage rapide) */}
        <fieldset className="grid sm:grid-cols-2 gap-3">
          <legend className="section-title mb-1">
            Client <span className="text-xs font-normal text-stone-400">(facultatif pour un passage)</span>
          </legend>
          <Field label="Nom" hint="« Client de passage » si laissé vide">
            <Input value={form.nom} onChange={set("nom")} placeholder="Client" autoComplete="off" />
          </Field>
          <Field label="Prénoms">
            <Input value={form.prenoms} onChange={set("prenoms")} placeholder="de passage" autoComplete="off" />
          </Field>
          <Field label="Téléphone">
            <Input value={form.telephone} onChange={set("telephone")} inputMode="tel" placeholder="+225…" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Pièce">
              <Select value={form.type_piece} onChange={set("type_piece")}>
                {ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="N° Pièce">
              <Input value={form.numero_piece} onChange={set("numero_piece")} placeholder="Optionnel" />
            </Field>
          </div>
        </fieldset>

        {/* 4. Paiement */}
        <fieldset className="grid sm:grid-cols-2 gap-3">
          <legend className="section-title mb-1">Encaissement</legend>
          <Field label="Montant encaissé maintenant (FCFA)">
            <Input
              type="number"
              min={0}
              step={500}
              value={montantPaye}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  montant_paye: e.target.value,
                  customPaye: true,
                }))
              }
            />
          </Field>
          <Field label="Mode de paiement">
            <Select value={form.mode_paiement} onChange={set("mode_paiement")}>
              {PAY_MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
        </fieldset>

        {/* Récapitulatif */}
        <div className="rounded-xl p-4 text-sm bg-brand-50 dark:bg-brand-700/30 grid grid-cols-2 gap-y-1.5">
          <span className="text-stone-600 dark:text-stone-300">
            Type de chambre
          </span>
          <span className="text-right font-medium">
            {PASSAGE_TARIFS[form.type_climatisation]?.label} ({fmtFCFA(tarifHoraire)}/h)
          </span>
          <span className="text-stone-600 dark:text-stone-300">
            Durée : {dureeHeures} heure(s) × {fmtFCFA(tarifHoraire)}
          </span>
          <span className="text-right font-semibold">{fmtFCFA(montantTotal)}</span>
          <span className="text-stone-600 dark:text-stone-300">Encaissé maintenant</span>
          <span className="text-right text-emerald-700 dark:text-emerald-300 font-medium">
            {fmtFCFA(montantPaye)}
          </span>
          <span className="font-semibold pt-1 border-t border-brand-100 dark:border-brand-600">
            Reste à payer
          </span>
          <span
            className={`text-right font-semibold pt-1 border-t border-brand-100 dark:border-brand-600 ${
              solde > 0
                ? "text-rose-600 dark:text-rose-300"
                : "text-emerald-600 dark:text-emerald-300"
            }`}
          >
            {fmtFCFA(Math.max(0, solde))}
          </span>
        </div>
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
