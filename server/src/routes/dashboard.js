const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const [chambres] = await pool.query('SELECT statut FROM chambres');
    const total_chambres = chambres.length;
    let libres = 0, occupees = 0, reservees = 0, nettoyage = 0, maintenance = 0;

    chambres.forEach(c => {
      if (c.statut === 'libre') libres++;
      else if (c.statut === 'occupee') occupees++;
      else if (c.statut === 'reservee') reservees++;
      else if (c.statut === 'nettoyage') nettoyage++;
      else if (c.statut === 'maintenance') maintenance++;
    });

    const taux_occupation = total_chambres > 0 ? (occupees / total_chambres) * 100 : 0;

    const [clientsPresents] = await pool.query('SELECT SUM(nb_personnes) as total FROM sejours WHERE statut = "en_cours"');
    const clients_presents = clientsPresents[0].total || 0;

    const [arriveesJour] = await pool.query('SELECT COUNT(*) as count FROM sejours WHERE date_entree = CURDATE()');
    const arrivees_jour = arriveesJour[0].count;

    const [departsJour] = await pool.query('SELECT COUNT(*) as count FROM sejours WHERE date_sortie_prevue = CURDATE() AND statut = "en_cours"');
    const departs_jour = departsJour[0].count;

    const [recettesJour] = await pool.query('SELECT SUM(montant) as total FROM paiements WHERE DATE(date_paiement) = CURDATE()');
    const recettes_jour = recettesJour[0].total || 0;

    const [sejours_en_retard] = await pool.query(`
      SELECT s.id, s.numero, c.numero as chambre, cl.nom, cl.prenoms, s.date_sortie_prevue, s.heure_sortie_prevue
      FROM sejours s
      JOIN chambres c ON s.chambre_id = c.id
      JOIN clients cl ON s.client_id = cl.id
      WHERE s.statut = 'en_cours' AND (s.date_sortie_prevue < CURDATE() OR (s.date_sortie_prevue = CURDATE() AND s.heure_sortie_prevue < CURTIME()))
    `);

    const [soldes_restants] = await pool.query(`
      SELECT s.id, s.numero, c.numero as chambre, cl.nom, cl.prenoms, s.montant_total, s.montant_paye, s.solde
      FROM sejours s
      JOIN chambres c ON s.chambre_id = c.id
      JOIN clients cl ON s.client_id = cl.id
      WHERE s.statut = 'en_cours' AND s.solde > 0
    `);

    res.json({
      total_chambres,
      libres,
      occupees,
      reservees,
      nettoyage,
      maintenance,
      clients_presents,
      arrivees_jour,
      departs_jour,
      recettes_jour,
      taux_occupation,
      sejours_en_retard,
      soldes_restants
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération du tableau de bord.' });
  }
});

module.exports = router;
