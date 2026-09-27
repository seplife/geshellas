// Tests des migrations et des règles métier sur un Postgres embarqué (PGlite).
// Lancer : npm run test:db
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const m1 = fs.readFileSync(`${root}/migrations/0001_init.sql`, "utf8");
const m2 = fs.readFileSync(`${root}/migrations/0002_corrections.sql`, "utf8");
const seed = fs.readFileSync(`${root}/seed.sql`, "utf8");

const db = new PGlite({ extensions: { pgcrypto } });
let failures = 0;
const ok = (msg) => console.log("  ✔", msg);
const ko = (msg) => { failures++; console.log("  ✘", msg); };

async function expectOk(label, sql, params) {
  try { const r = await db.query(sql, params); ok(label); return r.rows; }
  catch (e) { ko(`${label} → ${e.message}`); return null; }
}
async function expectErr(label, sql, re, params) {
  try { await db.query(sql, params); ko(`${label} → aucune erreur`); }
  catch (e) { (re.test(e.message) ? ok : ko)(`${label} → « ${e.message} »`); }
}
const asUser = (uid) => db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false)`);
const one = async (sql, p) => (await db.query(sql, p)).rows[0];

// --- Stubs Supabase ---
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}',
    raw_app_meta_data jsonb default '{}', last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
`);

console.log("Migrations");
try { await db.exec(m1); ok("0001 (1re exécution)"); } catch (e) { ko("0001: " + e.message); process.exit(1); }
try { await db.exec(m1); ok("0001 relancé sans erreur (idempotent)"); } catch (e) { ko("0001 relance: " + e.message); }
try { await db.exec(m2); ok("0002 exécuté"); } catch (e) { ko("0002: " + e.message); process.exit(1); }
try { await db.exec(m2); ok("0002 relancé sans erreur (idempotent)"); } catch (e) { ko("0002 relance: " + e.message); }
await db.exec(seed);
await db.exec(`grant usage on schema public to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated;
  grant all on all sequences in schema public to anon, authenticated;`);

const fn = await one(`select pg_get_function_identity_arguments('public.get_dashboard'::regproc) as args`);
(fn.args === "" ? ok : ko)(`public.get_dashboard() existe sans paramètre`);

console.log("\nSécurité des comptes");
const ADMIN = "00000000-0000-0000-0000-000000000001";
const PIRATE = "00000000-0000-0000-0000-000000000002";
const RECEP = "00000000-0000-0000-0000-000000000003";
const ENTRET = "00000000-0000-0000-0000-000000000004";
await db.exec(`insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('${ADMIN}', 'admin@h.ci', '{"nom":"Admin"}', '{"role":"admin"}'),
  ('${PIRATE}', 'pirate@x.io', '{"nom":"Pirate","role":"admin"}', '{}'),
  ('${RECEP}', 'recep@h.ci', '{"nom":"Réception"}', '{"role":"reception"}'),
  ('${ENTRET}', 'ent@h.ci', '{"nom":"Entretien"}', '{"role":"entretien"}')`);
const pirate = await one(`select role, actif from profiles where id = $1`, [PIRATE]);
(pirate.role !== "admin" && !pirate.actif ? ok : ko)(`inscription avec role=admin dans user_metadata → ${pirate.role}, actif=${pirate.actif}`);
const admin = await one(`select role, actif from profiles where id = $1`, [ADMIN]);
(admin.role === "admin" && admin.actif ? ok : ko)("admin créé via app_metadata → admin actif");

await asUser(PIRATE);
await db.exec("set role authenticated");
await expectErr("compte non activé → get_dashboard refusé", "select public.get_dashboard()", /désactivé/);
await db.exec("reset role");

await db.exec("set role anon");
await expectErr("anon → get_upcoming_checkouts refusé", "select public.get_upcoming_checkouts(30)", /permission denied/);
await expectErr("anon → get_dashboard refusé", "select public.get_dashboard()", /permission denied/);
await db.exec("reset role");
await db.exec("set role authenticated");
await asUser(ADMIN);
await expectErr("authenticated → mark_notification_result refusé", "select public.mark_notification_result(1, true, 1)", /permission denied/);
await expectErr("admin ne peut pas se désactiver", `select public.set_user_active('${ADMIN}', false)`, /propre compte/);
await expectOk("admin active le compte inconnu", `select public.set_user_active('${PIRATE}', true)`);
const users = await expectOk("list_users renvoie les e-mails", "select * from public.list_users()");
if (users && !users.every((u) => u.email)) ko("e-mails manquants");

