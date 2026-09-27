import React, { useEffect, useState } from "react";
import { Input } from "../components/ui/Field.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

export default function ClientsPage({ clients, onSearch }) {
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => onSearch(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-brand-700 dark:text-brand-100">Clients</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">Historique et fiches clients.</p>
      </div>
      <Input
        placeholder="Rechercher par nom, téléphone ou n° de pièce…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
      {clients.length === 0 ? (
        <EmptyState title="Aucun client trouvé." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {clients.map((c) => (
            <div key={c.id} className="card rounded-2xl p-4">
              <div className="font-semibold">{c.nom} {c.prenoms}</div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {c.telephone} · {c.type_piece} n° {c.numero_piece}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
