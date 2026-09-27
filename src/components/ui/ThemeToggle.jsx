import React, { useEffect, useState } from "react";

function getInitialTheme() {
  try {
    const stored = localStorage.getItem("hellas-theme");
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("hellas-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      className={`btn-icon ${className}`}
      aria-label="Basculer le thème clair/sombre"
      title="Basculer le thème clair/sombre"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
