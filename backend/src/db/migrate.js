import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  console.log("Application du schéma sur la base de données…");
  await pool.query(sql);
  console.log("Schéma appliqué avec succès.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Échec de la migration:", err);
  process.exit(1);
});
