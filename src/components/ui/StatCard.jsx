import React from "react";

const TONES = {
  default: "bg-stone-100 text-stone-600 dark:bg-brand-700/50 dark:text-stone-200",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  red: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  ochre: "bg-ochre-100 text-ochre-700 dark:bg-ochre-500/20 dark:text-ochre-200",
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-600/40 dark:text-brand-100",
};

export default function StatCard({ label, value, hint, icon: Icon, tone = "default" }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      {Icon && (
        <span className={`h-9 w-9 shrink-0 rounded-xl hidden sm:flex items-center justify-center ${TONES[tone] || TONES.default}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</div>
        <div className="text-lg sm:text-2xl font-semibold tabular-nums leading-tight mt-0.5 break-words">{value}</div>
        {hint && <div className="text-[11px] text-stone-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
