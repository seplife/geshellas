const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// GET /api/rooms — liste toutes les chambres avec le séjour en cours si occupée
router.get('/', auth, async (req, res) => {
  try {
    const [chambres] = await pool.query(`
      SELECT c.*,
             s.id as sejour_id, s.numero as sejour_numero,
             s.date_sortie_prevue, s.heure_sortie_prevue,
             s.montant_total, s.montant_paye, s.solde,
             cl.nom as client_nom, cl.prenoms as client_prenoms
      FROM chambres c
      LEFT JOIN sejours s  ON c.id = s.chambre_id AND s.statut = 'en_cours'
      LEFT JOIN clients cl ON s.client_id = cl.id
      ORDER BY c.numero ASC
    `);
    res.json(chambres);
  } catch (error) {
    console.error('GET /rooms :', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des chambres.' });
  }
});

// POST /api/rooms — créer une chambre (admin uniquement)
router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const {
      numero, type, categorie, prix_nuit,
      capacite = 2, nombre_lits = 1, etage = 1,
      equipements, description, photo_url
    } = req.body;

    if (!numero || !type || prix_nuit === undefined) {
      return res.status(400).json({ message: 'Numéro, type et prix par nuit sont requis.' });
    }

    const [result] = await pool.query(
      `INSERT INTO chambres
         (numero, type, categorie, prix_nuit, capacite, nombre_lits, etage, equipements, description, photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, type, categorie || type, prix_nuit, capacite, nombre_lits, etage,
       equipements || null, description || null, photo_url || null]
    );

    const [rows] = await pool.query('SELECT * FROM chambres WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('POST /rooms :', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: `Le numéro de chambre "${req.body.numero}" existe déjà.` });
    }
    res.status(500).json({ message: 'Erreur lors de la création de la chambre.' });
  }
});

// PUT /api/rooms/:id — modifier une chambre (admin uniquement)
router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      numero, type, categorie, prix_nuit,
      capacite, nombre_lits, etage,
      equipements, description, photo_url
    } = req.body;

    const [result] = await pool.query(
      `UPDATE chambres SET
         numero      = COALESCE(?, numero),
         type        = COALESCE(?, type),
         categorie   = COALESCE(?, categorie),
         prix_nuit   = COALESCE(?, prix_nuit),
         capacite    = COALESCE(?, capacite),
         nombre_lits = COALESCE(?, nombre_lits),
         etage       = COALESCE(?, etage),
         equipements = COALESCE(?, equipements),
         description = COALESCE(?, description),
         photo_url   = COALESCE(?, photo_url)
       WHERE id = ?`,
      [numero, type, categorie, prix_nuit, capacite, nombre_lits, etage,
       equipements, description, photo_url, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Chambre introuvable.' });
    }

    const [rows] = await pool.query('SELECT * FROM chambres WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('PUT /rooms/:id :', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: `Le numéro de chambre "${req.body.numero}" existe déjà.` });
    }
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la chambre.' });
  }
});

// DELETE /api/rooms/:id — supprimer une chambre (admin uniquement)
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM chambres WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Chambre introuvable.' });
    }
    res.json({ message: 'Chambre supprimée.' });
  } catch (error) {
    console.error('DELETE /rooms/:id :', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la chambre.' });
  }
});

// POST /api/rooms/clean/:id — valider le nettoyage (admin, entretien)
router.post('/clean/:id', auth, requireRole('admin', 'entretien'), async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      "UPDATE chambres SET statut = 'libre', panne_note = NULL WHERE id = ?", [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Chambre introuvable.' });
    }
    res.json({ message: 'Chambre remise en service.' });
  } catch (error) {
    console.error('POST /rooms/clean/:id :', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// POST /api/rooms/maintenance/:id — signaler une anomalie (admin, entretien)
router.post('/maintenance/:id', auth, requireRole('admin', 'entretien'), async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Une description est requise.' });
    }

    const [result] = await pool.query(
      "UPDATE chambres SET statut = 'maintenance', panne_note = ? WHERE id = ?",
      [description.trim(), id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Chambre introuvable.' });
    }
    res.json({ message: 'Anomalie signalée.' });
  } catch (error) {
    console.error('POST /rooms/maintenance/:id :', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
