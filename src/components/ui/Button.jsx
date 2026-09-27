import React from "react";

const VARIANT_CLASS = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  subtle: "btn-subtle",
  danger: "btn-danger",
};

export default function Button({ children, variant = "primary", size, icon: Icon, className = "", loading, type = "button", ...props }) {
  return (
    <button
      type={type}
      {...props}
      disabled={props.disabled || loading}
      className={`${VARIANT_CLASS[variant] || VARIANT_CLASS.primary} ${size === "sm" ? "btn-sm" : ""} ${className}`}
    >
      {loading ? (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
