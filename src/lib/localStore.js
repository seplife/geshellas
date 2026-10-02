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

  // --- Séjours & Passages ---
  listStays({ statut, type_sejour } = {}) {
    const db = loadDb();
    let list = [...db.sejours];
    if (statut) list = list.filter((s) => s.statut === statut);
    if (type_sejour) {
      list = list.filter((s) => (s.type_sejour || (String(s.numero).startsWith("PAS-") ? "passage" : "nuitee")) === type_sejour);
    }
    return list.map((s) => {
      const c = db.clients.find((x) => Number(x.id) === Number(s.client_id));
      const r = db.chambres.find((x) => Number(x.id) === Number(s.chambre_id));
      const isPassage = s.type_sejour === "passage" || String(s.numero || "").startsWith("PAS-");
      const clim = s.type_climatisation || (r?.climatisation === "ventilee" ? "ventilee" : "climatisee");
      return {
        ...s,
        type_sejour: isPassage ? "passage" : "nuitee",
        type_climatisation: isPassage ? clim : s.type_climatisation,
        tarif_horaire: isPassage ? (Number(s.tarif_horaire) || (clim === "ventilee" ? 2000 : 2500)) : null,
        client_nom: c?.nom || s.client_nom || (isPassage ? "Client" : ""),
        client_prenoms: c?.prenoms || s.client_prenoms || (isPassage ? "de passage" : ""),
        client_telephone: c?.telephone || s.client_telephone || "",
        chambre_numero: r?.numero || s.chambre_numero || "",
        prix_nuit: r?.prix_nuit || s.prix_nuit || 0,
      };
    });
  },

  listPassages({ statut } = {}) {
    return this.listStays({ statut, type_sejour: "passage" });
  },

  createPassage(payload) {
    const db = loadDb();
    let room = db.chambres.find((r) => Number(r.id) === Number(payload.chambre_id));
    if (!room && payload.room) {
      room = { ...payload.room, id: Number(payload.chambre_id) };
      db.chambres.push(room);
    }
    if (!room) throw new Error("Chambre introuvable.");

    const clim = payload.type_climatisation === "ventilee" ? "ventilee" : "climatisee";
    const tarifHoraire = clim === "ventilee" ? 2000 : 2500;
    const dureeHeures = Math.max(1, Number(payload.duree_heures) || 1);
    const montantTotal = dureeHeures * tarifHoraire;
    const montantPaye = payload.montant_paye !== undefined && payload.montant_paye !== null && payload.montant_paye !== ""
      ? Math.max(0, Number(payload.montant_paye))
      : montantTotal;

    const cData = payload.client || {};
    const nom = (cData.nom || "").trim() || "Client";
    const prenoms = (cData.prenoms || "").trim() || "de passage";
    const telephone = (cData.telephone || "").trim() || "-";
    const type_piece = cData.type_piece || "Autre";
    const numero_piece = (cData.numero_piece || "").trim() || "PASSAGE";

    let client = numero_piece !== "PASSAGE"
      ? db.clients.find((c) => c.numero_piece === numero_piece && c.type_piece === type_piece)
      : db.clients.find((c) => c.numero_piece === "PASSAGE" && c.nom === nom && c.prenoms === prenoms);

    if (!client) {
      client = {
        id: nextId(db.clients),
        nom,
        prenoms,
        sexe: cData.sexe || "M",
        telephone,
        whatsapp: telephone,
        type_piece,
        numero_piece,
        created_at: new Date().toISOString(),
      };
      db.clients.unshift(client);
    }

    const dateEntree = payload.date_entree || todayStr();
    const heureEntree = payload.heure_entree || new Date().toTimeString().slice(0, 5);
    const [y, m, d] = dateEntree.split("-").map(Number);
    const [hh, mm] = heureEntree.split(":").map(Number);
    const outDt = new Date(y, (m || 1) - 1, d || 1, (hh || 0) + dureeHeures, mm || 0);
    const pad2 = (n) => String(n).padStart(2, "0");
    const dateSortiePrevue = payload.date_sortie_prevue || `${outDt.getFullYear()}-${pad2(outDt.getMonth() + 1)}-${pad2(outDt.getDate())}`;
    const heureSortiePrevue = payload.heure_sortie_prevue || `${pad2(outDt.getHours())}:${pad2(outDt.getMinutes())}`;

    const sejourId = nextId(db.sejours);
    const sejour = {
      id: sejourId,
      numero: `PAS-${todayStr().replace(/-/g, "").slice(2)}-${String(sejourId).padStart(4, "0")}`,
      client_id: client.id,
      client_nom: client.nom,
      client_prenoms: client.prenoms,
      client_telephone: client.telephone,
      chambre_id: room.id,
      chambre_numero: room.numero,
      type_sejour: "passage",
      type_climatisation: clim,
      duree_heures: dureeHeures,
      tarif_horaire: tarifHoraire,
      date_entree: dateEntree,
      heure_entree: heureEntree,
      date_sortie_prevue: dateSortiePrevue,
      heure_sortie_prevue: heureSortiePrevue,
      nb_personnes: Math.max(1, Number(payload.nb_personnes) || 1),
      statut: "en_cours",
      montant_total: montantTotal,
      montant_paye: montantPaye,
      solde: montantTotal - montantPaye,
      local_only: true,
      created_at: new Date().toISOString(),
    };
    db.sejours.unshift(sejour);
    room.statut = "occupee";

    if (montantPaye > 0) {
      db.paiements.unshift({
        id: nextId(db.paiements),
        sejour_id: sejour.id,
        montant: montantPaye,
        mode_paiement: payload.mode_paiement || "Espèces",
        reference: `Passage ${dureeHeures}h (${clim === "ventilee" ? "Ventilée" : "Climatisée"})`,
        date_paiement: new Date().toISOString(),
        local_only: true,
      });
    }

    saveDb(db);
    return { client, room, sejour };
  },

  extendPassage(sejourId, payload = {}) {
    const db = loadDb();
    const sejour = db.sejours.find((s) => Number(s.id) === Number(sejourId));
    if (!sejour) throw new Error("Passage introuvable.");
    const room = db.chambres.find((r) => Number(r.id) === Number(sejour.chambre_id));
    const heuresSupp = Math.max(1, Number(payload.heures_supplementaires) || 1);
    const tarif = Number(sejour.tarif_horaire) || (sejour.type_climatisation === "ventilee" ? 2000 : 2500);
    const montantSupp = heuresSupp * tarif;
    const paiement = Math.max(0, Number(payload.paiement_supplementaire) || 0);

    const [y, m, d] = (sejour.date_sortie_prevue || todayStr()).split("-").map(Number);
    const [hh, mm] = String(sejour.heure_sortie_prevue || "12:00").slice(0, 5).split(":").map(Number);
    const outDt = new Date(y, (m || 1) - 1, d || 1, (hh || 0) + heuresSupp, mm || 0);
    const pad2 = (n) => String(n).padStart(2, "0");

    sejour.duree_heures = (Number(sejour.duree_heures) || 1) + heuresSupp;
    sejour.date_sortie_prevue = `${outDt.getFullYear()}-${pad2(outDt.getMonth() + 1)}-${pad2(outDt.getDate())}`;
    sejour.heure_sortie_prevue = `${pad2(outDt.getHours())}:${pad2(outDt.getMinutes())}`;
    sejour.montant_total = Number(sejour.montant_total) + montantSupp;
    sejour.montant_paye = Number(sejour.montant_paye) + paiement;
    sejour.solde = sejour.montant_total - sejour.montant_paye;

    if (paiement > 0) {
      db.paiements.unshift({
        id: nextId(db.paiements),
        sejour_id: sejour.id,
        montant: paiement,
        mode_paiement: payload.mode_paiement || "Espèces",
        reference: `Prolongation passage +${heuresSupp}h`,
        date_paiement: new Date().toISOString(),
        local_only: true,
      });
    }

    saveDb(db);
    return { sejour, chambre_numero: room?.numero || sejour.chambre_numero, montant_supplementaire: montantSupp };
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
      type_sejour: "nuitee",
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
        reference: sejour.type_sejour === "passage" ? "Règlement sortie passage" : "Règlement départ",
        date_paiement: new Date().toISOString(),
        local_only: sejour.local_only || false,
      });
    }
    if (room) {
      room.statut = room.panne_note ? "maintenance" : "nettoyage";
    }
    saveDb(db);
    return { sejour, chambre_numero: room?.numero || sejour.chambre_numero };
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
      const isPassage = sejour?.type_sejour === "passage" || String(sejour?.numero || "").startsWith("PAS-");
      return {
        ...p,
        type_sejour: isPassage ? "passage" : sejour ? "nuitee" : resa ? "reservation" : "autre",
        type_climatisation: sejour?.type_climatisation || null,
        duree_heures: sejour?.duree_heures || null,
        client_label: client
          ? `${client.nom} ${client.prenoms}`.trim()
          : sejour
            ? `${sejour.client_nom || ""} ${sejour.client_prenoms || ""}`.trim()
            : resa?.nom_client || "",
        chambre_numero: room?.numero || sejour?.chambre_numero || "",
        origine: sejour
          ? `${isPassage ? "Passage" : "Séjour"} ${sejour.numero}`
          : resa
            ? "Réservation"
            : "Paiement",
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
