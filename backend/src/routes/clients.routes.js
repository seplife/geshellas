import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q } = req.query;
    let result;
    if (q) {
      result = await pool.query(
        `SELECT * FROM clients
         WHERE nom ILIKE $1 OR prenoms ILIKE $1 OR telephone ILIKE $1 OR numero_piece ILIKE $1
         ORDER BY created_at DESC LIMIT 100`,
        [`%${q}%`]
      );
    } else {
      result = await pool.query(`SELECT * FROM clients ORDER BY created_at DESC LIMIT 100`);
    }
    res.json(result.rows);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const clientRes = await pool.query(`SELECT * FROM clients WHERE id = $1`, [req.params.id]);
    if (!clientRes.rows[0]) return res.status(404).json({ error: "Client introuvable." });

    const sejoursRes = await pool.query(
      `SELECT s.*, ch.numero AS chambre_numero FROM sejours s
       JOIN chambres ch ON ch.id = s.chambre_id
       WHERE s.client_id = $1 ORDER BY s.date_entree DESC`,
      [req.params.id]
    );
    res.json({ ...clientRes.rows[0], sejours: sejoursRes.rows });
  })
);

export default router;
