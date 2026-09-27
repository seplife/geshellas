const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.email, u.created_at, p.nom, p.prenoms, p.telephone, p.role, p.actif
      FROM users u
      JOIN profiles p ON u.id = p.id
      ORDER BY p.nom ASC
    `);
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/:id/active', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { actif } = req.body;
    await pool.query('UPDATE profiles SET actif = ? WHERE id = ?', [actif, id]);
    res.json({ message: 'Statut utilisateur mis à jour.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/:id/role', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    await pool.query('UPDATE profiles SET role = ? WHERE id = ?', [role, id]);
    res.json({ message: 'Rôle utilisateur mis à jour.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
