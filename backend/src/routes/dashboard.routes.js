import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const roomsByStatus = await pool.query(
      `SELECT statut, COUNT(*)::int AS total FROM chambres GROUP BY statut`
    );
    const totalRooms = await pool.query(`SELECT COUNT(*)::int AS total FROM chambres`);
    const clientsPresents = await pool.query(`SELECT COUNT(*)::int AS total FROM sejours WHERE statut = 'en_cours'`);
    const arriveesJour = await pool.query(
      `SELECT COUNT(*)::int AS total FROM sejours WHERE date_entree = CURRENT_DATE`
    );
    const departsJour = await pool.query(
      `SELECT COUNT(*)::int AS total FROM sejours WHERE statut = 'en_cours' AND date_sortie_prevue = CURRENT_DATE`
    );
    const recettesJour = await pool.query(
      `SELECT COALESCE(SUM(montant), 0)::numeric AS total FROM paiements WHERE date_paiement::date = CURRENT_DATE`
    );
    const overdue = await pool.query(
      `SELECT s.*, c.nom AS client_nom, c.prenoms AS client_prenoms, ch.numero AS chambre_numero
       FROM sejours s
       JOIN clients c ON c.id = s.client_id
       JOIN chambres ch ON ch.id = s.chambre_id
       WHERE s.statut = 'en_cours'
         AND (s.date_sortie_prevue + s.heure_sortie_prevue::interval) < now()`
    );
    const soldesRestants = await pool.query(
      `SELECT s.*, c.nom AS client_nom, c.prenoms AS client_prenoms, ch.numero AS chambre_numero
       FROM sejours s
       JOIN clients c ON c.id = s.client_id
       JOIN chambres ch ON ch.id = s.chambre_id
       WHERE s.statut = 'en_cours' AND s.solde > 0`
    );

    const statusMap = Object.fromEntries(roomsByStatus.rows.map((r) => [r.statut, r.total]));
    const total = totalRooms.rows[0].total;
    const occupees = statusMap.occupee || 0;

    res.json({
      total_chambres: total,
      libres: statusMap.libre || 0,
      occupees,
      reservees: statusMap.reservee || 0,
      nettoyage: statusMap.nettoyage || 0,
      maintenance: statusMap.maintenance || 0,
      clients_presents: clientsPresents.rows[0].total,
      arrivees_jour: arriveesJour.rows[0].total,
      departs_jour: departsJour.rows[0].total,
      recettes_jour: Number(recettesJour.rows[0].total),
      taux_occupation: total ? Math.round((occupees / total) * 100) : 0,
      sejours_en_retard: overdue.rows,
      soldes_restants: soldesRestants.rows,
    });
  })
);

export default router;
