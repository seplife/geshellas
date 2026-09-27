import React from "react";

export function Input({ className = "", ...props }) {
  return <input {...props} className={`input ${className}`} />;
}

export function Select({ className = "", ...props }) {
  return <select {...props} className={`input pr-8 ${className}`} />;
}

export function Textarea({ className = "", ...props }) {
  return <textarea {...props} className={`input ${className}`} />;
}

export function Field({ label, children, required, hint, error, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="field-label">
        {label} {required && <span className="text-rose-500" aria-hidden="true">*</span>}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-rose-600 dark:text-rose-300">{error}</span>
      ) : (
        hint && <span className="text-xs text-stone-400">{hint}</span>
      )}
    </label>
  );
}
