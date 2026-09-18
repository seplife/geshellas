import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const result = await pool.query(
      `SELECT * FROM utilisateurs WHERE email = $1 AND actif = TRUE`,
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Identifiants invalides." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Identifiants invalides." });

    const token = jwt.sign(
      { id: user.id, role: user.role, nom: user.nom, prenoms: user.prenoms },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
    );
    res.json({
      token,
      user: { id: user.id, nom: user.nom, prenoms: user.prenoms, role: user.role, email: user.email },
    });
  })
);

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
