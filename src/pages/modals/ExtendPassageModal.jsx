import React, { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { Field, Input, Select } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import { PAY_MODES, PASSAGE_TARIFS } from "../../constants.js";
import { fmtFCFA, fmtTime, fmtDate, addHoursToDateTime } from "../../lib/format.js";

export default function ExtendPassageModal({ stay, onClose, onSubmit, submitting }) {
  const clim = stay.type_climatisation === "ventilee" ? "ventilee" : "climatisee";
  const tarif = Number(stay.tarif_horaire) || PASSAGE_TARIFS[clim]?.prix_heure || 2500;

  const [heuresSupp, setHeuresSupp] = useState(1);
  const [paiement, setPaiement] = useState(tarif);
  const [customPaye, setCustomPaye] = useState(false);
  const [mode, setMode] = useState("Espèces");

  const hrs = Math.max(1, Number(heuresSupp) || 1);
  const montantSupp = hrs * tarif;
  const montantEncaisse = customPaye ? Math.max(0, Number(paiement) || 0) : montantSupp;

  const nouvelleSortie = useMemo(
    () => addHoursToDateTime(stay.date_sortie_prevue, stay.heure_sortie_prevue, hrs),
    [stay.date_sortie_prevue, stay.heure_sortie_prevue, hrs]
  );

  const chooseHours = (h) => {
    const val = Math.max(1, Number(h) || 1);
    setHeuresSupp(val);
    if (!customPaye) setPaiement(val * tarif);
  };

  return (
    <Modal
      title={`Prolonger le passage — Chambre ${stay.chambre_numero}`}
      subtitle={`${stay.client_nom} ${stay.client_prenoms} · ${PASSAGE_TARIFS[clim]?.label} (${fmtFCFA(tarif)}/h)`}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Annuler
          </Button>
          <Button
            icon={Clock}
            loading={submitting}
            onClick={() =>
              onSubmit(stay.id, {
                heures_supplementaires: hrs,
                paiement_supplementaire: montantEncaisse,
                mode_paiement: mode,
              })
            }
          >
            Ajouter +{hrs}h ({fmtFCFA(montantSupp)})
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => chooseHours(h)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                hrs === h
                  ? "bg-brand-700 text-white border-brand-700 dark:bg-ochre-400 dark:text-brand-900 dark:border-ochre-400"
                  : "bg-white dark:bg-brand-800 border-stone-200 dark:border-brand-700"
              }`}
            >
              +{h}h ({fmtFCFA(h * tarif)})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Heures supplémentaires">
            <Input
              type="number"
              min={1}
              max={24}
              value={heuresSupp}
              onChange={(e) => chooseHours(e.target.value)}
            />
          </Field>
          <Field label="Nouvelle heure de sortie">
            <div className="input flex items-center justify-between bg-stone-50 dark:bg-brand-900/60 font-semibold">
              <span>{nouvelleSortie.time}</span>
              <span className="text-xs font-normal text-stone-500">
                {fmtDate(nouvelleSortie.date)}
              </span>
            </div>
          </Field>
        </div>

        <div className="rounded-xl p-3 text-sm bg-ochre-100 dark:bg-ochre-500/10 text-ochre-700 dark:text-ochre-200 flex justify-between items-center">
          <span>
            Sortie actuelle : {fmtTime(stay.heure_sortie_prevue)} → Nouvelle : {nouvelleSortie.time}
          </span>
          <strong className="tabular-nums">+ {fmtFCFA(montantSupp)}</strong>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Encaissé maintenant (FCFA)">
            <Input
              type="number"
              min={0}
              step={500}
              value={montantEncaisse}
              onChange={(e) => {
                setPaiement(e.target.value);
                setCustomPaye(true);
              }}
            />
          </Field>
          <Field label="Mode de paiement">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              {PAY_MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
