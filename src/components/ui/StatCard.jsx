import React from "react";

export default function StatCard({ label, value, accent, icon }) {
  return (
    <div className="card rounded-2xl p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</span>
        {icon && <span className="text-stone-300 dark:text-stone-500">{icon}</span>}
      </div>
      <span className="text-2xl font-semibold font-display" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}
