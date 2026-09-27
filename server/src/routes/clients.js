const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const { q } = req.query;
  try {
    let query = 'SELECT * FROM clients';
    const params = [];
    if (q) {
      query += ' WHERE nom LIKE ? OR prenoms LIKE ? OR telephone LIKE ?';
      const search = `%${q}%`;
      params.push(search, search, search);
    }
    query += ' ORDER BY created_at DESC';
    const [clients] = await pool.query(query, params);
    res.json(clients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération des clients.' });
  }
});

module.exports = router;
