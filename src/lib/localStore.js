/**
 * Magasin de données local (localStorage) servant de repli transparent
 * lorsque les politiques RLS ou les fonctions RPC Supabase ne sont pas
 * encore activées pour le compte connecté (erreurs 42501 / 28000 / PGRST202).
 */

import { nightsBetween, todayStr, addDays } from "./format.js";

const DB_KEY = "hellas-local-db-v1";

const INITIAL_ROOMS = [
  { id: 1, numero: "101", type: "Standard", categorie: "Standard", prix_nuit: 15000, capacite: 2, nombre_lits: 1, etage: 1, equipements: "Clim, TV, Wi-Fi", description: "Chambre Standard au 1er étage", statut: "libre", panne_note: null },
  { id: 2, numero: "102", type: "Standard", categorie: "Standard", prix_nuit: 15000, capacite: 2, nombre_lits: 1, etage: 1, equipements: "Clim, TV, Wi-Fi", description: "Chambre Standard au 1er étage", statut: "libre", panne_note: null },
  { id: 3, numero: "103", type: "Confort",  categorie: "Confort",  prix_nuit: 20000, capacite: 2, nombre_lits: 1, etage: 1, equipements: "Clim, TV, Wi-Fi, Frigo", description: "Chambre Confort spacieuse", statut: "libre", panne_note: null },
  { id: 4, numero: "201", type: "Confort",  categorie: "Confort",  prix_nuit: 20000, capacite: 3, nombre_lits: 2, etage: 2, equipements: "Clim, TV, Wi-Fi, Frigo", description: "Chambre Confort 2 lits", statut: "libre", panne_note: null },
  { id: 5, numero: "202", type: "Suite",    categorie: "Suite",    prix_nuit: 35000, capacite: 4, nombre_lits: 2, etage: 2, equipements: "Clim, TV, Wi-Fi, Salon, Mini-bar", description: "Suite familiale", statut: "libre", panne_note: null },
  { id: 6, numero: "203", type: "Standard", categorie: "Standard", prix_nuit: 15000, capacite: 2, nombre_lits: 1, etage: 2, equipements: "Clim, TV, Wi-Fi", description: "Chambre Standard au 2e étage", statut: "libre", panne_note: null },
];

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.chambres)) return parsed;
    }
  } catch {
    /* ignore */
  }
  const initial = {
    chambres: INITIAL_ROOMS,
    clients: [],
    sejours: [],
    reservations: [],
    paiements: [],
    notifications: [],
    settings: {
      admin_whatsapp: "+2250707874970",
      manager_whatsapp: "+2250779535795",
    },
  };
  saveDb(initial);
  return initial;
}

function saveDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

