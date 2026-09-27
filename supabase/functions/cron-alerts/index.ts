// Edge Function "cron-alerts"
// Remplace le node-cron du backend Express. Appelée périodiquement par
// pg_cron + pg_net (voir supabase/README.md pour la configuration exacte) :
//   - ?job=checkout toutes les 5 minutes : alerte "fin de séjour proche"
//   - ?job=daily une fois par jour à 21h : résumé journalier
//
// Cette fonction n'est PAS appelée avec un JWT utilisateur (c'est pg_cron qui
// l'appelle) : elle doit être déployée avec --no-verify-jwt et est protégée
// par un secret partagé (en-tête x-cron-secret) au lieu de l'auth Supabase.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendRaw, buildUpcomingAlertMessage, buildDailySummaryMessage } from "../_shared/whatsapp.ts";

async function managerNumber(db: ReturnType<typeof supabaseAdmin>) {
  const { data } = await db.from("parametres").select("valeur").eq("cle", "manager_whatsapp").maybeSingle();
  return data?.valeur || Deno.env.get("MANAGER_WHATSAPP_NUMBER") || "";
}

async function logAndSend(
  db: ReturnType<typeof supabaseAdmin>,
  { type, to, message, sejourId }: { type: string; to: string; message: string; sejourId?: number | null }
) {
  const { data: inserted } = await db
    .from("notifications")
    .insert({ type, destinataire: to, message, statut: "en_attente", tentatives: 1, sejour_id: sejourId ?? null })
    .select()
    .single();

  const result = await sendRaw(to, message);
  await db
    .from("notifications")
    .update(
      result.ok
        ? { statut: "envoyee", reference_externe: result.id, date_envoi: new Date().toISOString() }
        : { statut: "echec", erreur: result.error }
    )
    .eq("id", inserted?.id);
}

async function runCheckoutAlerts(db: ReturnType<typeof supabaseAdmin>) {
  const { data: sejours, error } = await db.rpc("get_upcoming_checkouts", { p_window_minutes: 30 });
  if (error) throw error;
  const to = await managerNumber(db);
  let sent = 0;

  for (const sejour of sejours ?? []) {
    // Anti-doublon : ne pas ré-alerter un séjour déjà notifié dans l'heure.
    const { count } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("type", "alerte-fin-sejour")
      .eq("sejour_id", sejour.id)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if (count && count > 0) continue;

    const message = buildUpcomingAlertMessage({
      client: { nom: sejour.client_nom, prenoms: sejour.client_prenoms },
      chambre: { numero: sejour.chambre_numero },
      sejour,
    });
    await logAndSend(db, { type: "alerte-fin-sejour", to, message, sejourId: sejour.id });
    sent++;
  }
  return { checked: sejours?.length ?? 0, sent };
}

async function runDailySummary(db: ReturnType<typeof supabaseAdmin>) {
  const today = new Date().toISOString().slice(0, 10);

  // Anti-doublon : un seul résumé par jour.
  const { count } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", "resume-journalier")
    .gte("created_at", `${today}T00:00:00Z`);
  if (count && count > 0) return { skipped: true };

  const { data: stats, error } = await db.rpc("get_daily_summary", { p_day: today });
  if (error) throw error;
  const to = await managerNumber(db);
  const message = buildDailySummaryMessage(stats);
  await logAndSend(db, { type: "resume-journalier", to, message });
  return { skipped: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (expectedSecret && req.headers.get("x-cron-secret") !== expectedSecret) {
    return jsonResponse({ error: "Non autorisé." }, 401);
  }

  try {
    const db = supabaseAdmin();
    const job = new URL(req.url).searchParams.get("job");

    if (job === "checkout") return jsonResponse(await runCheckoutAlerts(db));
    if (job === "daily") return jsonResponse(await runDailySummary(db));
    return jsonResponse({ error: "Paramètre ?job=checkout|daily requis." }, 400);
  } catch (err) {
    console.error("Erreur cron-alerts:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur interne." }, 500);
  }
});
