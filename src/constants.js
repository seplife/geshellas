import {
  LayoutDashboard, BedDouble, Users, CalendarDays, Wallet, MessageSquare, ShieldCheck, Settings,
} from "lucide-react";

export const ROLE_LABELS = {
  admin: "Administrateur",
  gerant: "Gérant",
  reception: "Réceptionniste",
  entretien: "Entretien",
};

export const NAV_ITEMS = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { key: "rooms", label: "Chambres", icon: BedDouble },
  { key: "reservations", label: "Réservations", icon: CalendarDays },
  { key: "clients", label: "Clients", icon: Users },
  { key: "payments", label: "Paiements", icon: Wallet },
  { key: "notifications", label: "Notifications", icon: MessageSquare },
  { key: "users", label: "Utilisateurs", icon: ShieldCheck },
  { key: "settings", label: "Paramètres", icon: Settings },
];

export const NAV_BY_ROLE = {
  admin: ["dashboard", "rooms", "reservations", "clients", "payments", "notifications", "users", "settings"],
  gerant: ["dashboard", "rooms", "reservations", "clients", "payments", "notifications"],
  reception: ["dashboard", "rooms", "reservations", "clients", "payments"],
  entretien: ["dashboard", "rooms"],
};

/** Droits d'action (miroir des contrôles faits dans la base). */
export const CAN = {
  operate: (role) => role === "admin" || role === "reception" || role === "gerant",
  manageRooms: (role) => role === "admin" || role === "gerant" || role === "reception",
  clean: (role) => role === "admin" || role === "entretien",
  reportIssue: (role) => role === "admin" || role === "entretien" || role === "reception",
  retryNotification: (role) => role === "admin" || role === "gerant",
};

export const PAY_MODES = ["Espèces", "Orange Money", "MTN Money", "Moov Money", "Wave", "Carte bancaire"];

export const ID_TYPES = [
  { value: "CNI", label: "Carte nationale d'identité" },
  { value: "Passeport", label: "Passeport" },
  { value: "Permis", label: "Permis de conduire" },
  { value: "Carte consulaire", label: "Carte consulaire" },
  { value: "Autre", label: "Autre" },
];

export const RESERVATION_STATUS = {
  en_attente: { label: "En attente", tone: "ochre" },
  confirmee: { label: "Confirmée", tone: "ochre" },
  client_arrive: { label: "Client arrivé", tone: "green" },
  client_absent: { label: "Client absent", tone: "gray" },
  annulee: { label: "Annulée", tone: "gray" },
};
