import React from "react";

export default function EmptyState({ title, hint }) {
  return (
    <div className="card rounded-2xl p-8 flex flex-col items-center text-center gap-1 text-stone-400">
      <div className="text-3xl mb-1">🗂️</div>
      <div className="text-sm font-medium text-stone-500 dark:text-stone-300">{title}</div>
      {hint && <div className="text-xs">{hint}</div>}
    </div>
  );
}
