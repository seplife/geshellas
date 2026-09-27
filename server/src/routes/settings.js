const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const [params] = await pool.query('SELECT * FROM parametres');
    const settings = {};
    params.forEach(p => {
      settings[p.cle] = p.valeur;
    });
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/', auth, requireRole('admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const settings = req.body;
    
    for (const [cle, valeur] of Object.entries(settings)) {
      await connection.query(
        'INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON DUPLICATE KEY UPDATE valeur = ?',
        [cle, valeur, valeur]
      );
    }
    
    await connection.commit();
    res.json({ message: 'Paramètres mis à jour.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
