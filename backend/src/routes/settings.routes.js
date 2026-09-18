import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const result = await pool.query(`SELECT cle, valeur FROM parametres`);
    res.json(Object.fromEntries(result.rows.map((r) => [r.cle, r.valeur])));
  })
);

router.put(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const body = z.record(z.string()).parse(req.body);
    for (const [cle, valeur] of Object.entries(body)) {
      await pool.query(
        `INSERT INTO parametres (cle, valeur) VALUES ($1, $2)
         ON CONFLICT (cle) DO UPDATE SET valeur = $2`,
        [cle, valeur]
      );
    }
    res.json({ ok: true });
  })
);

export default router;
