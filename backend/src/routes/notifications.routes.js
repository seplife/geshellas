import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { sendWithLogging } from "../services/whatsappService.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await pool.query(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200`);
    res.json(result.rows);
  })
);

// Permet à l'administrateur de relancer manuellement un envoi en échec.
router.post(
  "/:id/renvoyer",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const existing = await pool.query(`SELECT * FROM notifications WHERE id = $1`, [req.params.id]);
    const n = existing.rows[0];
    if (!n) return res.status(404).json({ error: "Notification introuvable." });
    const result = await sendWithLogging({ type: n.type, to: n.destinataire, message: n.message });
    res.json(result);
  })
);

export default router;
