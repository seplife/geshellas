import React from "react";
import { NAV_ITEMS, NAV_BY_ROLE } from "../../constants.js";

export default function Sidebar({ role, tab, onSelect, open, onClose }) {
  const visible = NAV_ITEMS.filter((item) => NAV_BY_ROLE[role]?.includes(item.key));

  return (
    <>
      <aside
        className={`fixed sm:static z-40 top-0 left-0 h-full sm:h-auto w-72 shrink-0 flex flex-col
          bg-gradient-to-b from-brand-700 to-brand-800 text-white transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"} sm:translate-x-0`}
      >
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center text-lg font-display">
            H
          </div>
          <div>
            <div className="text-lg font-semibold font-display leading-tight">Hellas Hôtel</div>
            <div className="text-xs text-white/60">Divo, Côte d'Ivoire</div>
          </div>
        </div>

        <nav className="flex-1 py-3 flex flex-col gap-1 px-3 overflow-y-auto">
          {visible.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                onSelect(item.key);
                onClose();
              }}
              className={`nav-link ${tab === item.key ? "nav-link-active" : ""}`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 text-[11px] text-white/40 border-t border-white/10 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Connecté à Supabase en temps réel
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-30 sm:hidden" onClick={onClose} />}
    </>
  );
}
