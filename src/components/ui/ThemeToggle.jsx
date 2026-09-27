import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function getInitialTheme() {
  try {
    const stored = localStorage.getItem("hellas-theme");
    if (stored) return stored;
  } catch {
    /* stockage indisponible */
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
      /* stockage indisponible */
    }
  }, [theme]);

  const label = theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre";
  return (
    <button type="button" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} className={`btn-icon ${className}`} aria-label={label} title={label}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