console.log("\nParcours métier (en tant que réception)");
await asUser(RECEP);
const d0 = (await one("select public.get_dashboard() as d")).d;
(d0.total_chambres === 6 && d0.libres === 6 ? ok : ko)(`tableau de bord : ${d0.total_chambres} chambres, ${d0.libres} libres`);
const room = async (n) => one(`select id, statut, panne_note from chambres where numero = $1`, [n]);
const r101 = await room("101"), r102 = await room("102"), r103 = await room("103");

// Réservation future : la chambre ne doit PAS être bloquée aujourd'hui.
await expectOk("réservation future (J+10 → J+12) sur 102",
  `select public.create_reservation('Future Kouassi', '0700', $1, current_date + 10, current_date + 12, 0, 5000, 'Wave')`, [r102.id]);
(((await room("102")).statut === "libre") ? ok : ko)("102 reste libre (réservation dans 10 jours)");
await expectOk("walk-in sur 102 pour 3 nuits (pas de chevauchement)",
  `select public.check_in('{"nom":"A","prenoms":"B","telephone":"01","numero_piece":"P1","type_piece":"CNI"}', $1, current_date, '12:00', current_date + 3, '12:00')`, [r102.id]);
await expectErr("prolonger 102 jusqu'à J+11 → conflit réservation",
  `select public.extend_stay((select id from sejours where chambre_id = $1 and statut='en_cours'), current_date + 11, '12:00')`, /réservée/, [r102.id]);

// Réservation du jour → chambre réservée, walk-in refusé, check-in depuis la réservation OK.
const resa = (await one(`select public.create_reservation('Yao Konan', '0707', $1, current_date, current_date + 2, 0, 10000, 'Orange Money') as r`, [r101.id])).r;
(resa.montant === 30000 ? ok : ko)(`montant calculé automatiquement : ${resa.montant} (2 nuits × 15 000)`);
(((await room("101")).statut === "reservee") ? ok : ko)("101 passe en « réservée » (arrivée aujourd'hui)");
await expectErr("chevauchement de réservations refusé",
  `select public.create_reservation('Autre', null, $1, current_date + 1, current_date + 3)`, /déjà réservée/, [r101.id]);
await expectErr("walk-in sur 101 réservée → refusé",
  `select public.check_in('{"nom":"X","prenoms":"Y","telephone":"02","numero_piece":"P2"}', $1, current_date, '12:00', current_date + 1, '12:00')`, /réservée/, [r101.id]);
const ci = await expectOk("check-in depuis la réservation",
  `select public.check_in('{"nom":"Yao","prenoms":"Konan","telephone":"0707","numero_piece":"CI-9"}', $1, current_date, '14:00', current_date + 2, '12:00', 1, 5000, 'Espèces', $2) as r`, [r101.id, resa.id]);
const sej = ci?.[0]?.r?.sejour;
if (sej) {
  (Number(sej.montant_paye) === 15000 && Number(sej.solde) === 15000 ? ok : ko)(`avance réservation reprise : payé ${sej.montant_paye}, solde ${sej.solde}`);
  (/^SEJ-\d{6}-\d{4}$/.test(sej.numero) ? ok : ko)(`numéro de séjour unique : ${sej.numero}`);
}
const rs = await one("select statut from reservations where id = $1", [resa.id]);
(rs.statut === "client_arrive" ? ok : ko)(`réservation → ${rs.statut}`);

// Doublon client : même pièce → même fiche.
await expectOk("2e séjour même pièce CI-9 sur 103",
  `select public.check_in('{"nom":"Yao","prenoms":"Konan","telephone":"0708","numero_piece":"CI-9"}', $1, current_date, '14:00', current_date + 1, '12:00')`, [r103.id]);
