import cron from "node-cron";
import { pool } from "../db/pool.js";
import { sendUpcomingCheckoutAlert, sendDailySummary } from "../services/whatsappService.js";

// Évite de ré-envoyer la même alerte de fin de séjour à chaque exécution du cron.
const alertesEnvoyees = new Set();

async function checkUpcomingCheckouts() {
  const result = await pool.query(
    `SELECT s.*, c.nom AS client_nom, c.prenoms AS client_prenoms, ch.numero AS chambre_numero
     FROM sejours s
     JOIN clients c ON c.id = s.client_id
     JOIN chambres ch ON ch.id = s.chambre_id
     WHERE s.statut = 'en_cours'
       AND (s.date_sortie_prevue + s.heure_sortie_prevue::interval) BETWEEN now() AND now() + interval '30 minutes'`
  );
  for (const sejour of result.rows) {
    if (alertesEnvoyees.has(sejour.id)) continue;
    alertesEnvoyees.add(sejour.id);
    await sendUpcomingCheckoutAlert({
      client: { nom: sejour.client_nom, prenoms: sejour.client_prenoms },
      chambre: { numero: sejour.chambre_numero },
      sejour,
    }).catch((e) => console.error("Alerte fin de séjour échouée:", e));
  }
}

async function sendDailySummaryJob() {
  const today = new Date().toISOString().slice(0, 10);
  const arrivees = await pool.query(`SELECT COUNT(*)::int AS n FROM sejours WHERE date_entree = $1`, [today]);
  const departs = await pool.query(
    `SELECT COUNT(*)::int AS n FROM sejours WHERE date_sortie_reelle = $1`,
    [today]
  );
  const occupees = await pool.query(`SELECT COUNT(*)::int AS n FROM chambres WHERE statut = 'occupee'`);
  const libres = await pool.query(`SELECT COUNT(*)::int AS n FROM chambres WHERE statut = 'libre'`);
  const recettes = await pool.query(
    `SELECT COALESCE(SUM(montant),0)::numeric AS n FROM paiements WHERE date_paiement::date = $1`,
    [today]
  );
  await sendDailySummary({
    arrivees: arrivees.rows[0].n,
    departs: departs.rows[0].n,
    occupees: occupees.rows[0].n,
    libres: libres.rows[0].n,
    recettes: Number(recettes.rows[0].n),
  }).catch((e) => console.error("Résumé journalier échoué:", e));
}

export function startAlertScheduler() {
  // Vérifie les fins de séjour proches toutes les 5 minutes.
  cron.schedule("*/5 * * * *", () => {
    checkUpcomingCheckouts().catch((e) => console.error("Erreur du job d'alerte:", e));
  });
  // Résumé journalier à 21h00, heure du serveur.
  cron.schedule("0 21 * * *", () => {
    sendDailySummaryJob().catch((e) => console.error("Erreur du job de résumé journalier:", e));
  });
  console.log("Planificateur d'alertes démarré (fin de séjour: /5min, résumé: 21h00).");
}
