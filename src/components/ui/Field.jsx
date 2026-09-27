import React from "react";

export function Input(props) {
  return <input {...props} className={`input ${props.className || ""}`} />;
}

export function Select(props) {
  return <select {...props} className={`input ${props.className || ""}`} />;
}

export function Textarea(props) {
  return <textarea {...props} className={`input ${props.className || ""}`} />;
}

export function Field({ label, children, required, hint }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="field-label">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-stone-400">{hint}</span>}
    </label>
  );
}
