const jwt = require('jsonwebtoken');
const pool = require('../db');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(
      'SELECT id, nom, prenoms, role, actif FROM profiles WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Utilisateur non trouvé.' });
    }

    const user = rows[0];

    if (!user.actif) {
      return res.status(403).json({ error: 'Compte inactif. Veuillez contacter l\'administrateur.' });
    }

    req.user = {
      id: user.id,
      email: decoded.email,
      role: user.role,
      nom: user.nom,
      prenoms: user.prenoms
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
};

module.exports = auth;
