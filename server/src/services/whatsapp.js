/**
 * Service WhatsApp — Backend Express
 * Envoie des messages via l'API Meta Cloud (WhatsApp Business).
 * Les numéros des destinataires sont lus depuis les variables d'environnement.
 */

function isConfigured() {
  return Boolean(
    process.env.WHATSAPP_API_URL &&
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}

/**
 * Envoie un message texte WhatsApp à un numéro donné.
 * Ne lève jamais d'exception : retourne toujours { ok, error?, id? }.
 */
async function sendRaw(to, message) {
  if (!isConfigured()) {
    console.warn('[WhatsApp] Variables non configurées — message non envoyé.');
    return { ok: false, error: 'WHATSAPP_NON_CONFIGURE' };
  }

  const { WHATSAPP_API_URL, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/[^\d+]/g, ''),
        type: 'text',
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
 * Envoie le même message à plusieurs destinataires.
 * @param {string[]} numbers - Tableau de numéros de téléphone (format international, ex: +2250707874970)
 * @param {string} message - Corps du message
 * @returns {Promise<Array<{to, ok, error?, id?}>>}
 */
async function sendToAll(numbers, message) {
  const results = await Promise.all(
    numbers.filter(Boolean).map(async (to) => {
      const res = await sendRaw(to, message);
      if (!res.ok) {
        console.error(`[WhatsApp] Échec envoi à ${to}: ${res.error}`);
      } else {
        console.log(`[WhatsApp] ✅ Message envoyé à ${to} (id: ${res.id})`);
      }
      return { to, ...res };
    })
  );
  return results;
}

/**
 * Retourne les numéros des destinataires configurés (admin + gérant).
 */
function getRecipients() {
  return [
    process.env.WHATSAPP_ADMIN_NUMBER,
    process.env.WHATSAPP_GERANT_NUMBER,
  ].filter(Boolean);
}

/**
 * Construit le message de check-in.
 */
function buildCheckInMessage({ client, chambre, sejour }) {
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
  const fmtFCFA = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;

  return `🏨 HÔTEL HELLAS – NOUVEAU CLIENT

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
}

/**
 * Construit le message de check-out.
 */
function buildCheckOutMessage({ client, chambre, sejour }) {
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
  const fmtFCFA = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;

  return `🏨 HÔTEL HELLAS – DÉPART CLIENT

Le client suivant vient de quitter l'hôtel :

👤 Client : ${client.nom} ${client.prenoms}
🚪 Chambre : ${chambre.numero}

🕒 Heure réelle de sortie : ${sejour.heure_sortie_reelle || '—'}
📅 Date de départ : ${fmtDate(sejour.date_sortie_reelle)}

💰 Montant total : ${fmtFCFA(sejour.montant_total)}
💵 Montant payé : ${fmtFCFA(sejour.montant_paye)}
📊 Solde : ${fmtFCFA(sejour.solde)}

La chambre est maintenant en attente de nettoyage.`;
}

module.exports = { sendRaw, sendToAll, getRecipients, buildCheckInMessage, buildCheckOutMessage };
