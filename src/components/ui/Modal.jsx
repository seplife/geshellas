import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({ title, subtitle, onClose, children, footer, wide }) {
  const panel = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus sur le premier champ pour une saisie immédiate.
    const first = panel.current?.querySelector("input:not([type=hidden]), select, textarea");
    first?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-brand-900/50 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full flex flex-col max-h-[92vh] rounded-t-2xl sm:rounded-2xl card animate-slide-up ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-brand-700 dark:text-brand-100">{title}</h3>
            {subtitle && <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="btn-icon shrink-0 -mr-2 -mt-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 sm:px-6 pb-2 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 px-5 sm:px-6 py-4 border-t border-stone-100 dark:border-brand-700/50 mt-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
