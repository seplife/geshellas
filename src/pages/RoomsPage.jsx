import React, { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  CalendarPlus,
  Wallet,
  Wrench,
  Sparkles,
  BedDouble,
  Users as UsersIcon,
  Clock,
  Fan,
  Snowflake,
} from "lucide-react";
import Badge, { STATUS, Pill } from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import { Input, Select } from "../components/ui/Field.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { Skeleton } from "../components/ui/Spinner.jsx";
import { CAN, getRoomClimatisation, getPassageHoraire } from "../constants.js";
import { fmtFCFA, fmtDate, fmtTime, todayStr, nowTime } from "../lib/format.js";

export default function RoomsPage({
  rooms,
  activeStays,
  error,
  onRetry,
  role,
  onCheckIn,
  onPassage,
  onCheckOut,
  onExtend,
  onPay,
  onClean,
  onMaintenance,
  onCreateRoom,
  onEditRoom,
  onDeleteRoom,
}) {
  const [filterStatus, setFilterStatus] = useState("tous");
  const [filterFloor, setFilterFloor] = useState("tous");
  const [q, setQ] = useState("");

  const list = useMemo(() => rooms || [], [rooms]);
  const floors = useMemo(
    () => [...new Set(list.map((r) => r.etage))].sort((a, b) => a - b),
    [list]
  );
  const counts = useMemo(
    () =>
      list.reduce(
        (acc, r) => ({ ...acc, [r.statut]: (acc[r.statut] || 0) + 1 }),
        {}
      ),
    [list]
  );
  const stayFor = (roomId) =>
    activeStays.find((s) => Number(s.chambre_id) === Number(roomId));
  const term = q.trim().toLowerCase();

  const filtered = list.filter((r) => {
    if (filterStatus !== "tous" && r.statut !== filterStatus) return false;
    if (filterFloor !== "tous" && r.etage !== Number(filterFloor)) return false;
    if (!term) return true;
    const stay = stayFor(r.id);
    return [r.numero, r.type, stay?.client_nom, stay?.client_prenoms].some(
      (v) => v && String(v).toLowerCase().includes(term)
    );
  });

  const canOperate = CAN.operate(role);
  const canManageRooms = CAN.manageRooms(role);
  const canClean = CAN.clean(role);
  const canReport = CAN.reportIssue(role);
  const today = todayStr();
  const currentTime = nowTime();

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <PageHeader
        title="Chambres"
        subtitle={
          rooms
            ? `${filtered.length} affichée(s) sur ${list.length}`
            : "Chargement…"
        }
        actions={
          canManageRooms && (
            <Button icon={Plus} onClick={onCreateRoom}>
              Nouvelle chambre
            </Button>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={onRetry} />}

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex flex-wrap gap-2 flex-1">
          <button
            type="button"
            className={`chip ${filterStatus === "tous" ? "chip-active" : ""}`}
            onClick={() => setFilterStatus("tous")}
          >
            Toutes <span className="opacity-70">{list.length}</span>
          </button>
          {Object.entries(STATUS).map(([k, v]) => (
            <button
              type="button"
              key={k}
              className={`chip ${filterStatus === k ? "chip-active" : ""}`}
              onClick={() => setFilterStatus(k)}
            >
              <span
                className={`h-2 w-2 rounded-full ${v.dot}`}
                aria-hidden="true"
              />
              {v.label} <span className="opacity-70">{counts[k] || 0}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-56">
            <Search
              className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <Input
              placeholder="N°, type ou client…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              aria-label="Rechercher une chambre"
            />
          </div>
          {floors.length > 1 && (
            <Select
              value={filterFloor}
              onChange={(e) => setFilterFloor(e.target.value)}
              className="w-auto"
              aria-label="Filtrer par étage"
            >
              <option value="tous">Tous étages</option>
              {floors.map((f) => (
                <option key={f} value={f}>
                  Étage {f}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {!rooms ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title={
            list.length === 0
              ? "Aucune chambre configurée."
              : "Aucune chambre ne correspond à ces filtres."
          }
          hint={
            list.length === 0 && canManageRooms
              ? "Ajoutez vos chambres pour commencer."
              : undefined
          }
          action={
            list.length === 0 &&
            canManageRooms && (
              <Button icon={Plus} onClick={onCreateRoom}>
                Nouvelle chambre
              </Button>
            )
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((room) => {
            const stay = stayFor(room.id);
            const isPassage = stay?.type_sejour === "passage";
            const late =
              stay &&
              (stay.date_sortie_prevue < today ||
                (isPassage &&
                  stay.date_sortie_prevue === today &&
                  fmtTime(stay.heure_sortie_prevue) < currentTime));
            const clim = getRoomClimatisation(room);
            const isVent = clim === "ventilee";
            const tarifPassage = getPassageHoraire(clim);

            return (
              <article
                key={room.id}
                className="card p-4 flex flex-col gap-3 hover:shadow-pop transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-lg font-semibold font-display">
                        Chambre {room.numero}
                      </h3>
                      {canManageRooms && (
                        <>
                          <button
                            type="button"
                            className="btn-icon h-7 w-7"
                            onClick={() => onEditRoom(room)}
                            title={`Modifier la chambre ${room.numero}`}
                            aria-label={`Modifier la chambre ${room.numero}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {onDeleteRoom && (
                            <button
                              type="button"
                              className="btn-icon h-7 w-7 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                              onClick={() => onDeleteRoom(room)}
                              title={`Supprimer la chambre ${room.numero}`}
                              aria-label={`Supprimer la chambre ${room.numero}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 flex flex-wrap items-center gap-x-2">
                      <span>{room.type}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        {isVent ? (
                          <Fan className="h-3 w-3 text-amber-500" />
                        ) : (
                          <Snowflake className="h-3 w-3 text-sky-500" />
                        )}
                        {isVent ? "Ventilée" : "Climatisée"}
                      </span>
                      <span>·</span>
                      <span>Étage {room.etage}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <UsersIcon className="h-3 w-3" aria-hidden="true" />
                        {room.capacite}
                      </span>
                    </div>
                  </div>
                  <Badge statut={room.statut} />
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold tabular-nums">
                    {fmtFCFA(room.prix_nuit)}{" "}
                    <span className="text-xs font-normal text-stone-500">
                      / nuit
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    Passage :{" "}
                    <strong className="text-stone-700 dark:text-stone-200">
                      {fmtFCFA(tarifPassage)}/h
                    </strong>
                  </div>
                </div>

                {stay && (
                  <div className="text-xs rounded-xl p-3 bg-stone-50 dark:bg-brand-900/50 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm text-stone-800 dark:text-stone-100 truncate">
                        {stay.client_nom} {stay.client_prenoms}
                      </div>
                      {isPassage && (
                        <Pill tone="ochre">
                          Passage {stay.duree_heures || 1}h
                        </Pill>
                      )}
                    </div>
                    <div
                      className={
                        late
                          ? "text-rose-600 dark:text-rose-300 font-medium"
                          : "text-stone-500 dark:text-stone-400"
                      }
                    >
                      Sortie prévue {fmtDate(stay.date_sortie_prevue)} à{" "}
                      {fmtTime(stay.heure_sortie_prevue)}
                      {late && " — dépassée"}
                    </div>
                    <div className="text-stone-500 dark:text-stone-400">
                      Solde :{" "}
                      <span
                        className={
                          Number(stay.solde) > 0
                            ? "text-rose-600 dark:text-rose-300 font-semibold"
                            : "text-emerald-600 dark:text-emerald-300 font-semibold"
                        }
                      >
                        {fmtFCFA(stay.solde)}
                      </span>
                    </div>
                  </div>
                )}

                {room.panne_note && (
                  <div className="text-xs rounded-xl p-2.5 bg-ochre-50 text-ochre-700 dark:bg-ochre-500/10 dark:text-ochre-200 flex gap-2">
                    <Wrench
                      className="h-3.5 w-3.5 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      {room.panne_note}
                      {room.statut === "occupee" &&
                        " (maintenance au départ du client)"}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-auto pt-1">
                  {(room.statut === "libre" || room.statut === "reservee") &&
                    canOperate && (
                      <>
                        <Button
                          size="sm"
                          icon={LogIn}
                          onClick={() => onCheckIn(room)}
                        >
                          Check-in
                        </Button>
                        {room.statut === "libre" && onPassage && (
                          <Button
                            size="sm"
                            variant="subtle"
                            icon={Clock}
                            onClick={() => onPassage(room)}
                          >
                            Passage
                          </Button>
                        )}
                      </>
                    )}
                  {stay && canOperate && (
                    <>
                      <Button
                        size="sm"
                        variant="subtle"
                        icon={Wallet}
                        onClick={() => onPay(stay)}
                      >
                        Paiement
                      </Button>
                      <Button
                        size="sm"
                        variant="subtle"
                        icon={CalendarPlus}
                        onClick={() => onExtend(stay)}
                      >
                        {isPassage ? "+ Heure(s)" : "Prolonger"}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={LogOut}
                        onClick={() => onCheckOut(stay)}
                      >
                        Check-out
                      </Button>
                    </>
                  )}
                  {room.statut === "nettoyage" && canClean && (
                    <Button
                      size="sm"
                      icon={Sparkles}
                      onClick={() => onClean(room)}
                    >
                      Nettoyage terminé
                    </Button>
                  )}
                  {room.statut === "maintenance" && canClean && (
                    <Button
                      size="sm"
                      variant="subtle"
                      icon={Sparkles}
                      onClick={() => onClean(room)}
                    >
                      Remettre en service
                    </Button>
                  )}
                  {room.statut !== "maintenance" && canReport && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Wrench}
                      onClick={() => onMaintenance(room)}
                    >
                      Anomalie
                    </Button>
                  )}
                  {canManageRooms && (
                    <>
                      <Button
                        size="sm"
                        variant="subtle"
                        icon={Pencil}
                        onClick={() => onEditRoom(room)}
                      >
                        Modifier
                      </Button>
                      {onDeleteRoom && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          onClick={() => onDeleteRoom(room)}
                        >
                          Supprimer
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
