import React from "react";
import { X } from "lucide-react";
import { NAV_ITEMS, NAV_BY_ROLE } from "../../constants.js";

export function Logo({ size = "md" }) {
  const box = size === "lg" ? "h-14 w-14 text-2xl rounded-2xl" : "h-10 w-10 text-lg rounded-xl";
  return (
    <div className={`${box} bg-gradient-to-br from-ochre-300 to-ochre-500 text-brand-900 flex items-center justify-center font-display font-bold shadow-inner`}>
      H
    </div>
  );
}

export default function Sidebar({ role, tab, onSelect, open, onClose, live, badges = {} }) {
  const visible = NAV_ITEMS.filter((item) => NAV_BY_ROLE[role]?.includes(item.key));

  return (
    <>
      <aside
        className={`fixed lg:sticky z-40 top-0 left-0 h-screen w-64 shrink-0 flex flex-col
          bg-gradient-to-b from-brand-700 to-brand-900 text-white transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        aria-label="Navigation principale"
      >
        <div className="p-5 flex items-center gap-3">
          <Logo />
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold font-display leading-tight">Hellas Hôtel</div>
            <div className="text-xs text-white/60">Divo · Côte d'Ivoire</div>
          </div>
          <button type="button" className="lg:hidden btn-icon text-white/70 hover:bg-white/10" onClick={onClose} aria-label="Fermer le menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 py-2 flex flex-col gap-0.5 px-3 overflow-y-auto">
          {visible.map((item) => {
            const Icon = item.icon;
            const badge = badges[item.key];
            return (
              <button
                type="button"
                key={item.key}
                onClick={() => {
                  onSelect(item.key);
                  onClose();
                }}
                aria-current={tab === item.key ? "page" : undefined}
                className={`nav-link ${tab === item.key ? "nav-link-active" : ""}`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-ochre-400 text-brand-900 text-[11px] font-semibold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 text-[11px] text-white/50 border-t border-white/10 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-stone-400"}`} aria-hidden="true" />
          {live ? "Synchronisé en temps réel" : "Connexion temps réel…"}
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} aria-hidden="true" />}
    </>
  );
}
