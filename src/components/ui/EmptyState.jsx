import React from "react";
import { Inbox } from "lucide-react";

export default function EmptyState({ title, hint, icon: Icon = Inbox, action }) {
  return (
    <div className="card p-10 flex flex-col items-center text-center gap-1.5">
      <span className="h-11 w-11 rounded-2xl bg-stone-100 dark:bg-brand-700/40 flex items-center justify-center text-stone-400 mb-1">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="text-sm font-medium text-stone-600 dark:text-stone-300">{title}</div>
      {hint && <div className="text-xs text-stone-400 max-w-sm">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
