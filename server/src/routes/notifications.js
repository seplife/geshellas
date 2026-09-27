const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/', auth, requireRole('admin', 'gerant'), async (req, res) => {
  try {
    const [notifications] = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/retry/:id', auth, requireRole('admin', 'gerant'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE notifications SET statut = "en_attente" WHERE id = ?', [id]);
    res.json({ message: 'Notification remise en attente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
