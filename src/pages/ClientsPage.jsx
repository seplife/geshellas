import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, Pencil, Search, Trash2, Users } from "lucide-react";
import Button from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Field.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { Skeleton } from "../components/ui/Spinner.jsx";
import { CAN } from "../constants.js";
import { fmtDate } from "../lib/format.js";

export default function ClientsPage({
  clients,
  error,
  onRetry,
  onSearch,
  onOpen,
  onEdit,
  onDelete,
  role,
  initialQuery = "",
}) {
  const [q, setQ] = useState(initialQuery);
  const first = useRef(true);
  const canOperate = CAN.operate(role);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    const t = setTimeout(() => onSearch(q), 300);
    return () => clearTimeout(t);
    // onSearch est recréé à chaque rendu du parent : seule la saisie compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <PageHeader
        title="Clients"
        subtitle="Fiches clients, modification, suppression et historique des séjours."
      />
      <div className="relative max-w-md">
        <Search
          className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          aria-hidden="true"
        />
        <Input
          placeholder="Nom, téléphone ou n° de pièce…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
          aria-label="Rechercher un client"
        />
      </div>
      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!clients ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            q
              ? "Aucun client ne correspond à la recherche."
              : "Aucun client enregistré."
          }
          hint="Les fiches sont créées automatiquement au check-in ou lors d'un passage."
        />
      ) : (
        <div className="card overflow-hidden overflow-x-auto">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Client</th>
                <th>Téléphone</th>
                <th className="hidden md:table-cell">Pièce d'identité</th>
                <th className="hidden sm:table-cell">Créé le</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => onOpen(c)}
                >
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="h-8 w-8 shrink-0 rounded-full bg-brand-50 dark:bg-brand-700/50 text-brand-700 dark:text-brand-100 text-xs font-semibold flex items-center justify-center">
                        {`${c.nom?.[0] || ""}${c.prenoms?.[0] || ""}`.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        className="font-medium text-left hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(c);
                        }}
                      >
                        {c.nom} {c.prenoms}
                      </button>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{c.telephone}</td>
                  <td className="hidden md:table-cell text-stone-500 dark:text-stone-400">
                    {c.type_piece} · {c.numero_piece}
                  </td>
                  <td className="hidden sm:table-cell text-stone-500 dark:text-stone-400">
                    {fmtDate(c.created_at)}
                  </td>
                  <td
                    className="text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      {canOperate && onEdit && (
                        <Button
                          size="sm"
                          variant="subtle"
                          icon={Pencil}
                          onClick={() => onEdit(c)}
                          title={`Modifier ${c.nom} ${c.prenoms}`}
                        >
                          Modifier
                        </Button>
                      )}
                      {canOperate && onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          onClick={() => onDelete(c)}
                          title={`Supprimer ${c.nom} ${c.prenoms}`}
                        >
                          Supprimer
                        </Button>
                      )}
                      <button
                        type="button"
                        className="btn-icon text-stone-400"
                        onClick={() => onOpen(c)}
                        aria-label={`Ouvrir la fiche de ${c.nom} ${c.prenoms}`}
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
