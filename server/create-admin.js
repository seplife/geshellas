/**
 * Crée le premier compte administrateur dans la base MySQL.
 * Usage : node create-admin.js
 *
 * Modifiez EMAIL, PASSWORD et NOM ci-dessous avant de lancer.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('./src/db');

// ── À MODIFIER ────────────────────────────────────────────
const EMAIL    = 'admin@hellas-hotel.ci';
const PASSWORD = 'Admin1234!';        // changez ce mot de passe
const NOM      = 'Administrateur';
const PRENOMS  = 'Hellas';
// ─────────────────────────────────────────────────────────

async function main() {
  const conn = await pool.getConnection();
  try {
    // Vérifie si l'email existe déjà
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [EMAIL]);
    if (existing.length > 0) {
      console.log(`⚠️  Un compte existe déjà pour ${EMAIL}`);
      const [profile] = await conn.query('SELECT role FROM profiles WHERE id = ?', [existing[0].id]);
      console.log(`   Rôle actuel : ${profile[0]?.role}`);
      if (profile[0]?.role !== 'admin') {
        await conn.query("UPDATE profiles SET role = 'admin' WHERE id = ?", [existing[0].id]);
        console.log('   → Rôle mis à jour en admin ✓');
      }
      return;
    }

    await conn.beginTransaction();

    const userId       = uuidv4();
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    await conn.query(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [userId, EMAIL, passwordHash]
    );
    await conn.query(
      "INSERT INTO profiles (id, nom, prenoms, role, actif) VALUES (?, ?, ?, 'admin', true)",
      [userId, NOM, PRENOMS]
    );

    await conn.commit();

    console.log('');
    console.log('✅ Compte admin créé avec succès !');
    console.log('─────────────────────────────────');
    console.log(`   Email    : ${EMAIL}`);
    console.log(`   Mot de passe : ${PASSWORD}`);
    console.log(`   Rôle     : admin`);
    console.log('');
    console.log('⚠️  Changez le mot de passe après la première connexion !');
    console.log('');

  } catch (err) {
    await conn.rollback();
    console.error('❌ Erreur :', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

main();
