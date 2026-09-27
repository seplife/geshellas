export function fmtFCFA(n: number | string | null | undefined) {
  return `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} FCFA`;
}

export function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function isConfigured() {
  return Boolean(
    Deno.env.get("WHATSAPP_API_URL") &&
      Deno.env.get("WHATSAPP_ACCESS_TOKEN") &&
      Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")
  );
}

/**
 * Envoie un message texte WhatsApp via l'API Meta Cloud. Ne lève jamais
 * d'exception : retourne toujours { ok, error?, id? }.
 */
export async function sendRaw(to: string, message: string) {
  if (!isConfigured()) {
    return { ok: false, error: "WHATSAPP_NON_CONFIGURE — secrets manquants sur la fonction." };
  }
  const apiUrl = Deno.env.get("WHATSAPP_API_URL");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  try {
    const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function buildCheckInMessage({ client, chambre, sejour }: any) {
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

export function buildCheckOutMessage({ client, chambre, sejour }: any) {
  return `🏨 HÔTEL HELLAS – DÉPART CLIENT

Le client suivant vient de quitter l'hôtel :

👤 Client : ${client.nom} ${client.prenoms}
🚪 Chambre : ${chambre.numero}

🕒 Heure réelle de sortie : ${sejour.heure_sortie_reelle}
📅 Date de départ : ${fmtDate(sejour.date_sortie_reelle)}

💰 Montant total : ${fmtFCFA(sejour.montant_total)}
💵 Montant payé : ${fmtFCFA(sejour.montant_paye)}
📊 Solde : ${fmtFCFA(sejour.solde)}

La chambre est maintenant en attente de nettoyage.`;
}

export function buildExtensionMessage({ client, chambre, ancienneSortie, sejour, montantSupplementaire }: any) {
  return `🏨 PROLONGATION DE SÉJOUR

Le séjour du client ${client.nom} ${client.prenoms} a été prolongé.

🚪 Chambre : ${chambre.numero}
📅 Ancienne sortie : ${fmtDate(ancienneSortie)}
📅 Nouvelle sortie : ${fmtDate(sejour.date_sortie_prevue)}
💰 Montant supplémentaire : ${fmtFCFA(montantSupplementaire)}`;
}

export function buildUpcomingAlertMessage({ client, chambre, sejour }: any) {
  return `⏰ ALERTE – FIN DE SÉJOUR PROCHE

Le séjour du client ${client.nom} ${client.prenoms} arrive à expiration.

🚪 Chambre : ${chambre.numero}
🕒 Sortie prévue : ${sejour.heure_sortie_prevue}`;
}

export function buildDailySummaryMessage(stats: any) {
  return `🏨 HÔTEL HELLAS – RÉSUMÉ DU JOUR

👥 Clients enregistrés : ${stats.arrivees}
🚪 Départs : ${stats.departs}
🔴 Chambres occupées : ${stats.occupees}
🟢 Chambres disponibles : ${stats.libres}
💰 Recettes du jour : ${fmtFCFA(stats.recettes)}`;
}
