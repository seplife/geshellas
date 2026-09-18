import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

const ROOMS = [
  ["101", "Standard", 15000, 2, 1],
  ["102", "Standard", 15000, 2, 1],
  ["103", "Confort", 20000, 2, 1],
  ["201", "Confort", 20000, 3, 2],
  ["202", "Suite", 35000, 4, 2],
  ["203", "Standard", 15000, 2, 2],
];

async function seed() {
  try {
    console.log("Insertion des données de démonstration…");

    const passwordHash = await bcrypt.hash("Hellas2026!", 10);

    // Utilisateurs
    await pool.query(
      `INSERT INTO utilisateurs
        (nom, prenoms, email, telephone, role, password_hash)
       VALUES
        ('Admin', 'Hellas', 'admin@hellas-hotel.ci', '+2250700000001', 'admin', $1),
        ('Kouadio', 'Gérant', 'gerant@hellas-hotel.ci', '+2250700000002', 'gerant', $1),
        ('Aya', 'Réception', 'reception@hellas-hotel.ci', '+2250700000003', 'reception', $1)
       ON CONFLICT (email) DO NOTHING`,
      [passwordHash]
    );

    // Chambres
    for (const [numero, type, prix, capacite, etage] of ROOMS) {
      await pool.query(
        `INSERT INTO chambres
          (numero, type, categorie, prix_nuit, capacite, nombre_lits, etage, statut)
         VALUES
          ($1, $2, $2, $3, $4, 1, $5, 'libre')
         ON CONFLICT (numero) DO NOTHING`,
        [numero, type, prix, capacite, etage]
      );
    }

    // Paramètres
    await pool.query(
      `INSERT INTO parametres (cle, valeur)
       VALUES ('manager_whatsapp', $1)
       ON CONFLICT (cle) DO NOTHING`,
      [process.env.MANAGER_WHATSAPP_NUMBER || "+2250700000000"]
    );

    console.log("");
    console.log("======================================");
    console.log("      SEED TERMINÉ AVEC SUCCÈS");
    console.log("======================================");
    console.log("");
    console.log("Comptes de test :");
    console.log("");
    console.log("Admin      : admin@hellas-hotel.ci");
    console.log("Gérant     : gerant@hellas-hotel.ci");
    console.log("Réception  : reception@hellas-hotel.ci");
    console.log("");
    console.log("Mot de passe : Hellas2026!");
    console.log("");

  } catch (err) {
    console.error("Échec du seed :", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();