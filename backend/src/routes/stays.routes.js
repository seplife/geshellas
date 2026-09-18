import { Router } from "express";
import { z } from "zod";
import { pool, withTransaction } from "../db/pool.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  sendCheckInNotification,
  sendCheckOutNotification,
  sendStayExtensionNotification,
} from "../services/whatsappService.js";

const router = Router();
router.use(requireAuth);

function nightsBetween(d1, d2) {
  const diff = Math.round((new Date(d2) - new Date(d1)) / 86400000);
  return Math.max(1, diff);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { statut } = req.query;
    const params = [];
    let where = "";
    if (statut) { params.push(statut); where = `WHERE s.statut = $1`; }
    const result = await pool.query(
      `SELECT s.*, c.nom AS client_nom, c.prenoms AS client_prenoms, c.telephone AS client_telephone,
              ch.numero AS chambre_numero
       FROM sejours s
       JOIN clients c ON c.id = s.client_id
       JOIN chambres ch ON ch.id = s.chambre_id
       ${where}
       ORDER BY s.created_at DESC`,
      params
    );
    res.json(result.rows);
  })
);

const checkInSchema = z.object({
  client: z.object({
    nom: z.string().min(1),
    prenoms: z.string().min(1),
    sexe: z.enum(["M", "F"]).optional(),
    date_naissance: z.string().optional(),
    nationalite: z.string().optional(),
    profession: z.string().optional(),
    adresse: z.string().optional(),
    telephone: z.string().min(6),
    whatsapp: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    type_piece: z.string().min(1),
    numero_piece: z.string().min(1),
  }),
  chambre_id: z.number().int(),
  date_entree: z.string(),
  heure_entree: z.string(),
  date_sortie_prevue: z.string(),
  heure_sortie_prevue: z.string(),
  nb_personnes: z.number().int().positive().default(1),
  avance: z.number().nonnegative().default(0),
  mode_paiement: z.string().optional(),
});

// Enregistrement + check-in : orchestre toute la séquence de la section 8 du cahier des charges.
router.post(
  "/check-in",
  requireRole("admin", "reception"),
  asyncHandler(async (req, res) => {
    const body = checkInSchema.parse(req.body);

    const result = await withTransaction(async (client) => {
      const roomRes = await client.query(`SELECT * FROM chambres WHERE id = $1 FOR UPDATE`, [body.chambre_id]);
      const room = roomRes.rows[0];
      if (!room) throw Object.assign(new Error("Chambre introuvable."), { status: 404 });
      if (room.statut !== "libre") {
        throw Object.assign(new Error("Cette chambre n'est pas libre."), { status: 409 });
      }

      const c = body.client;
      const clientRes = await client.query(
        `INSERT INTO clients (nom, prenoms, sexe, date_naissance, nationalite, profession, adresse, telephone, whatsapp, email, type_piece, numero_piece)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [c.nom, c.prenoms, c.sexe || null, c.date_naissance || null, c.nationalite || null, c.profession || null,
         c.adresse || null, c.telephone, c.whatsapp || c.telephone, c.email || null, c.type_piece, c.numero_piece]
      );
      const newClient = clientRes.rows[0];

      const nights = nightsBetween(body.date_entree, body.date_sortie_prevue);
      const montantTotal = nights * Number(room.prix_nuit);
      const montantPaye = body.avance || 0;
      const numero = `SEJ-${Date.now().toString(36).toUpperCase()}`;

      const sejourRes = await client.query(
        `INSERT INTO sejours (numero, client_id, chambre_id, date_entree, heure_entree, date_sortie_prevue,
           heure_sortie_prevue, nb_personnes, montant_total, montant_paye, solde, cree_par)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [numero, newClient.id, room.id, body.date_entree, body.heure_entree, body.date_sortie_prevue,
         body.heure_sortie_prevue, body.nb_personnes, montantTotal, montantPaye, montantTotal - montantPaye, req.user.id]
      );
      const sejour = sejourRes.rows[0];

      if (montantPaye > 0) {
        await client.query(
          `INSERT INTO paiements (sejour_id, montant, mode_paiement, utilisateur_id)
           VALUES ($1, $2, $3, $4)`,
          [sejour.id, montantPaye, body.mode_paiement || "Espèces", req.user.id]
        );
      }

      await client.query(`UPDATE chambres SET statut = 'occupee' WHERE id = $1`, [room.id]);
      await client.query(
        `INSERT INTO historique_statuts_chambres (chambre_id, ancien_statut, nouveau_statut, utilisateur_id)
         VALUES ($1, 'libre', 'occupee', $2)`,
        [room.id, req.user.id]
      );
      await client.query(
        `INSERT INTO journal_activite (utilisateur_id, action, details) VALUES ($1, 'check-in', $2)`,
        [req.user.id, JSON.stringify({ sejour_id: sejour.id, chambre: room.numero })]
      );

      return { client: newClient, room: { ...room, statut: "occupee" }, sejour };
    });

    // Notification WhatsApp envoyée hors transaction : un échec d'envoi ne doit
    // jamais annuler un check-in déjà validé.
    sendCheckInNotification({ client: result.client, chambre: result.room, sejour: result.sejour }).catch((e) =>
      console.error("Notification check-in échouée:", e)
    );

    res.status(201).json(result);
  })
);

