export const ROLE_LABELS = {
  admin: "Administrateur",
  gerant: "Gérant",
  reception: "Réceptionniste",
  entretien: "Entretien",
};

export const NAV_ITEMS = [
  { key: "dashboard", label: "Tableau de bord", icon: "📊" },
  { key: "rooms", label: "Chambres", icon: "🚪" },
  { key: "clients", label: "Clients", icon: "👥" },
  { key: "reservations", label: "Réservations", icon: "📅" },
  { key: "payments", label: "Paiements", icon: "💳" },
  { key: "notifications", label: "Notifications", icon: "💬" },
  { key: "users", label: "Utilisateurs", icon: "🔐" },
  { key: "settings", label: "Paramètres", icon: "⚙️" },
];

export const NAV_BY_ROLE = {
  admin: ["dashboard", "rooms", "clients", "reservations", "payments", "notifications", "users", "settings"],
  gerant: ["dashboard", "rooms", "clients", "payments", "notifications"],
  reception: ["dashboard", "rooms", "clients", "reservations", "payments"],
  entretien: ["dashboard", "rooms"],
};

export const PAY_MODES = ["Espèces", "Orange Money", "MTN Money", "Moov Money", "Wave", "Carte bancaire"];
