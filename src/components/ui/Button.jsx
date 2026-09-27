import React from "react";

const VARIANT_CLASS = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  subtle: "btn-subtle",
  danger: "btn-danger",
};

export default function Button({ children, variant = "primary", className = "", loading, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`${VARIANT_CLASS[variant] || VARIANT_CLASS.primary} ${className}`}
    >
      {loading && (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
