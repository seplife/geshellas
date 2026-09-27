import React from "react";
import Button from "../ui/Button.jsx";
import ThemeToggle from "../ui/ThemeToggle.jsx";
import { ROLE_LABELS } from "../../constants.js";

export default function Topbar({ profile, onOpenNav, onLogout }) {
  const initials = `${profile?.nom?.[0] || ""}${profile?.prenoms?.[0] || ""}`.toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 surface border-x-0 border-t-0">
      <div className="flex items-center gap-3 min-w-0">
        <button className="sm:hidden btn-icon" onClick={onOpenNav} aria-label="Ouvrir le menu">
          ☰
        </button>
        <div className="h-9 w-9 rounded-full bg-brand-100 dark:bg-brand-700 text-brand-700 dark:text-brand-100 flex items-center justify-center text-sm font-semibold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            {profile?.nom} {profile?.prenoms}
            {profile && <span className="text-stone-400 dark:text-stone-500 font-normal"> · {ROLE_LABELS[profile.role]}</span>}
          </div>
          <div className="text-[11px] text-stone-400 capitalize">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />
        <Button variant="subtle" onClick={onLogout}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
