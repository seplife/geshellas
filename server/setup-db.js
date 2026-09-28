/**
 * Initialisation complète de la base de données.
 * 
 * Ce script :
 *  1. Crée la base "geshellas" si elle n'existe pas
 *  2. Crée toutes les tables (users, profiles, chambres, ...)
 *  3. Crée le compte administrateur par défaut
 * 
 * Usage : node setup-db.js
 */

require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ── Compte admin à créer ──────────────────────────────────
const ADMIN_EMAIL    = 'admin@hellas-hotel.ci';
const ADMIN_PASSWORD = 'Admin1234!';
const ADMIN_NOM      = 'Administrateur';
const ADMIN_PRENOMS  = 'Hellas';
// ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔧 Initialisation de la base de données Hellas Hôtel Manager\n');

  // Connexion SANS spécifier de base (pour pouvoir la créer)
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    // 1. Créer la base
    const dbName = process.env.DB_NAME || 'geshellas';
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✅ Base "${dbName}" prête`);
    await conn.query(`USE \`${dbName}\``);

    // 2. Créer les tables
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           VARCHAR(36)  NOT NULL PRIMARY KEY,
        email        VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT        NOT NULL,
        created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id         VARCHAR(36)  NOT NULL PRIMARY KEY,
        nom        VARCHAR(255) NOT NULL DEFAULT '',
        prenoms    VARCHAR(255) NOT NULL DEFAULT '',
        telephone  VARCHAR(50),
        role       ENUM('admin','gerant','reception','entretien') NOT NULL DEFAULT 'reception',
        actif      TINYINT(1)   NOT NULL DEFAULT 1,
        created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS chambres (
        id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
        numero      VARCHAR(50)  NOT NULL UNIQUE,
        type        VARCHAR(100) NOT NULL,
        categorie   VARCHAR(100),
        prix_nuit   DECIMAL(12,2) NOT NULL DEFAULT 0,
        capacite    INT          NOT NULL DEFAULT 2,
        nombre_lits INT          NOT NULL DEFAULT 1,
        etage       INT          NOT NULL DEFAULT 1,
        equipements TEXT,
        description TEXT,
        photo_url   TEXT,
        statut      ENUM('libre','occupee','reservee','nettoyage','maintenance') NOT NULL DEFAULT 'libre',
        panne_note  TEXT,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
        nom             VARCHAR(255) NOT NULL,
        prenoms         VARCHAR(255) NOT NULL DEFAULT '',
        sexe            ENUM('M','F'),
        date_naissance  DATE,
        nationalite     VARCHAR(100),
        profession      VARCHAR(100),
        adresse         TEXT,
        telephone       VARCHAR(50)  NOT NULL,
        whatsapp        VARCHAR(50),
        email           VARCHAR(255),
        type_piece      VARCHAR(100) NOT NULL DEFAULT '',
        numero_piece    VARCHAR(100) NOT NULL DEFAULT '',
        piece_photo_url TEXT,
        created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sejours (
        id                  INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
        numero              VARCHAR(100) NOT NULL UNIQUE,
        client_id           INT          NOT NULL,
        chambre_id          INT          NOT NULL,
        date_entree         DATE         NOT NULL,
        heure_entree        TIME         NOT NULL,
        date_sortie_prevue  DATE         NOT NULL,
        heure_sortie_prevue TIME         NOT NULL,
        date_sortie_reelle  DATE,
        heure_sortie_reelle TIME,
        nb_personnes        INT          NOT NULL DEFAULT 1,
        statut              ENUM('en_cours','termine','annule') NOT NULL DEFAULT 'en_cours',
        montant_total       DECIMAL(12,2) NOT NULL DEFAULT 0,
        montant_paye        DECIMAL(12,2) NOT NULL DEFAULT 0,
        solde               DECIMAL(12,2) NOT NULL DEFAULT 0,
        cree_par            VARCHAR(36),
        created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id)  REFERENCES clients(id),
        FOREIGN KEY (chambre_id) REFERENCES chambres(id),
        FOREIGN KEY (cree_par)   REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
        nom_client   TEXT         NOT NULL,
        telephone    VARCHAR(50),
        client_id    INT,
        chambre_id   INT          NOT NULL,
        date_arrivee DATE         NOT NULL,
        date_depart  DATE         NOT NULL,
        statut       ENUM('en_attente','confirmee','annulee','client_arrive','client_absent') NOT NULL DEFAULT 'confirmee',
        montant      DECIMAL(12,2) NOT NULL DEFAULT 0,
        avance       DECIMAL(12,2) NOT NULL DEFAULT 0,
        cree_par     VARCHAR(36),
        created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chambre_id) REFERENCES chambres(id),
        FOREIGN KEY (cree_par)   REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS paiements (
        id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
        sejour_id       INT,
        reservation_id  INT,
        montant         DECIMAL(12,2) NOT NULL,
        mode_paiement   VARCHAR(100) NOT NULL,
        reference       VARCHAR(255),
        date_paiement   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        utilisateur_id  VARCHAR(36),
        FOREIGN KEY (sejour_id)      REFERENCES sejours(id)      ON DELETE SET NULL,
        FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
        FOREIGN KEY (utilisateur_id) REFERENCES users(id)        ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id                 INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
        type               VARCHAR(100) NOT NULL,
        destinataire       VARCHAR(255) NOT NULL,
        message            TEXT         NOT NULL,
        statut             ENUM('en_attente','envoyee','echec') NOT NULL DEFAULT 'en_attente',
        tentatives         INT          NOT NULL DEFAULT 0,
        erreur             TEXT,
        reference_externe  VARCHAR(255),
        sejour_id          INT,
        date_envoi         TIMESTAMP    NULL,
        created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sejour_id) REFERENCES sejours(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS parametres (
        cle    VARCHAR(255) NOT NULL PRIMARY KEY,
        valeur TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Valeur par défaut
    await conn.query(`
      INSERT IGNORE INTO parametres (cle, valeur) VALUES ('manager_whatsapp', '+2250779535795');
    `);

    console.log('✅ Tables créées');

    // 3. Compte admin
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
    if (existing.length > 0) {
      // S'assurer qu'il est admin
      await conn.query("UPDATE profiles SET role = 'admin', actif = 1 WHERE id = ?", [existing[0].id]);
      console.log(`✅ Compte admin déjà existant → rôle confirmé en "admin"`);
    } else {
      const userId       = uuidv4();
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await conn.query('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
        [userId, ADMIN_EMAIL, passwordHash]);
      await conn.query("INSERT INTO profiles (id, nom, prenoms, role, actif) VALUES (?, ?, ?, 'admin', 1)",
        [userId, ADMIN_NOM, ADMIN_PRENOMS]);
      console.log('✅ Compte admin créé');
    }

    console.log('\n─────────────────────────────────────');
    console.log('🎉 Base de données initialisée !');
    console.log('─────────────────────────────────────');
    console.log(`  URL API   : http://localhost:${process.env.PORT || 3001}/api`);
    console.log(`  Admin     : ${ADMIN_EMAIL}`);
    console.log(`  Mot passe : ${ADMIN_PASSWORD}`);
    console.log('─────────────────────────────────────');
    console.log('  ⚠️  Changez le mot de passe après connexion !');
    console.log('');
    console.log('  Démarrez le serveur avec : npm run dev');
    console.log('');

  } finally {
    await conn.end();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\n❌ Erreur fatale :', err.message);
  process.exit(1);
});
