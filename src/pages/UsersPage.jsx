import React from "react";
import { Plus, ShieldCheck } from "lucide-react";
import Button from "../components/ui/Button.jsx";
import { Select } from "../components/ui/Field.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { Pill } from "../components/ui/Badge.jsx";
import { Skeleton } from "../components/ui/Spinner.jsx";
import { ROLE_LABELS } from "../constants.js";
import { fmtDate, fmtDateTime } from "../lib/format.js";

export default function UsersPage({ users, error, onRetry, currentUserId, onCreate, onToggleActive, onChangeRole }) {
  const pendingCount = (users || []).filter((u) => !u.actif && !u.last_sign_in_at).length;

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <PageHeader
        title="Utilisateurs"
        subtitle="Comptes du personnel, rôles et accès."
        actions={<Button icon={Plus} onClick={onCreate}>Nouvel utilisateur</Button>}
      />
      {error && <ErrorState message={error} onRetry={onRetry} />}
      {pendingCount > 0 && (
        <div className="text-sm rounded-xl p-3 bg-ochre-100 text-ochre-700 dark:bg-ochre-500/10 dark:text-ochre-200">
          {pendingCount} compte(s) créé(s) hors de l'application attendent une activation. Vérifiez leur identité avant de les activer.
        </div>
      )}

      {!users ? (
        <Skeleton className="h-48" />
      ) : users.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Aucun utilisateur." />
      ) : (
        <div className="card overflow-hidden overflow-x-auto">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th className="hidden md:table-cell">Dernière connexion</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="font-medium">{u.nom} {u.prenoms} {self && <span className="text-xs text-stone-400">(vous)</span>}</div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">{u.email || "—"}</div>
                    </td>
                    <td>
                      <Select
                        value={u.role}
                        onChange={(e) => onChangeRole(u.id, e.target.value)}
                        className="w-auto py-1.5"
                        disabled={self}
                        aria-label={`Rôle de ${u.nom}`}
                      >
                        {Object.entries(ROLE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </Select>
                    </td>
                    <td>
                      <Pill tone={u.actif ? "green" : "gray"}>{u.actif ? "Actif" : "Désactivé"}</Pill>
                    </td>
                    <td className="hidden md:table-cell text-stone-500 dark:text-stone-400 whitespace-nowrap">
                      {u.last_sign_in_at ? fmtDateTime(u.last_sign_in_at) : `Jamais · créé le ${fmtDate(u.created_at)}`}
                    </td>
                    <td className="text-right">
                      {!self && (
                        <Button size="sm" variant={u.actif ? "ghost" : "primary"} onClick={() => onToggleActive(u)}>
                          {u.actif ? "Désactiver" : "Activer"}
                        </Button>
                      )}
                    </td>
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