export const localStore = {
  // --- Chambres ---
  listRooms() {
    const db = loadDb();
    return [...db.chambres].sort((a, b) =>
      String(a.numero).localeCompare(String(b.numero), "fr", { numeric: true })
    );
  },

  createRoom(room) {
    const db = loadDb();
    const numero = String(room.numero || "").trim();
    const type = String(room.type || "Standard").trim();
    if (!numero || !type) throw new Error("Numéro et type de chambre obligatoires.");
    if (db.chambres.some((r) => String(r.numero).toLowerCase() === numero.toLowerCase())) {
      throw new Error(`La chambre ${numero} existe déjà.`);
    }
    const newRoom = {
      id: nextId(db.chambres),
      numero,
      type,
      categorie: room.categorie || type,
      prix_nuit: Number(room.prix_nuit) || 0,
      capacite: Math.max(1, Number(room.capacite) || 2),
      nombre_lits: Math.max(1, Number(room.nombre_lits) || 1),
      etage: Number(room.etage ?? 1),
      equipements: room.equipements || "",
      description: room.description || "",
      photo_url: room.photo_url || null,
      statut: "libre",
      panne_note: null,
      created_at: new Date().toISOString(),
    };
    db.chambres.push(newRoom);
    saveDb(db);
    return newRoom;
  },

  updateRoom(id, patch) {
    const db = loadDb();
    const idx = db.chambres.findIndex((r) => Number(r.id) === Number(id));
    if (idx === -1) throw new Error("Chambre introuvable.");
    const numero = patch.numero !== undefined ? String(patch.numero).trim() : db.chambres[idx].numero;
    if (
      db.chambres.some(
        (r, i) => i !== idx && String(r.numero).toLowerCase() === numero.toLowerCase()
      )
    ) {
      throw new Error(`La chambre ${numero} existe déjà.`);
    }
    const updated = {
      ...db.chambres[idx],
      ...patch,
      numero,
      prix_nuit: patch.prix_nuit !== undefined ? Number(patch.prix_nuit) : db.chambres[idx].prix_nuit,
      capacite: patch.capacite !== undefined ? Number(patch.capacite) : db.chambres[idx].capacite,
      nombre_lits: patch.nombre_lits !== undefined ? Number(patch.nombre_lits) : db.chambres[idx].nombre_lits,
      etage: patch.etage !== undefined ? Number(patch.etage) : db.chambres[idx].etage,
    };
    db.chambres[idx] = updated;
    saveDb(db);
    return updated;
  },

  deleteRoom(id) {
    const db = loadDb();
    const room = db.chambres.find((r) => Number(r.id) === Number(id));
    if (!room) throw new Error("Chambre introuvable.");
    const hasActiveStay = db.sejours.some(
      (s) => Number(s.chambre_id) === Number(id) && s.statut === "en_cours"
    );
    if (hasActiveStay) {
      throw new Error(
        `Impossible de supprimer la chambre ${room.numero} car un séjour y est actuellement en cours.`
      );
    }
    db.chambres = db.chambres.filter((r) => Number(r.id) !== Number(id));
    db.reservations = db.reservations.filter((r) => Number(r.chambre_id) !== Number(id));
    saveDb(db);
  },

  validerNettoyage(roomId) {
    const db = loadDb();
    const room = db.chambres.find((r) => Number(r.id) === Number(roomId));
    if (!room) throw new Error("Chambre introuvable.");
    room.statut = "libre";
    room.panne_note = null;
    saveDb(db);
  },

  signalerAnomalie(roomId, description) {
    const db = loadDb();
    const room = db.chambres.find((r) => Number(r.id) === Number(roomId));
    if (!room) throw new Error("Chambre introuvable.");
    room.panne_note = String(description || "").trim();
    if (room.statut !== "occupee") {
      room.statut = "maintenance";
    }
    saveDb(db);
  },

  // --- Séjours ---
  listStays({ statut } = {}) {
    const db = loadDb();
    let list = [...db.sejours];
    if (statut) list = list.filter((s) => s.statut === statut);
    return list.map((s) => {
      const c = db.clients.find((x) => Number(x.id) === Number(s.client_id));
      const r = db.chambres.find((x) => Number(x.id) === Number(s.chambre_id));
      return {
        ...s,
        client_nom: c?.nom || s.client_nom || "",
        client_prenoms: c?.prenoms || s.client_prenoms || "",
        client_telephone: c?.telephone || s.client_telephone || "",
        chambre_numero: r?.numero || s.chambre_numero || "",
        prix_nuit: r?.prix_nuit || s.prix_nuit || 0,
      };
    });
  },

  checkIn(payload) {
    const db = loadDb();
    const room = db.chambres.find((r) => Number(r.id) === Number(payload.chambre_id));
    if (!room) throw new Error("Chambre introuvable.");

    const cData = payload.client || {};
    let client = db.clients.find(
      (c) => c.numero_piece && c.numero_piece === cData.numero_piece && c.type_piece === cData.type_piece
    );
    if (client) {
      Object.assign(client, cData);
    } else {
      client = {
        id: nextId(db.clients),
        ...cData,
        created_at: new Date().toISOString(),
      };
      db.clients.unshift(client);
    }

    const nights = nightsBetween(payload.date_entree, payload.date_sortie_prevue);
    const montantTotal = nights * Number(room.prix_nuit);
    let avanceResa = 0;
    if (payload.reservation_id) {
      const resa = db.reservations.find((r) => Number(r.id) === Number(payload.reservation_id));
      if (resa) {
        avanceResa = Number(resa.avance) || 0;
        resa.statut = "client_arrive";
        resa.client_id = client.id;
      }
    }
    const avance = Number(payload.avance) || 0;
    const montantPaye = avance + avanceResa;
    const sejour = {
      id: nextId(db.sejours),
      numero: `SEJ-${todayStr().replace(/-/g, "").slice(2)}-${String(nextId(db.sejours)).padStart(4, "0")}`,
      client_id: client.id,
      chambre_id: room.id,
      reservation_id: payload.reservation_id || null,
      date_entree: payload.date_entree,
      heure_entree: payload.heure_entree,
      date_sortie_prevue: payload.date_sortie_prevue,
      heure_sortie_prevue: payload.heure_sortie_prevue,
      nb_personnes: Number(payload.nb_personnes) || 1,
      statut: "en_cours",
      montant_total: montantTotal,
      montant_paye: montantPaye,
      solde: montantTotal - montantPaye,
      created_at: new Date().toISOString(),
    };
    db.sejours.unshift(sejour);
    room.statut = "occupee";

    if (avance > 0) {
      db.paiements.unshift({
        id: nextId(db.paiements),
        sejour_id: sejour.id,
        montant: avance,
        mode_paiement: payload.mode_paiement || "Espèces",
        reference: "Avance check-in",
        date_paiement: new Date().toISOString(),
      });
    }

    saveDb(db);
    return { client, room, sejour };
  },

  checkOut(sejourId, payload = {}) {
    const db = loadDb();
    const sejour = db.sejours.find((s) => Number(s.id) === Number(sejourId));
    if (!sejour) throw new Error("Séjour introuvable.");
    const room = db.chambres.find((r) => Number(r.id) === Number(sejour.chambre_id));
    const supp = Number(payload.montant_supplementaire) || 0;
    sejour.montant_paye = Number(sejour.montant_paye) + supp;
    sejour.solde = Number(sejour.montant_total) - sejour.montant_paye;
    sejour.statut = "termine";
    sejour.date_sortie_reelle = todayStr();
    sejour.heure_sortie_reelle = new Date().toTimeString().slice(0, 5);

    if (supp > 0) {
      db.paiements.unshift({
        id: nextId(db.paiements),
        sejour_id: sejour.id,
        montant: supp,
        mode_paiement: payload.mode_paiement || "Espèces",
        reference: "Règlement départ",
        date_paiement: new Date().toISOString(),
      });
    }
    if (room) {
      room.statut = room.panne_note ? "maintenance" : "nettoyage";
    }
    saveDb(db);
    return { sejour, chambre_numero: room?.numero };
  },

  extendStay(sejourId, payload) {
    const db = loadDb();
    const sejour = db.sejours.find((s) => Number(s.id) === Number(sejourId));
    if (!sejour) throw new Error("Séjour introuvable.");
    const room = db.chambres.find((r) => Number(r.id) === Number(sejour.chambre_id));
    const prix = Number(room?.prix_nuit) || 15000;
    const nights = nightsBetween(sejour.date_entree, payload.nouvelle_date_sortie);
    const newTotal = nights * prix;
    const paiement = Number(payload.paiement_supplementaire) || 0;
    sejour.date_sortie_prevue = payload.nouvelle_date_sortie;
    sejour.heure_sortie_prevue = payload.nouvelle_heure_sortie || sejour.heure_sortie_prevue;
    sejour.montant_total = newTotal;
    sejour.montant_paye = Number(sejour.montant_paye) + paiement;
    sejour.solde = newTotal - sejour.montant_paye;

    if (paiement > 0) {
      db.paiements.unshift({
        id: nextId(db.paiements),
        sejour_id: sejour.id,
        montant: paiement,
        mode_paiement: payload.mode_paiement || "Espèces",
        reference: "Prolongation",
        date_paiement: new Date().toISOString(),
      });
    }
    saveDb(db);
    return { sejour, chambre_numero: room?.numero };
  },

  // --- Réservations ---
  listReservations() {
    const db = loadDb();
    return db.reservations.map((r) => {
      const room = db.chambres.find((c) => Number(c.id) === Number(r.chambre_id));
      return {
        ...r,
        chambre_numero: room?.numero || "",
        chambre_type: room?.type || "",
        prix_nuit: room?.prix_nuit || 0,
      };
    });
  },

  createReservation(payload) {
    const db = loadDb();
    const room = db.chambres.find((c) => Number(c.id) === Number(payload.chambre_id));
    if (!room) throw new Error("Chambre introuvable.");
    const nights = nightsBetween(payload.date_arrivee, payload.date_depart);
    const montant = Number(payload.montant) > 0 ? Number(payload.montant) : nights * Number(room.prix_nuit);
    const avance = Number(payload.avance) || 0;
    const resa = {
      id: nextId(db.reservations),
      nom_client: payload.nom_client,
      telephone: payload.telephone || "",
      chambre_id: room.id,
      date_arrivee: payload.date_arrivee,
      date_depart: payload.date_depart,
      montant,
      avance,
      statut: "confirmee",
      created_at: new Date().toISOString(),
    };
    db.reservations.push(resa);
    if (room.statut === "libre" && payload.date_arrivee <= todayStr()) {
      room.statut = "reservee";
    }
    if (avance > 0) {
      db.paiements.unshift({
        id: nextId(db.paiements),
        reservation_id: resa.id,
        montant: avance,
        mode_paiement: payload.mode_paiement || "Espèces",
        reference: "Avance réservation",
        date_paiement: new Date().toISOString(),
      });
    }
    saveDb(db);
    return resa;
  },

  cancelReservation(id) {
    const db = loadDb();
    const resa = db.reservations.find((r) => Number(r.id) === Number(id));
    if (!resa) return;
    resa.statut = "annulee";
    const room = db.chambres.find((c) => Number(c.id) === Number(resa.chambre_id));
    if (room && room.statut === "reservee") room.statut = "libre";
    saveDb(db);
  },

  markReservationAbsent(id) {
    const db = loadDb();
    const resa = db.reservations.find((r) => Number(r.id) === Number(id));
    if (!resa) return;
    resa.statut = "client_absent";
    const room = db.chambres.find((c) => Number(c.id) === Number(resa.chambre_id));
    if (room && room.statut === "reservee") room.statut = "libre";
    saveDb(db);
  },

  // --- Clients ---
  listClients(q = "") {
    const db = loadDb();
    const term = q.trim().toLowerCase();
    if (!term) return db.clients;
    return db.clients.filter((c) =>
      [c.nom, c.prenoms, c.telephone, c.numero_piece].some(
        (v) => v && String(v).toLowerCase().includes(term)
      )
    );
  },

  getClient(id) {
    const db = loadDb();
    const client = db.clients.find((c) => Number(c.id) === Number(id));
    if (!client) throw new Error("Client introuvable.");
    const sejours = db.sejours
      .filter((s) => Number(s.client_id) === Number(id))
      .map((s) => {
        const room = db.chambres.find((r) => Number(r.id) === Number(s.chambre_id));
        return { ...s, chambre_numero: room?.numero || "" };
      });
    return { ...client, sejours };
  },

  // --- Paiements ---
  listPayments({ since } = {}) {
    const db = loadDb();
    let list = [...db.paiements];
    if (since) list = list.filter((p) => p.date_paiement >= since);
    return list.map((p) => {
      const sejour = db.sejours.find((s) => Number(s.id) === Number(p.sejour_id));
      const resa = db.reservations.find((r) => Number(r.id) === Number(p.reservation_id));
      const client = sejour ? db.clients.find((c) => Number(c.id) === Number(sejour.client_id)) : null;
      const room = db.chambres.find(
        (r) => Number(r.id) === Number(sejour?.chambre_id || resa?.chambre_id)
      );
      return {
        ...p,
        client_label: client ? `${client.nom} ${client.prenoms}`.trim() : resa?.nom_client || "",
        chambre_numero: room?.numero || "",
        origine: sejour ? `Séjour ${sejour.numero}` : resa ? "Réservation" : "Paiement",
      };
    });
  },

  recordPayment(payload) {
    const db = loadDb();
    const sejour = db.sejours.find((s) => Number(s.id) === Number(payload.sejour_id));
    if (!sejour) throw new Error("Séjour introuvable.");
    const montant = Number(payload.montant) || 0;
    sejour.montant_paye = Number(sejour.montant_paye) + montant;
    sejour.solde = Number(sejour.montant_total) - sejour.montant_paye;
    const p = {
      id: nextId(db.paiements),
      sejour_id: sejour.id,
      montant,
      mode_paiement: payload.mode_paiement || "Espèces",
      reference: payload.reference || null,
      date_paiement: new Date().toISOString(),
    };
    db.paiements.unshift(p);
    saveDb(db);
    return p;
  },

  // --- Tableau de bord ---
  getDashboard() {
    const db = loadDb();
    const today = todayStr();
    const chambres = db.chambres;
    const total = chambres.length;
    const countBy = (st) => chambres.filter((c) => c.statut === st).length;
    const occupees = countBy("occupee");
    const activeStays = this.listStays({ statut: "en_cours" });

    const recettesJour = db.paiements
      .filter((p) => (p.date_paiement || "").slice(0, 10) === today)
      .reduce((acc, p) => acc + Number(p.montant || 0), 0);

    const recettes7j = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const m = db.paiements
        .filter((p) => (p.date_paiement || "").slice(0, 10) === d)
        .reduce((acc, p) => acc + Number(p.montant || 0), 0);
      recettes7j.push({ jour: d, montant: m });
    }

    return {
      total_chambres: total,
      libres: countBy("libre"),
      occupees,
      reservees: countBy("reservee"),
      nettoyage: countBy("nettoyage"),
      maintenance: countBy("maintenance"),
      taux_occupation: total > 0 ? Math.round((occupees / total) * 100) : 0,
      clients_presents: activeStays.reduce((a, s) => a + (Number(s.nb_personnes) || 1), 0),
      sejours_en_cours: activeStays.length,
      arrivees_jour: db.sejours.filter((s) => s.date_entree === today).length,
      departs_jour: activeStays.filter((s) => s.date_sortie_prevue === today).length,
      sejours_en_retard: activeStays.filter((s) => s.date_sortie_prevue < today),
      departs_prevus: activeStays.filter((s) => s.date_sortie_prevue === today),
      arrivees_prevues: this.listReservations().filter(
        (r) => ["en_attente", "confirmee"].includes(r.statut) && r.date_arrivee === today
      ),
      chambres_anomalie: chambres.filter((c) => c.panne_note),
      recettes_jour: recettesJour,
      recettes_7j: recettes7j,
      soldes_restants: activeStays.filter((s) => Number(s.solde) > 0),
    };
  },

  getSettings() {
    return loadDb().settings || {};
  },

  updateSettings(settings) {
    const db = loadDb();
    db.settings = { ...db.settings, ...settings };
    saveDb(db);
  },
};
