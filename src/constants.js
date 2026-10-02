import {
  LayoutDashboard, BedDouble, Users, CalendarDays, Wallet, MessageSquare, ShieldCheck, Settings, Clock, BarChart3,
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
  { key: "passages", label: "Passages", icon: Clock },
  { key: "reservations", label: "Réservations", icon: CalendarDays },
  { key: "clients", label: "Clients", icon: Users },
  { key: "payments", label: "Paiements", icon: Wallet },
  { key: "reports", label: "Rapport financier", icon: BarChart3 },
  { key: "notifications", label: "Notifications", icon: MessageSquare },
  { key: "users", label: "Utilisateurs", icon: ShieldCheck },
  { key: "settings", label: "Paramètres", icon: Settings },
];

export const NAV_BY_ROLE = {
  admin: ["dashboard", "rooms", "passages", "reservations", "clients", "payments", "reports", "notifications", "users", "settings"],
  gerant: ["dashboard", "rooms", "passages", "reservations", "clients", "payments", "reports", "notifications"],
  reception: ["dashboard", "rooms", "passages", "reservations", "clients", "payments", "reports"],
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

/** Tarifs horaires pour les passages. */
export const PASSAGE_TARIFS = {
  ventilee: {
    key: "ventilee",
    label: "Chambre ventilée",
    shortLabel: "Ventilée",
    prix_heure: 2000,
  },
  climatisee: {
    key: "climatisee",
    label: "Chambre climatisée",
    shortLabel: "Climatisée",
    prix_heure: 2500,
  },
};

/** Détermine si une chambre est ventilée (2 000 FCFA/h) ou climatisée (2 500 FCFA/h). */
export function getRoomClimatisation(room) {
  if (!room) return "climatisee";
  if (room.climatisation === "ventilee" || room.climatisation === "climatisee") {
    return room.climatisation;
  }
  const text = `${room.type || ""} ${room.categorie || ""} ${room.equipements || ""} ${room.description || ""}`.toLowerCase();
  if (text.includes("ventil") && !text.includes("clim")) {
    return "ventilee";
  }
  return "climatisee";
}

/** Retourne le tarif horaire de passage (2 000 FCFA ou 2 500 FCFA). */
export function getPassageHoraire(roomOrType) {
  const clim = typeof roomOrType === "string" ? roomOrType : getRoomClimatisation(roomOrType);
  return PASSAGE_TARIFS[clim]?.prix_heure || 2500;
}

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
