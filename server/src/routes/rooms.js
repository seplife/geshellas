const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const [chambres] = await pool.query(`
      SELECT c.*, 
             s.id as sejour_id, s.numero as sejour_numero, s.date_sortie_prevue, s.heure_sortie_prevue,
             cl.nom as client_nom, cl.prenoms as client_prenoms
      FROM chambres c
      LEFT JOIN sejours s ON c.id = s.chambre_id AND s.statut = 'en_cours'
      LEFT JOIN clients cl ON s.client_id = cl.id
      ORDER BY c.numero ASC
    `);
    res.json(chambres);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération des chambres.' });
  }
});

router.post('/clean/:id', auth, requireRole('admin', 'entretien'), async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('UPDATE chambres SET statut = ?, panne_note = NULL WHERE id = ?', ['libre', id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Chambre non trouvée.' });
    }
    
    res.json({ message: 'Chambre marquée comme propre et libre.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/maintenance/:id', auth, requireRole('admin', 'entretien'), async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const [result] = await pool.query('UPDATE chambres SET statut = ?, panne_note = ? WHERE id = ?', ['maintenance', description, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Chambre non trouvée.' });
    }
    
    res.json({ message: 'Chambre mise en maintenance.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