const checkOutSchema = z.object({
  montant_supplementaire: z.number().nonnegative().default(0),
  mode_paiement: z.string().optional(),
});

router.post(
  "/:id/check-out",
  requireRole("admin", "reception"),
  asyncHandler(async (req, res) => {
    const body = checkOutSchema.parse(req.body);

    const result = await withTransaction(async (client) => {
      const sejourRes = await client.query(
        `SELECT s.*, ch.numero AS chambre_numero, ch.id AS chambre_id_ref
         FROM sejours s JOIN chambres ch ON ch.id = s.chambre_id
         WHERE s.id = $1 FOR UPDATE`,
        [req.params.id]
      );
      const sejour = sejourRes.rows[0];
      if (!sejour) throw Object.assign(new Error("Séjour introuvable."), { status: 404 });
      if (sejour.statut !== "en_cours") throw Object.assign(new Error("Ce séjour est déjà terminé."), { status: 409 });

      const montantPaye = Number(sejour.montant_paye) + (body.montant_supplementaire || 0);
      const solde = Number(sejour.montant_total) - montantPaye;

      const updated = await client.query(
        `UPDATE sejours SET statut = 'termine', date_sortie_reelle = CURRENT_DATE,
           heure_sortie_reelle = CURRENT_TIME, montant_paye = $2, solde = $3
         WHERE id = $1 RETURNING *`,
        [sejour.id, montantPaye, solde]
      );

      if (body.montant_supplementaire > 0) {
        await client.query(
          `INSERT INTO paiements (sejour_id, montant, mode_paiement, utilisateur_id) VALUES ($1,$2,$3,$4)`,
          [sejour.id, body.montant_supplementaire, body.mode_paiement || "Espèces", req.user.id]
        );
      }

      await client.query(`UPDATE chambres SET statut = 'nettoyage' WHERE id = $1`, [sejour.chambre_id]);
      await client.query(
        `INSERT INTO historique_statuts_chambres (chambre_id, ancien_statut, nouveau_statut, utilisateur_id)
         VALUES ($1, 'occupee', 'nettoyage', $2)`,
        [sejour.chambre_id, req.user.id]
      );

      const clientRes = await client.query(`SELECT * FROM clients WHERE id = $1`, [sejour.client_id]);
      return { sejour: updated.rows[0], chambre: { numero: sejour.chambre_numero }, client: clientRes.rows[0] };
    });

    sendCheckOutNotification(result).catch((e) => console.error("Notification check-out échouée:", e));
    res.json(result.sejour);
  })
);

const extendSchema = z.object({
  nouvelle_date_sortie: z.string(),
  nouvelle_heure_sortie: z.string(),
  paiement_supplementaire: z.number().nonnegative().default(0),
  mode_paiement: z.string().optional(),
});

router.post(
  "/:id/prolonger",
  requireRole("admin", "reception"),
  asyncHandler(async (req, res) => {
    const body = extendSchema.parse(req.body);

    const result = await withTransaction(async (client) => {
      const sejourRes = await client.query(
        `SELECT s.*, ch.numero AS chambre_numero, ch.prix_nuit
         FROM sejours s JOIN chambres ch ON ch.id = s.chambre_id
         WHERE s.id = $1 FOR UPDATE`,
        [req.params.id]
      );
      const sejour = sejourRes.rows[0];
      if (!sejour) throw Object.assign(new Error("Séjour introuvable."), { status: 404 });
      if (sejour.statut !== "en_cours") throw Object.assign(new Error("Ce séjour n'est plus actif."), { status: 409 });

      const ancienneSortie = sejour.date_sortie_prevue;
      const nights = nightsBetween(sejour.date_entree, body.nouvelle_date_sortie);
      const montantTotal = nights * Number(sejour.prix_nuit);
      const montantSupplementaire = montantTotal - Number(sejour.montant_total);
      const montantPaye = Number(sejour.montant_paye) + (body.paiement_supplementaire || 0);

      const updated = await client.query(
        `UPDATE sejours SET date_sortie_prevue = $2, heure_sortie_prevue = $3,
           montant_total = $4, montant_paye = $5, solde = $4 - $5
         WHERE id = $1 RETURNING *`,
        [sejour.id, body.nouvelle_date_sortie, body.nouvelle_heure_sortie, montantTotal, montantPaye]
      );

      if (body.paiement_supplementaire > 0) {
        await client.query(
          `INSERT INTO paiements (sejour_id, montant, mode_paiement, utilisateur_id) VALUES ($1,$2,$3,$4)`,
          [sejour.id, body.paiement_supplementaire, body.mode_paiement || "Espèces", req.user.id]
        );
      }

      const clientRes = await client.query(`SELECT * FROM clients WHERE id = $1`, [sejour.client_id]);
      return {
        sejour: updated.rows[0],
        chambre: { numero: sejour.chambre_numero },
        client: clientRes.rows[0],
        ancienneSortie,
        montantSupplementaire,
      };
    });

    sendStayExtensionNotification(result).catch((e) => console.error("Notification prolongation échouée:", e));
    res.json(result.sejour);
  })
);

export default router;
