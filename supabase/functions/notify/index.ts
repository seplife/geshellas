// Edge Function "notify"
// Appelée par le frontend juste après un check-in / check-out / prolongation
// réussi (RPC Postgres déjà exécutée), ou pour relancer une notification en
// échec. Construit le message WhatsApp, l'envoie via l'API Meta Cloud, et
// journalise le résultat dans la table `notifications` (via service_role,
// qui contourne RLS — c'est le seul endroit autorisé à écrire dans cette
// table).
//
// Body attendu :
//   { action: "send", type: "check-in"|"check-out"|"prolongation", sejour_id }
//   { action: "retry", notification_id }
//
// Sécurité : verify_jwt est activé au déploiement, ET la fonction vérifie
// elle-même que l'appelant a un profil actif avec un rôle autorisé (sinon
// n'importe quel compte, même désactivé, pourrait envoyer des WhatsApp).

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseAsCaller } from "../_shared/supabaseAdmin.ts";
import {
  sendRaw,
  buildCheckInMessage,
  buildCheckOutMessage,
  buildExtensionMessage,
} from "../_shared/whatsapp.ts";

const MAX_RETRIES = Number(Deno.env.get("WHATSAPP_MAX_RETRIES") || 3);

/** Retourne les numéros des destinataires : admin + gérant (depuis la DB ou les secrets). */
async function getRecipients(db: ReturnType<typeof supabaseAdmin>): Promise<string[]> {
  const { data } = await db.from("parametres").select("cle, valeur").in("cle", ["admin_whatsapp", "manager_whatsapp"]);
  const map: Record<string, string> = {};
  (data || []).forEach((row: { cle: string; valeur: string }) => { map[row.cle] = row.valeur; });

  const adminNum = map["admin_whatsapp"] || Deno.env.get("WHATSAPP_ADMIN_NUMBER") || "";
  const gerantNum = map["manager_whatsapp"] || Deno.env.get("MANAGER_WHATSAPP_NUMBER") || "";

  return [adminNum, gerantNum].filter(Boolean);
}

async function sendWithLogging(
  db: ReturnType<typeof supabaseAdmin>,
  { type, to, message, sejourId }: { type: string; to: string; message: string; sejourId?: number | null }
) {
  const { data: inserted, error: insertErr } = await db
    .from("notifications")
    .insert({ type, destinataire: to, message, statut: "en_attente", tentatives: 0, sejour_id: sejourId ?? null })
    .select()
    .single();
  if (insertErr) throw insertErr;

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await sendRaw(to, message);
    if (result.ok) {
      await db
        .from("notifications")
        .update({ statut: "envoyee", tentatives: attempt, reference_externe: result.id, date_envoi: new Date().toISOString() })
        .eq("id", inserted.id);
      return { ok: true, notificationId: inserted.id };
    }
    lastError = result.error ?? "Erreur inconnue";
    await db.from("notifications").update({ tentatives: attempt }).eq("id", inserted.id);
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  await db.from("notifications").update({ statut: "echec", erreur: lastError }).eq("id", inserted.id);
  return { ok: false, notificationId: inserted.id, error: lastError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const caller = supabaseAsCaller(req.headers.get("Authorization"));
    const { data: { user }, error: authErr } = await caller.auth.getUser();
    if (authErr || !user) return jsonResponse({ error: "Authentification requise." }, 401);

    const db = supabaseAdmin();
    const { data: profile } = await db.from("profiles").select("role, actif").eq("id", user.id).maybeSingle();
    if (!profile?.actif) return jsonResponse({ error: "Compte désactivé." }, 403);

    const body = await req.json();
    const allowed = body.action === "retry" ? ["admin", "gerant"] : ["admin", "reception"];
    if (!allowed.includes(profile.role)) return jsonResponse({ error: "Accès non autorisé pour ce rôle." }, 403);

    if (body.action === "retry") {
      const { data: n, error } = await db.from("notifications").select("*").eq("id", body.notification_id).single();
      if (error || !n) return jsonResponse({ error: "Notification introuvable." }, 404);
      const result = await sendWithLogging(db, { type: n.type, to: n.destinataire, message: n.message, sejourId: n.sejour_id });
      return jsonResponse(result);
    }

    if (body.action === "send") {
      const { data: sejour, error: sejourErr } = await db
        .from("sejours")
        .select("*, clients:client_id(*), chambres:chambre_id(*)")
        .eq("id", body.sejour_id)
        .single();
      if (sejourErr || !sejour) return jsonResponse({ error: "Séjour introuvable." }, 404);

      // Récupérer les deux destinataires : admin + gérant
      const recipients = await getRecipients(db);
      if (recipients.length === 0) {
        return jsonResponse({ error: "Aucun numéro destinataire configuré." }, 500);
      }

      const ctx = { client: sejour.clients, chambre: sejour.chambres, sejour };

      let message: string;
      if (body.type === "check-in") message = buildCheckInMessage(ctx);
      else if (body.type === "check-out") message = buildCheckOutMessage(ctx);
      else if (body.type === "prolongation") {
        message = buildExtensionMessage({
          ...ctx,
          ancienneSortie: body.ancienne_sortie,
          montantSupplementaire: body.montant_supplementaire,
        });
      } else {
        return jsonResponse({ error: "Type de notification inconnu." }, 400);
      }

      // Envoyer à chaque destinataire (admin + gérant) en parallèle
      const results = await Promise.all(
        recipients.map((to) => sendWithLogging(db, { type: body.type, to, message, sejourId: sejour.id }))
      );

      const allOk = results.every((r) => r.ok);
      return jsonResponse({ ok: allOk, results });
    }

    return jsonResponse({ error: "Action inconnue." }, 400);
  } catch (err) {
    console.error("Erreur notify:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur interne." }, 500);
  }
});
