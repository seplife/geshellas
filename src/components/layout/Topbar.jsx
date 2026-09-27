import React from "react";
import { LogOut, Menu, RotateCw } from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle.jsx";
import { ROLE_LABELS } from "../../constants.js";

export default function Topbar({ profile, onOpenNav, onLogout, onRefresh, refreshing }) {
  const initials = `${profile?.nom?.[0] || ""}${profile?.prenoms?.[0] || ""}`.toUpperCase() || "?";
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 h-16 bg-white/80 dark:bg-brand-900/80 backdrop-blur border-b border-stone-200 dark:border-brand-700/60">
      <div className="flex items-center gap-2 min-w-0">
        <button type="button" className="lg:hidden btn-icon" onClick={onOpenNav} aria-label="Ouvrir le menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-sm text-stone-500 dark:text-stone-400 capitalize truncate hidden sm:block">{today}</div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button type="button" className="btn-icon" onClick={onRefresh} aria-label="Actualiser les données" title="Actualiser">
          <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
        <ThemeToggle />
        <div className="hidden sm:block h-6 w-px bg-stone-200 dark:bg-brand-700 mx-1" />
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-full bg-brand-100 dark:bg-brand-700 text-brand-700 dark:text-brand-100 flex items-center justify-center text-sm font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 hidden md:block">
            <div className="text-sm font-semibold truncate max-w-[180px]">{profile?.nom} {profile?.prenoms}</div>
            <div className="text-[11px] text-stone-500 dark:text-stone-400">{ROLE_LABELS[profile?.role]}</div>
          </div>
        </div>
        <button type="button" className="btn-icon" onClick={onLogout} aria-label="Se déconnecter" title="Se déconnecter">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
