import React, { useEffect } from "react";

export default function Modal({ title, subtitle, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto bg-brand-900/40 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full rounded-2xl2 p-5 sm:p-6 my-6 card animate-slide-up ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h3 className="text-lg font-semibold text-brand-700 dark:text-brand-100">{title}</h3>
            {subtitle && <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="btn-icon shrink-0 -mr-1 -mt-1"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
