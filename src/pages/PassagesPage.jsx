import React, { useMemo, useState } from "react";
import {
  Clock,
  Plus,
  Search,
  Fan,
  Snowflake,
  LogOut,
  Wallet,
  CalendarPlus,
  AlarmClock,
} from "lucide-react";
import StatCard from "../components/ui/StatCard.jsx";
import Button from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Field.jsx";
import { Pill } from "../components/ui/Badge.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { Skeleton } from "../components/ui/Spinner.jsx";
import {
  CAN,
  PASSAGE_TARIFS,
  getRoomClimatisation,
} from "../constants.js";
import {
  fmtFCFA,
  fmtDate,
  fmtTime,
  todayStr,
  nowTime,
} from "../lib/format.js";

export default function PassagesPage({
  passages,
  rooms,
  error,
  onRetry,
  role,
  onNewPassage,
  onExtendPassage,
  onPayPassage,
  onCheckOutPassage,
}) {
  const [filterStatut, setFilterStatut] = useState("tous");
  const [filterClim, setFilterClim] = useState("tous");
  const [q, setQ] = useState("");

  const list = useMemo(() => passages || [], [passages]);
  const freeRooms = useMemo(
    () => (rooms || []).filter((r) => r.statut === "libre"),
    [rooms]
  );

  const today = todayStr();
  const currentTime = nowTime();
  const canOperate = CAN.operate(role);

  const enCours = useMemo(
    () => list.filter((p) => p.statut === "en_cours"),
    [list]
  );
  const passagesJour = useMemo(
    () => list.filter((p) => p.date_entree === today),
    [list, today]
  );
  const recettesJour = useMemo(
    () =>
      passagesJour.reduce((acc, p) => acc + Number(p.montant_paye || 0), 0),
    [passagesJour]
  );

  const ventileesList = useMemo(
    () => list.filter((p) => p.type_climatisation === "ventilee"),
    [list]
  );
  const climatiseesList = useMemo(
    () => list.filter((p) => p.type_climatisation !== "ventilee"),
    [list]
  );

  const term = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      list.filter((p) => {
        if (filterStatut !== "tous" && p.statut !== filterStatut) return false;
        const clim = p.type_climatisation === "ventilee" ? "ventilee" : "climatisee";
        if (filterClim !== "tous" && clim !== filterClim) return false;
        if (!term) return true;
        return [
          p.numero,
          p.chambre_numero,
          p.client_nom,
          p.client_prenoms,
          p.client_telephone,
        ].some((v) => v && String(v).toLowerCase().includes(term));
      }),
    [list, filterStatut, filterClim, term]
  );

  const isPassageLate = (p) => {
    if (p.statut !== "en_cours") return false;
    if (p.date_sortie_prevue < today) return true;
    if (p.date_sortie_prevue === today && fmtTime(p.heure_sortie_prevue) < currentTime) {
      return true;
    }
    return false;
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <PageHeader
        title="Passages"
        subtitle="Passages à l'heure : 2 000 FCFA/h (chambres ventilées) · 2 500 FCFA/h (chambres climatisées)."
        actions={
          canOperate && (
            <Button icon={Plus} onClick={() => onNewPassage(null)}>
              Nouveau passage
            </Button>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={onRetry} />}

      {/* KPIs et Tarifs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Passages en cours"
          value={enCours.length}
          icon={Clock}
          tone="brand"
          hint={`${freeRooms.length} chambre(s) libre(s)`}
        />
        <StatCard
          label="Recettes passages (jour)"
          value={fmtFCFA(recettesJour)}
          icon={Wallet}
          tone="ochre"
          hint={`${passagesJour.length} passage(s) aujourd'hui`}
        />
        <StatCard
          label="Chambre ventilée"
          value="2 000 FCFA / h"
          icon={Fan}
          tone="green"
          hint={`${ventileesList.length} passage(s) enregistré(s)`}
        />
        <StatCard
          label="Chambre climatisée"
          value="2 500 FCFA / h"
          icon={Snowflake}
          tone="blue"
          hint={`${climatiseesList.length} passage(s) enregistré(s)`}
        />
      </div>

      {/* Démarrage rapide par chambre libre */}
      {canOperate && freeRooms.length > 0 && (
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="section-title">Démarrer un passage rapide — Chambres disponibles</h2>
            <span className="text-xs text-stone-500">
              Cliquez sur une chambre pour lancer un passage
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {freeRooms.map((r) => {
              const clim = getRoomClimatisation(r);
              const isVent = clim === "ventilee";
              const tarif = PASSAGE_TARIFS[clim].prix_heure;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onNewPassage(r)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 dark:border-brand-700 bg-stone-50/70 dark:bg-brand-800/60 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-700/60 transition-colors text-xs"
                >
                  {isVent ? (
                    <Fan className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                  ) : (
                    <Snowflake className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300" />
                  )}
                  <span className="font-semibold text-stone-800 dark:text-stone-100">
                    Ch. {r.numero}
                  </span>
                  <span className="text-stone-500 dark:text-stone-400">
                    {isVent ? "Ventilée" : "Climatisée"} · {fmtFCFA(tarif)}/h
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Passages actuellement en cours */}
      {enCours.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="section-title flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-600 dark:text-ochre-300" />
            Passages en cours ({enCours.length})
          </h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {enCours.map((p) => {
              const isVent = p.type_climatisation === "ventilee";
              const tarif = Number(p.tarif_horaire) || (isVent ? 2000 : 2500);
              const duree = Number(p.duree_heures) || 1;
              const late = isPassageLate(p);
              return (
                <article
                  key={p.id}
                  className={`card p-4 flex flex-col gap-3 border-l-4 ${
                    late
                      ? "border-l-rose-500"
                      : isVent
                        ? "border-l-amber-500"
                        : "border-l-sky-500"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold font-display">
                          Chambre {p.chambre_numero}
                        </h3>
                        <Pill tone={isVent ? "ochre" : "blue"}>
                          {isVent ? "Ventilée · 2 000 F/h" : "Climatisée · 2 500 F/h"}
                        </Pill>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {p.numero} · {p.client_nom} {p.client_prenoms}
                      </div>
                    </div>
                    <Pill tone={late ? "red" : "green"}>
                      {late ? "Heure dépassée" : `${duree}h`}
                    </Pill>
                  </div>

                  <div className="rounded-xl p-3 bg-stone-50 dark:bg-brand-900/50 text-xs flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Horaire</span>
                      <span className="font-medium text-stone-800 dark:text-stone-100">
                        {fmtTime(p.heure_entree)} → {fmtTime(p.heure_sortie_prevue)}
                      </span>
                    </div>
                    {late && (
                      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-300 font-medium">
                        <AlarmClock className="h-3.5 w-3.5" />
                        Sortie prévue à {fmtTime(p.heure_sortie_prevue)} dépassée
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-stone-500">
                        Montant ({duree}h × {fmtFCFA(tarif)})
                      </span>
                      <span className="font-semibold tabular-nums">
                        {fmtFCFA(p.montant_total)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Solde à régler</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          Number(p.solde) > 0
                            ? "text-rose-600 dark:text-rose-300"
                            : "text-emerald-600 dark:text-emerald-300"
                        }`}
                      >
                        {fmtFCFA(p.solde)}
                      </span>
                    </div>
                  </div>

                  {canOperate && (
                    <div className="flex flex-wrap gap-2 mt-auto pt-1">
                      <Button
                        size="sm"
                        variant="subtle"
                        icon={CalendarPlus}
                        onClick={() => onExtendPassage(p)}
                      >
                        + Heure(s)
                      </Button>
                      {Number(p.solde) > 0 && (
                        <Button
                          size="sm"
                          variant="subtle"
                          icon={Wallet}
                          onClick={() => onPayPassage(p)}
                        >
                          Encaisser
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        icon={LogOut}
                        onClick={() => onCheckOutPassage(p)}
                      >
                        Sortie
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtres & Recherche */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex flex-wrap gap-2 flex-1">
          {[
            { key: "tous", label: "Tous", count: list.length },
            { key: "en_cours", label: "En cours", count: enCours.length },
            {
              key: "termine",
              label: "Terminés",
              count: list.filter((x) => x.statut === "termine").length,
            },
          ].map((st) => (
            <button
              key={st.key}
              type="button"
              className={`chip ${filterStatut === st.key ? "chip-active" : ""}`}
              onClick={() => setFilterStatut(st.key)}
            >
              {st.label} <span className="opacity-70">{st.count}</span>
            </button>
          ))}
          <span className="hidden sm:inline text-stone-300 dark:text-brand-700 self-center">|</span>
          {[
            { key: "tous", label: "Tous types" },
            { key: "ventilee", label: "Ventilée (2 000 F/h)" },
            { key: "climatisee", label: "Climatisée (2 500 F/h)" },
          ].map((cl) => (
            <button
              key={cl.key}
              type="button"
              className={`chip ${filterClim === cl.key ? "chip-active" : ""}`}
              onClick={() => setFilterClim(cl.key)}
            >
              {cl.label}
            </button>
          ))}
        </div>

        <div className="relative lg:w-64">
          <Search
            className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <Input
            placeholder="N°, chambre ou client…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Rechercher un passage"
          />
        </div>
      </div>

      {/* Historique / Tableau des passages */}
      {!passages ? (
        <Skeleton className="h-48" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Aucun passage enregistré."
          hint="Enregistrez un passage à l'heure (2 000 FCFA/h ventilée ou 2 500 FCFA/h climatisée)."
          action={
            canOperate && (
              <Button icon={Plus} onClick={() => onNewPassage(null)}>
                Nouveau passage
              </Button>
            )
          }
        />
      ) : (
        <div className="card overflow-hidden overflow-x-auto">
          <table className="table-clean">
            <thead>
              <tr>
                <th>N° Passage</th>
                <th>Chambre</th>
                <th>Type & Tarif</th>
                <th>Client</th>
                <th>Date & Horaire</th>
                <th>Durée</th>
                <th className="text-right">Montant</th>
                <th className="text-right">Payé</th>
                <th>Statut</th>
                {canOperate && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isVent = p.type_climatisation === "ventilee";
                const tarif = Number(p.tarif_horaire) || (isVent ? 2000 : 2500);
                const duree = Number(p.duree_heures) || 1;
                return (
                  <tr key={p.id}>
                    <td className="text-xs font-mono text-stone-500 whitespace-nowrap">
                      {p.numero}
                    </td>
                    <td className="font-semibold whitespace-nowrap">
                      Ch. {p.chambre_numero}
                    </td>
                    <td className="whitespace-nowrap">
                      <Pill tone={isVent ? "ochre" : "blue"}>
                        {isVent ? "Ventilée · 2 000 F/h" : "Climatisée · 2 500 F/h"}
                      </Pill>
                    </td>
                    <td>
                      {p.client_nom} {p.client_prenoms}
                    </td>
                    <td className="whitespace-nowrap text-stone-500 dark:text-stone-400">
                      {fmtDate(p.date_entree)} · {fmtTime(p.heure_entree)} →{" "}
                      {fmtTime(p.heure_sortie_reelle || p.heure_sortie_prevue)}
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      {duree} h <span className="text-xs text-stone-400">({fmtFCFA(tarif)}/h)</span>
                    </td>
                    <td className="text-right font-semibold tabular-nums whitespace-nowrap">
                      {fmtFCFA(p.montant_total)}
                    </td>
                    <td className="text-right tabular-nums whitespace-nowrap">
                      <span
                        className={
                          Number(p.solde) > 0
                            ? "text-rose-600 font-medium"
                            : "text-emerald-600 font-medium"
                        }
                      >
                        {fmtFCFA(p.montant_paye)}
                      </span>
                    </td>
                    <td>
                      <Pill tone={p.statut === "en_cours" ? "green" : "gray"}>
                        {p.statut === "en_cours" ? "En cours" : "Terminé"}
                      </Pill>
                    </td>
                    {canOperate && (
                      <td className="text-right whitespace-nowrap">
                        {p.statut === "en_cours" ? (
                          <div className="inline-flex gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="subtle"
                              onClick={() => onExtendPassage(p)}
                            >
                              +1h
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => onCheckOutPassage(p)}
                            >
                              Sortie
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400">Clôturé</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
