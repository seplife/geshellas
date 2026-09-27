import React from "react";

export const STATUS = {
  libre: { label: "Libre", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500", ring: "ring-emerald-500/40", tile: "bg-emerald-500" },
  occupee: { label: "Occupée", className: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", dot: "bg-rose-500", ring: "ring-rose-500/40", tile: "bg-rose-500" },
  reservee: { label: "Réservée", className: "bg-ochre-100 text-ochre-700 dark:bg-ochre-500/20 dark:text-ochre-200", dot: "bg-ochre-500", ring: "ring-ochre-500/40", tile: "bg-ochre-500" },
  nettoyage: { label: "Nettoyage", className: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", dot: "bg-sky-500", ring: "ring-sky-500/40", tile: "bg-sky-500" },
  maintenance: { label: "Maintenance", className: "bg-stone-100 text-stone-600 dark:bg-stone-500/20 dark:text-stone-300", dot: "bg-stone-500", ring: "ring-stone-500/40", tile: "bg-stone-500" },
};

const TONES = {
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  red: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  ochre: "bg-ochre-100 text-ochre-700 dark:bg-ochre-500/20 dark:text-ochre-200",
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  gray: "bg-stone-100 text-stone-600 dark:bg-stone-600/30 dark:text-stone-300",
};

/** Pastille générique (statut de réservation, de compte, de notification…). */
export function Pill({ tone = "gray", children }) {
  return <span className={`badge ${TONES[tone] || TONES.gray}`}>{children}</span>;
}

export default function Badge({ statut }) {
  const s = STATUS[statut] || STATUS.libre;
  return (
    <span className={`badge ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}
