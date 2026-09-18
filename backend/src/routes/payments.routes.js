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
      `SELECT p.*, s.numero AS sejour_numero, ch.numero AS chambre_numero,
              c.nom AS client_nom, c.prenoms AS client_prenoms
       FROM paiements p
       LEFT JOIN sejours s ON s.id = p.sejour_id
       LEFT JOIN chambres ch ON ch.id = s.chambre_id
       LEFT JOIN clients c ON c.id = s.client_id
       ORDER BY p.date_paiement DESC`
    );
    res.json(result.rows);
  })
);

const paymentSchema = z.object({
  sejour_id: z.number().int(),
  montant: z.number().positive(),
  mode_paiement: z.string().min(1),
  reference: z.string().optional(),
});

router.post(
  "/",
  requireRole("admin", "reception"),
  asyncHandler(async (req, res) => {
    const body = paymentSchema.parse(req.body);
    const result = await withTransaction(async (client) => {
      const sejourRes = await client.query(`SELECT * FROM sejours WHERE id = $1 FOR UPDATE`, [body.sejour_id]);
      const sejour = sejourRes.rows[0];
      if (!sejour) throw Object.assign(new Error("Séjour introuvable."), { status: 404 });

      const montantPaye = Number(sejour.montant_paye) + body.montant;
      const solde = Number(sejour.montant_total) - montantPaye;
      await client.query(`UPDATE sejours SET montant_paye = $2, solde = $3 WHERE id = $1`, [sejour.id, montantPaye, solde]);

      const payRes = await client.query(
        `INSERT INTO paiements (sejour_id, montant, mode_paiement, reference, utilisateur_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [sejour.id, body.montant, body.mode_paiement, body.reference || null, req.user.id]
      );
      return payRes.rows[0];
    });
    res.status(201).json(result);
  })
);

export default router;
