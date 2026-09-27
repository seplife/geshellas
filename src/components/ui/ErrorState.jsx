import React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import Button from "./Button.jsx";

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="card p-6 flex flex-col sm:flex-row sm:items-center gap-4 border-rose-200 dark:border-rose-500/30">
      <span className="h-10 w-10 shrink-0 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 flex items-center justify-center">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">Chargement impossible</div>
        <div className="text-sm text-stone-600 dark:text-stone-300 mt-0.5">{message}</div>
      </div>
      {onRetry && (
        <Button variant="subtle" icon={RotateCw} onClick={onRetry} className="shrink-0">
          Réessayer
        </Button>
      )}
    </div>
  );
}
