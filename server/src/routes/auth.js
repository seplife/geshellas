const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
// Accepte { email, password, full_name } depuis le frontend React
// ou { email, password, nom, prenoms } depuis d'autres clients
router.post('/register', async (req, res) => {
  const { email, password, full_name, nom: nomField, prenoms: prenomsField } = req.body;

  // Supporte "full_name" (frontend) ou "nom"/"prenoms" séparés
  let nom = nomField;
  let prenoms = prenomsField || '';
  if (!nom && full_name) {
    const parts = full_name.trim().split(' ');
    nom = parts[0];
    prenoms = parts.slice(1).join(' ');
  }

  if (!email || !password || !nom) {
    return res.status(400).json({ message: 'Email, mot de passe et nom sont requis.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await connection.query(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [userId, email, passwordHash]
    );
    await connection.query(
      'INSERT INTO profiles (id, nom, prenoms, role, actif) VALUES (?, ?, ?, ?, ?)',
      [userId, nom, prenoms, 'reception', true]
    );

    await connection.commit();
    res.status(201).json({ message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.' });
  } catch (error) {
    await connection.rollback();
    console.error('Register error:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la création du compte.' });
  } finally {
    connection.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis.' });
  }

  try {
    const [users] = await pool.query(
      `SELECT u.id, u.email, u.password_hash, p.nom, p.prenoms, p.role, p.actif
       FROM users u
       JOIN profiles p ON u.id = p.id
       WHERE u.email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }
    if (!user.actif) {
      return res.status(403).json({ message: 'Ce compte a été désactivé. Contactez un administrateur.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, nom: user.nom, prenoms: user.prenoms, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// GET /api/auth/me — vérifie le token stocké et retourne le profil à jour
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, p.nom, p.prenoms, p.role, p.actif
       FROM users u JOIN profiles p ON u.id = p.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    const u = rows[0];
    res.json({ user: { id: u.id, email: u.email, nom: u.nom, prenoms: u.prenoms, role: u.role } });
  } catch (error) {
    console.error('GET /me error:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
