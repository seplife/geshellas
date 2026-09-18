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
    const { statut, etage } = req.query;
    const conditions = [];
    const params = [];
    if (statut) { params.push(statut); conditions.push(`statut = $${params.length}`); }
    if (etage) { params.push(etage); conditions.push(`etage = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(`SELECT * FROM chambres ${where} ORDER BY numero`, params);
    res.json(result.rows);
  })
);

const roomSchema = z.object({
  numero: z.string().min(1),
  type: z.string().min(1),
  categorie: z.string().optional(),
  prix_nuit: z.number().positive(),
  capacite: z.number().int().positive().default(2),
  nombre_lits: z.number().int().positive().default(1),
  etage: z.number().int().default(1),
  equipements: z.string().optional(),
  description: z.string().optional(),
  photo_url: z.string().url().optional(),
});

router.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const body = roomSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO chambres (numero, type, categorie, prix_nuit, capacite, nombre_lits, etage, equipements, description, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [body.numero, body.type, body.categorie || body.type, body.prix_nuit, body.capacite, body.nombre_lits, body.etage, body.equipements, body.description, body.photo_url]
    );
    res.status(201).json(result.rows[0]);
  })
);

router.put(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const body = roomSchema.partial().parse(req.body);
    const fields = Object.keys(body);
    if (fields.length === 0) return res.status(400).json({ error: "Aucune donnée à mettre à jour." });
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    const values = fields.map((f) => body[f]);
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE chambres SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Chambre introuvable." });
    res.json(result.rows[0]);
  })
);

async function changeRoomStatus(client, roomId, nouveauStatut, userId) {
  const current = await client.query(`SELECT statut FROM chambres WHERE id = $1 FOR UPDATE`, [roomId]);
  if (!current.rows[0]) throw Object.assign(new Error("Chambre introuvable."), { status: 404 });
  const ancienStatut = current.rows[0].statut;
  await client.query(`UPDATE chambres SET statut = $2 WHERE id = $1`, [roomId, nouveauStatut]);
  await client.query(
    `INSERT INTO historique_statuts_chambres (chambre_id, ancien_statut, nouveau_statut, utilisateur_id)
     VALUES ($1, $2, $3, $4)`,
    [roomId, ancienStatut, nouveauStatut, userId]
  );
  return ancienStatut;
}

// Le personnel d'entretien valide le nettoyage : nettoyage -> libre
router.post(
  "/:id/valider-nettoyage",
  requireRole("admin", "entretien"),
  asyncHandler(async (req, res) => {
    const room = await pool.query(`SELECT statut FROM chambres WHERE id = $1`, [req.params.id]);
    if (!room.rows[0]) return res.status(404).json({ error: "Chambre introuvable." });
    if (!["nettoyage", "maintenance"].includes(room.rows[0].statut)) {
      return res.status(409).json({ error: "Cette chambre n'est pas en nettoyage ni en maintenance." });
    }
    await withTransaction((client) => changeRoomStatus(client, req.params.id, "libre", req.user.id));
    res.json({ ok: true });
  })
);

// Signalement d'une anomalie -> maintenance
router.post(
  "/:id/signaler-anomalie",
  requireRole("admin", "entretien"),
  asyncHandler(async (req, res) => {
    const { description } = z.object({ description: z.string().min(1) }).parse(req.body);
    await withTransaction(async (client) => {
      await changeRoomStatus(client, req.params.id, "maintenance", req.user.id);
      await client.query(`UPDATE chambres SET panne_note = $2 WHERE id = $1`, [req.params.id, description]);
    });
    res.json({ ok: true });
  })
);

export default router;
