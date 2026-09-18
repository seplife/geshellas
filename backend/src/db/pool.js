import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

console.log("DATABASE_URL présente :", !!process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "❌ DATABASE_URL est absente. Vérifiez que le fichier .env se trouve à la racine du backend."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSL === "true"
      ? { rejectUnauthorized: false }
      : false,
});

pool.on("error", (err) => {
  console.error("Erreur inattendue du pool PostgreSQL:", err);
});

export { pool };

export async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Exécute une série d'opérations dans une transaction.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await fn(client);

    await client.query("COMMIT");

    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}