import React from "react";
import Button from "../components/ui/Button.jsx";
import { Select } from "../components/ui/Field.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { ROLE_LABELS } from "../constants.js";
import { fmtDate } from "../lib/format.js";

export default function UsersPage({ users, currentUserId, onCreate, onToggleActive, onChangeRole }) {
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-brand-700 dark:text-brand-100">Utilisateurs</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">Comptes du personnel et leurs rôles.</p>
        </div>
        <Button onClick={onCreate}>+ Nouvel utilisateur</Button>
      </div>

      {users.length === 0 ? (
        <EmptyState title="Aucun utilisateur." />
      ) : (
        <div className="card rounded-2xl overflow-hidden overflow-x-auto">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Créé le</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.nom} {u.prenoms}</td>
                  <td>
                    <Select
                      value={u.role}
                      onChange={(e) => onChangeRole(u.id, e.target.value)}
                      className="w-auto py-1.5"
                      disabled={u.id === currentUserId}
                    >
                      {Object.entries(ROLE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <span className={`badge ${u.actif ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-stone-100 text-stone-500 dark:bg-stone-700/40 dark:text-stone-300"}`}>
                      {u.actif ? "Actif" : "Désactivé"}
                    </span>
                  </td>
                  <td className="text-stone-500 dark:text-stone-400">{fmtDate(u.created_at)}</td>
                  <td className="text-right">
                    {u.id !== currentUserId && (
                      <Button variant={u.actif ? "ghost" : "subtle"} onClick={() => onToggleActive(u.id, !u.actif)}>
                        {u.actif ? "Désactiver" : "Réactiver"}
                      </Button>
                    )}
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
