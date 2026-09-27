const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const [paiements] = await pool.query(`
      SELECT p.*, s.numero as sejour_numero, cl.nom as client_nom, cl.prenoms as client_prenoms, u.nom as user_nom, u.prenoms as user_prenoms
      FROM paiements p
      LEFT JOIN sejours s ON p.sejour_id = s.id
      LEFT JOIN clients cl ON s.client_id = cl.id
      LEFT JOIN profiles u ON p.utilisateur_id = u.id
      ORDER BY p.date_paiement DESC
    `);
    res.json(paiements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/', auth, requireRole('admin', 'reception'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { sejour_id, montant, mode_paiement, reference } = req.body;

    const [sejours] = await connection.query('SELECT solde FROM sejours WHERE id = ? FOR UPDATE', [sejour_id]);
    if (sejours.length === 0) throw new Error('Séjour non trouvé');

    await connection.query(
      'INSERT INTO paiements (sejour_id, montant, mode_paiement, reference, utilisateur_id) VALUES (?, ?, ?, ?, ?)',
      [sejour_id, montant, mode_paiement, reference || null, req.user.id]
    );

    await connection.query(
      'UPDATE sejours SET montant_paye = montant_paye + ?, solde = solde - ? WHERE id = ?',
      [montant, montant, sejour_id]
    );

    await connection.commit();
    res.status(201).json({ message: 'Paiement enregistré.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(400).json({ error: error.message || 'Erreur lors de l\'enregistrement du paiement.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
