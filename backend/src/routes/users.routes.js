import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT id, nom, prenoms, email, telephone, role, actif, created_at FROM utilisateurs ORDER BY created_at DESC`
    );
    res.json(result.rows);
  })
);

const userSchema = z.object({
  nom: z.string().min(1),
  prenoms: z.string().min(1),
  email: z.string().email(),
  telephone: z.string().optional(),
  role: z.enum(["admin", "gerant", "reception", "entretien"]),
  password: z.string().min(6),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = userSchema.parse(req.body);
    const hash = await bcrypt.hash(body.password, 10);
    const result = await pool.query(
      `INSERT INTO utilisateurs (nom, prenoms, email, telephone, role, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nom, prenoms, email, telephone, role, actif`,
      [body.nom, body.prenoms, body.email, body.telephone || null, body.role, hash]
    );
    res.status(201).json(result.rows[0]);
  })
);

router.put(
  "/:id/desactiver",
  asyncHandler(async (req, res) => {
    await pool.query(`UPDATE utilisateurs SET actif = FALSE WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  })
);

export default router;
