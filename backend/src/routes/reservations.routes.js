import { Router } from "express";
import { z } from "zod";
import { pool, withTransaction } from "../db/pool.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT r.*, ch.numero AS chambre_numero FROM reservations r
       JOIN chambres ch ON ch.id = r.chambre_id
       ORDER BY r.date_arrivee`
    );
    res.json(result.rows);
  })
);

const reservationSchema = z.object({
  nom_client: z.string().min(1),
  telephone: z.string().optional(),
  chambre_id: z.number().int(),
  date_arrivee: z.string(),
  date_depart: z.string(),
  montant: z.number().nonnegative().default(0),
  avance: z.number().nonnegative().default(0),
});

router.post(
  "/",
  requireRole("admin", "reception"),
  asyncHandler(async (req, res) => {
    const body = reservationSchema.parse(req.body);

    const result = await withTransaction(async (client) => {
      // Empêche automatiquement le chevauchement de réservations (section 25).
      const overlap = await client.query(
        `SELECT id FROM reservations
         WHERE chambre_id = $1 AND statut IN ('en_attente', 'confirmee')
           AND date_arrivee < $3 AND date_depart > $2`,
        [body.chambre_id, body.date_arrivee, body.date_depart]
      );
      if (overlap.rows.length > 0) {
        throw Object.assign(new Error("Cette chambre est déjà réservée pour cette période."), { status: 409 });
      }
      const room = await client.query(`SELECT statut FROM chambres WHERE id = $1 FOR UPDATE`, [body.chambre_id]);
      if (!room.rows[0]) throw Object.assign(new Error("Chambre introuvable."), { status: 404 });

      const resaRes = await client.query(
        `INSERT INTO reservations (nom_client, telephone, chambre_id, date_arrivee, date_depart, montant, avance, statut, cree_par)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmee',$8) RETURNING *`,
        [body.nom_client, body.telephone || null, body.chambre_id, body.date_arrivee, body.date_depart, body.montant, body.avance, req.user.id]
      );
      if (room.rows[0].statut === "libre") {
        await client.query(`UPDATE chambres SET statut = 'reservee' WHERE id = $1`, [body.chambre_id]);
      }
      return resaRes.rows[0];
    });

    res.status(201).json(result);
  })
);

router.post(
  "/:id/annuler",
  requireRole("admin", "reception"),
  asyncHandler(async (req, res) => {
    await withTransaction(async (client) => {
      const resaRes = await client.query(`SELECT * FROM reservations WHERE id = $1 FOR UPDATE`, [req.params.id]);
      const resa = resaRes.rows[0];
      if (!resa) throw Object.assign(new Error("Réservation introuvable."), { status: 404 });
      await client.query(`UPDATE reservations SET statut = 'annulee' WHERE id = $1`, [req.params.id]);

      const otherActive = await client.query(
        `SELECT id FROM reservations WHERE chambre_id = $1 AND statut IN ('en_attente','confirmee') AND id != $2`,
        [resa.chambre_id, req.params.id]
      );
      if (otherActive.rows.length === 0) {
        await client.query(`UPDATE chambres SET statut = 'libre' WHERE id = $1 AND statut = 'reservee'`, [resa.chambre_id]);
      }
    });
    res.json({ ok: true });
  })
);

export default router;
