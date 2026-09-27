const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const [reservations] = await pool.query(`
      SELECT r.*, c.numero as chambre_numero, c.categorie
      FROM reservations r
      JOIN chambres c ON r.chambre_id = c.id
      ORDER BY r.date_arrivee ASC
    `);
    res.json(reservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/', auth, requireRole('admin', 'reception'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { nom_client, telephone, chambre_id, date_arrivee, date_depart, montant, avance } = req.body;

    const [overlaps] = await connection.query(`
      SELECT id FROM reservations 
      WHERE chambre_id = ? 
      AND statut IN ('en_attente', 'confirmee')
      AND (date_arrivee < ? AND date_depart > ?)
    `, [chambre_id, date_depart, date_arrivee]);

    if (overlaps.length > 0) {
      throw new Error('La chambre est déjà réservée pour ces dates.');
    }

    const [resInsert] = await connection.query(
      `INSERT INTO reservations (nom_client, telephone, chambre_id, date_arrivee, date_depart, montant, avance, cree_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nom_client, telephone, chambre_id, date_arrivee, date_depart, montant, avance, req.user.id]
    );

    if (avance > 0) {
      await connection.query(
        'INSERT INTO paiements (reservation_id, montant, mode_paiement, utilisateur_id) VALUES (?, ?, ?, ?)',
        [resInsert.insertId, avance, 'Espèces', req.user.id]
      );
    }

    const [chambre] = await connection.query('SELECT statut FROM chambres WHERE id = ?', [chambre_id]);
    if (chambre[0].statut === 'libre') {
      await connection.query('UPDATE chambres SET statut = ? WHERE id = ?', ['reservee', chambre_id]);
    }

    await connection.commit();
    res.status(201).json({ message: 'Réservation créée.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(400).json({ error: error.message || 'Erreur lors de la création de la réservation.' });
  } finally {
    connection.release();
  }
});

router.delete('/:id', auth, requireRole('admin', 'reception'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    const [resvs] = await connection.query('SELECT chambre_id FROM reservations WHERE id = ? FOR UPDATE', [id]);
    if (resvs.length === 0) throw new Error('Réservation non trouvée.');
    const chambreId = resvs[0].chambre_id;

    await connection.query('UPDATE reservations SET statut = ? WHERE id = ?', ['annulee', id]);

    const [activeRes] = await connection.query(
      'SELECT id FROM reservations WHERE chambre_id = ? AND statut IN ("en_attente", "confirmee")',
      [chambreId]
    );

    if (activeRes.length === 0) {
      const [chambre] = await connection.query('SELECT statut FROM chambres WHERE id = ?', [chambreId]);
      if (chambre[0].statut === 'reservee') {
        await connection.query('UPDATE chambres SET statut = "libre" WHERE id = ?', [chambreId]);
      }
    }

    await connection.commit();
    res.json({ message: 'Réservation annulée.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: error.message || 'Erreur serveur.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
