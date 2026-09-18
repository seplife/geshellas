import "dotenv/config";
import { pool } from "../db/pool.js";

const API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const MAX_RETRIES = Number(process.env.WHATSAPP_MAX_RETRIES || 3);

function isConfigured() {
  return Boolean(API_URL && ACCESS_TOKEN && PHONE_NUMBER_ID);
}

/**
 * Envoie un message texte WhatsApp via l'API Meta Cloud (WhatsApp Business Platform).
 * Ne lève jamais d'exception : retourne toujours { ok, error?, id? } pour que
 * l'appelant puisse continuer même si l'envoi échoue.
 */
async function sendRaw(to, message) {
  if (!isConfigured()) {
    return { ok: false, error: "WHATSAPP_NON_CONFIGURE — variables d'environnement manquantes." };
  }
  try {
    const response = await fetch(`${API_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^\d+]/g, ""),
        type: "text",
        text: { body: message },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error?.message || `Erreur HTTP ${response.status}` };
    }
    return { ok: true, id: data?.messages?.[0]?.id || null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Envoie un message avec relances, et journalise chaque tentative dans la
 * table `notifications` (créée en 'en_attente', mise à jour en 'envoyee' ou 'echec').
 */
export async function sendWithLogging({ type, to, message }) {
  const insert = await pool.query(
    `INSERT INTO notifications (type, destinataire, message, statut, tentatives)
     VALUES ($1, $2, $3, 'en_attente', 0) RETURNING id`,
    [type, to, message]
  );
  const notificationId = insert.rows[0].id;

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await sendRaw(to, message);
    if (result.ok) {
      await pool.query(
        `UPDATE notifications
         SET statut = 'envoyee', tentatives = $2, reference_externe = $3, date_envoi = now()
         WHERE id = $1`,
        [notificationId, attempt, result.id]
      );
      return { ok: true, notificationId };
    }
    lastError = result.error;
    await pool.query(`UPDATE notifications SET tentatives = $2 WHERE id = $1`, [notificationId, attempt]);
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, attempt * 1000)); // backoff simple
    }
  }

  await pool.query(
    `UPDATE notifications SET statut = 'echec', erreur = $2 WHERE id = $1`,
    [notificationId, lastError]
  );
  console.error(`[WhatsApp] Échec définitif de l'envoi (${type}) après ${MAX_RETRIES} tentatives:`, lastError);
  return { ok: false, notificationId, error: lastError };
}

async function managerNumber() {
  const res = await pool.query(`SELECT valeur FROM parametres WHERE cle = 'manager_whatsapp'`);
  return res.rows[0]?.valeur || process.env.MANAGER_WHATSAPP_NUMBER;
}

const fmtFCFA = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} FCFA`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

export async function sendCheckInNotification({ client, chambre, sejour }) {
  const to = await managerNumber();
  const message = `🏨 HÔTEL HELLAS – NOUVEAU CLIENT

Un nouveau client vient d'être enregistré.

👤 Client : ${client.nom} ${client.prenoms}
📞 Téléphone : ${client.telephone}
🚪 Chambre : ${chambre.numero}
🕒 Heure d'entrée : ${sejour.heure_entree}
📅 Date d'arrivée : ${fmtDate(sejour.date_entree)}
📅 Sortie prévue : ${fmtDate(sejour.date_sortie_prevue)}
💰 Montant prévu : ${fmtFCFA(sejour.montant_total)}

Statut de la chambre : 🔴 OCCUPÉE

Hellas Hôtel Manager`;
  return sendWithLogging({ type: "check-in", to, message });
}

export async function sendCheckOutNotification({ client, chambre, sejour }) {
  const to = await managerNumber();
  const message = `🏨 HÔTEL HELLAS – DÉPART CLIENT

Le client suivant vient de quitter l'hôtel :

👤 Client : ${client.nom} ${client.prenoms}
🚪 Chambre : ${chambre.numero}

🕒 Heure réelle de sortie : ${sejour.heure_sortie_reelle}
📅 Date de départ : ${fmtDate(sejour.date_sortie_reelle)}

💰 Montant total : ${fmtFCFA(sejour.montant_total)}
💵 Montant payé : ${fmtFCFA(sejour.montant_paye)}
📊 Solde : ${fmtFCFA(sejour.solde)}

La chambre est maintenant en attente de nettoyage.`;
  return sendWithLogging({ type: "check-out", to, message });
}

export async function sendStayExtensionNotification({ client, chambre, ancienneSortie, sejour, montantSupplementaire }) {
  const to = await managerNumber();
  const message = `🏨 PROLONGATION DE SÉJOUR

Le séjour du client ${client.nom} ${client.prenoms} a été prolongé.

🚪 Chambre : ${chambre.numero}
📅 Ancienne sortie : ${fmtDate(ancienneSortie)}
📅 Nouvelle sortie : ${fmtDate(sejour.date_sortie_prevue)}
💰 Montant supplémentaire : ${fmtFCFA(montantSupplementaire)}`;
  return sendWithLogging({ type: "prolongation", to, message });
}

export async function sendUpcomingCheckoutAlert({ client, chambre, sejour }) {
  const to = await managerNumber();
  const message = `⏰ ALERTE – FIN DE SÉJOUR PROCHE

Le séjour du client ${client.nom} ${client.prenoms} arrive à expiration.

🚪 Chambre : ${chambre.numero}
🕒 Sortie prévue : ${sejour.heure_sortie_prevue}`;
  return sendWithLogging({ type: "alerte-fin-sejour", to, message });
}

export async function sendDailySummary(stats) {
  const to = await managerNumber();
  const message = `🏨 HÔTEL HELLAS – RÉSUMÉ DU JOUR

👥 Clients enregistrés : ${stats.arrivees}
🚪 Départs : ${stats.departs}
🔴 Chambres occupées : ${stats.occupees}
🟢 Chambres disponibles : ${stats.libres}
💰 Recettes du jour : ${fmtFCFA(stats.recettes)}`;
  return sendWithLogging({ type: "resume-journalier", to, message });
}