const nbCli = await one("select count(*)::int n from clients where numero_piece = 'CI-9'");
(nbCli.n === 1 ? ok : ko)(`une seule fiche client pour la pièce CI-9 (${nbCli.n})`);

await expectErr("dates incohérentes refusées",
  `select public.check_in('{"nom":"A","prenoms":"B","telephone":"1","numero_piece":"Z"}', (select id from chambres where numero='201'), current_date, '12:00', current_date - 1, '12:00')`, /date de sortie/);

await expectOk("paiement 15 000", `select public.record_payment($1, 15000, 'Wave')`, [sej?.id]);

// Anomalie sur chambre occupée : reste occupée, check-out possible, puis maintenance.
await asUser(ENTRET);
await expectOk("entretien signale une anomalie sur 101 occupée", `select public.signaler_anomalie($1, 'Clim en panne')`, [r101.id]);
(((await room("101")).statut === "occupee") ? ok : ko)("101 reste occupée");
const dEnt = (await one("select public.get_dashboard() as d")).d;
(dEnt.recettes_jour === null && dEnt.soldes_restants.length === 0 ? ok : ko)("tableau de bord entretien : pas de données financières");
await expectErr("entretien ne peut pas faire de check-out", `select public.check_out($1)`, /non autorisé/, [sej?.id]);
await asUser(RECEP);
const co = await expectOk("check-out 101", `select public.check_out($1, 0) as r`, [sej?.id]);
if (co) (Number(co[0].r.sejour.solde) === 0 ? ok : ko)(`solde final ${co[0].r.sejour.solde}`);
(((await room("101")).statut === "maintenance") ? ok : ko)("101 → maintenance après départ (anomalie signalée)");
await asUser(ENTRET);
await expectOk("remise en service 101", `select public.valider_nettoyage($1)`, [r101.id]);
const after = await room("101");
(after.statut === "libre" && after.panne_note === null ? ok : ko)(`101 → ${after.statut}, note effacée`);

console.log("\nChambres (admin)");
await asUser(ADMIN);
await expectOk("création chambre 301", `select public.create_room('{"numero":"301","type":"Suite","prix_nuit":"40000","capacite":"3"}')`);
await expectErr("doublon de numéro refusé", `select public.create_room('{"numero":"301","type":"Suite","prix_nuit":"1"}')`, /existe déjà/);
await expectOk("modification prix 301", `select public.update_room((select id from chambres where numero='301'), '{"prix_nuit":"42000","description":""}')`);
(Number((await one("select prix_nuit from chambres where numero='301'")).prix_nuit) === 42000 ? ok : ko)("prix mis à jour");
await asUser(RECEP);
await expectErr("réception ne peut pas créer de chambre", `select public.create_room('{"numero":"302","type":"x","prix_nuit":"1"}')`, /non autorisé/);
await db.exec("delete from chambres where numero='301'");

console.log("\nTableau de bord final");
await asUser(RECEP);
const d = (await one("select public.get_dashboard() as d")).d;
console.log("  ", JSON.stringify({ libres: d.libres, occupees: d.occupees, recettes_jour: d.recettes_jour, taux: d.taux_occupation, soldes: d.soldes_restants.length, r7: d.recettes_7j.length }));
(Number(d.recettes_jour) === 35000 ? ok : ko)(`recettes du jour = 5 000 (avance 102) + 10 000 (avance résa) + 5 000 + 15 000 = ${d.recettes_jour}`);

// Annulation d'une réservation du jour → chambre libérée
const r2 = (await one(`select public.create_reservation('Annule', null, (select id from chambres where numero='202'), current_date, current_date + 1) as r`)).r;
await expectOk("annulation réservation", `select public.cancel_reservation($1)`, [r2.id]);
(((await room("202")).statut === "libre") ? ok : ko)("202 revient à libre");
await expectErr("double annulation refusée", `select public.cancel_reservation($1)`, /plus active/, [r2.id]);

await db.exec("reset role");
console.log(failures ? `\n${failures} échec(s)` : "\nTous les tests passent.");
process.exit(failures ? 1 : 0);
