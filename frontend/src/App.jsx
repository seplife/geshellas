import React, { useState, useEffect, useCallback } from "react";
import { api, getToken, getStoredUser, setSession, clearSession } from "./api.js";

const PALETTE = {
  ink: "#1B2420", inkSoft: "#4A544E", paper: "#F4F6F2", paperRaised: "#FFFFFF",
  line: "#DCE3DC", brand: "#1F5D50", brandDark: "#123D34", brandSoft: "#E4EFEC",
  ochre: "#C98A2C", ochreSoft: "#F6E9D3",
};
const STATUS = {
  libre: { label: "Libre", color: "#2F9E63", bg: "#E5F5EC", dot: "🟢" },
  occupee: { label: "Occupée", color: "#D64545", bg: "#FBE7E7", dot: "🔴" },
  reservee: { label: "Réservée", color: "#C98A2C", bg: "#F6E9D3", dot: "🟡" },
  nettoyage: { label: "En nettoyage", color: "#2F80C7", bg: "#E4EEF9", dot: "🔵" },
  maintenance: { label: "Maintenance", color: "#495057", bg: "#E7E9EA", dot: "⚫" },
};
const ROLE_LABELS = { admin: "Administrateur", gerant: "Gérant", reception: "Réceptionniste", entretien: "Entretien" };
const NAV_BY_ROLE = {
  admin: ["dashboard", "rooms", "clients", "reservations", "payments", "notifications", "settings"],
  gerant: ["dashboard", "rooms", "clients", "payments", "notifications"],
  reception: ["dashboard", "rooms", "clients", "reservations", "payments"],
  entretien: ["dashboard", "rooms"],
};
const PAY_MODES = ["Espèces", "Orange Money", "MTN Money", "Moov Money", "Wave", "Carte bancaire"];

function fmtFCFA(n) { return `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} FCFA`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTime() { return new Date().toTimeString().slice(0, 5); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString("fr-FR") : "—"; }
function nightsBetween(d1, d2) {
  const diff = Math.round((new Date(d2) - new Date(d1)) / 86400000);
  return Math.max(1, diff);
}

const inputStyle = { border: `1px solid ${PALETTE.line}`, borderRadius: "10px", padding: "8px 10px", fontSize: "14px", background: "#fff", color: PALETTE.ink, outline: "none" };
function Input(props) { return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Select(props) { return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Field({ label, children, required }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span style={{ color: PALETTE.inkSoft }}>{label} {required && <span style={{ color: "#D64545" }}>*</span>}</span>
      {children}
    </label>
  );
}
function Button({ children, variant = "primary", ...props }) {
  const styles = {
    primary: { background: PALETTE.brand, color: "#fff" },
    ghost: { background: "transparent", color: PALETTE.brand, border: `1px solid ${PALETTE.brand}` },
    subtle: { background: PALETTE.paper, color: PALETTE.ink, border: `1px solid ${PALETTE.line}` },
    danger: { background: "#D64545", color: "#fff" },
  };
  return (
    <button {...props} className={"rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40 " + (props.className || "")} style={{ ...styles[variant], ...(props.style || {}) }}>
      {children}
    </button>
  );
}
function Badge({ statut }) {
  const s = STATUS[statut];
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: s.bg, color: s.color }}><span>{s.dot}</span>{s.label}</span>;
}
function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: PALETTE.paperRaised, border: `1px solid ${PALETTE.line}` }}>
      <span className="text-xs" style={{ color: PALETTE.inkSoft }}>{label}</span>
      <span className="text-2xl font-semibold" style={{ color: accent || PALETTE.ink, fontFamily: "var(--font-display)" }}>{value}</span>
    </div>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto" style={{ background: "rgba(18,61,52,0.35)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={"w-full rounded-2xl p-5 my-6 " + (wide ? "max-w-2xl" : "max-w-md")} style={{ background: PALETTE.paperRaised, border: `1px solid ${PALETTE.line}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: PALETTE.brandDark }}>{title}</h3>
          <button onClick={onClose} className="text-lg leading-none px-2" style={{ color: PALETTE.inkSoft }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&display=swap');
      :root { --font-display: 'Fraunces', Georgia, serif; --font-body: 'Work Sans', system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: ${PALETTE.line}; border-radius: 8px; }
    `}</style>
  );
}

/* ---------------- Login ---------------- */
function LoginView({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.login(email, password);
      setSession(token, user);
      onLoggedIn(user);
    } catch (err) {
      setError(err.message || "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: PALETTE.paper, fontFamily: "var(--font-body)" }}>
      <GlobalStyle />
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-3" style={{ background: PALETTE.paperRaised, border: `1px solid ${PALETTE.line}` }}>
        <div className="mb-2">
          <div className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: PALETTE.brandDark }}>Hellas Hôtel Manager</div>
          <div className="text-xs" style={{ color: PALETTE.inkSoft }}>Divo, Côte d'Ivoire</div>
        </div>
        <Field label="Adresse e-mail" required>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@hellas-hotel.ci" />
        </Field>
        <Field label="Mot de passe" required>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <div className="text-sm rounded-lg p-2" style={{ background: "#FBE7E7", color: "#8A2C2C" }}>{error}</div>}
        <Button type="submit" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</Button>
      </form>
    </div>
  );
}

/* ---------------- App ---------------- */
export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [tab, setTab] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  const [dashboard, setDashboard] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeStays, setActiveStays] = useState([]);
  const [clients, setClients] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (getToken() && !user) {
      api.me().then((r) => setUser(r.user)).catch(() => clearSession());
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (user && !NAV_BY_ROLE[user.role].includes(tab)) setTab(NAV_BY_ROLE[user.role][0]);
  }, [user]); // eslint-disable-line

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3200); };
  const showError = (err) => showToast(err.message || "Une erreur est survenue.");

  const reloadDashboard = useCallback(() => api.dashboard().then(setDashboard).catch(showError), []);
  const reloadRooms = useCallback(() => api.rooms().then(setRooms).catch(showError), []);
  const reloadActiveStays = useCallback(() => api.stays({ statut: "en_cours" }).then(setActiveStays).catch(showError), []);
  const reloadClients = useCallback((q) => api.clients(q).then(setClients).catch(showError), []);
  const reloadReservations = useCallback(() => api.reservations().then(setReservations).catch(showError), []);
  const reloadPayments = useCallback(() => api.payments().then(setPayments).catch(showError), []);
  const reloadNotifications = useCallback(() => api.notifications().then(setNotifications).catch(showError), []);
  const reloadSettings = useCallback(() => api.settings().then(setSettings).catch(showError), []);

  const reloadAll = useCallback(() => {
    reloadDashboard(); reloadRooms(); reloadActiveStays();
  }, [reloadDashboard, reloadRooms, reloadActiveStays]);

  useEffect(() => {
    if (!user) return;
    setLoadError("");
    if (tab === "dashboard") reloadDashboard();
    if (tab === "rooms") { reloadRooms(); reloadActiveStays(); }
    if (tab === "clients") reloadClients();
    if (tab === "reservations") { reloadReservations(); reloadRooms(); }
    if (tab === "payments") reloadPayments();
    if (tab === "notifications") reloadNotifications();
    if (tab === "settings") reloadSettings();
  }, [tab, user]); // eslint-disable-line

  if (!user) {
    return <LoginView onLoggedIn={setUser} />;
  }

  const logout = () => { clearSession(); setUser(null); };
  const canSee = (t) => NAV_BY_ROLE[user.role].includes(t);

  const runAction = async (fn, successMsg) => {
    try {
      await fn();
      if (successMsg) showToast(successMsg);
      setModal(null);
      reloadAll();
      if (tab === "clients") reloadClients();
      if (tab === "reservations") reloadReservations();
      if (tab === "payments") reloadPayments();
    } catch (err) {
      showToast(err.message || "Une erreur est survenue.");
    }
  };

  return (
    <div className="w-full min-h-screen flex" style={{ background: PALETTE.paper, fontFamily: "var(--font-body)", color: PALETTE.ink }}>
      <GlobalStyle />

      <aside className={`fixed sm:static z-40 top-0 left-0 h-full sm:h-auto w-64 shrink-0 flex flex-col transition-transform ${navOpen ? "translate-x-0" : "-translate-x-full"} sm:translate-x-0`} style={{ background: PALETTE.brandDark, color: "#fff" }}>
        <div className="p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Hellas Hôtel</div>
          <div className="text-xs opacity-70">Manager · Divo, Côte d'Ivoire</div>
        </div>
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
          {[["dashboard", "Tableau de bord"], ["rooms", "Chambres"], ["clients", "Clients"], ["reservations", "Réservations"], ["payments", "Paiements"], ["notifications", "Notifications"], ["settings", "Paramètres"]]
            .filter(([k]) => canSee(k)).map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); setNavOpen(false); }} className="text-left rounded-lg px-3 py-2 text-sm transition-colors" style={{ background: tab === key ? "rgba(255,255,255,0.14)" : "transparent", color: "#fff", fontWeight: tab === key ? 600 : 400 }}>
                {label}
              </button>
          ))}
        </nav>
        <div className="p-4 text-[11px] opacity-60 border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>Connecté à l'API Hellas Hôtel Manager</div>
      </aside>
      {navOpen && <div className="fixed inset-0 bg-black/30 z-30 sm:hidden" onClick={() => setNavOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 py-3" style={{ background: PALETTE.paperRaised, borderBottom: `1px solid ${PALETTE.line}` }}>
          <div className="flex items-center gap-3">
            <button className="sm:hidden text-xl" onClick={() => setNavOpen(true)}>☰</button>
            <div>
              <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>{user.nom} {user.prenoms} · {ROLE_LABELS[user.role]}</div>
              <div className="text-[11px]" style={{ color: PALETTE.inkSoft }}>{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
            </div>
          </div>
          <Button variant="subtle" onClick={logout}>Déconnexion</Button>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {tab === "dashboard" && <Dashboard dashboard={dashboard} />}
          {tab === "rooms" && (
            <Rooms rooms={rooms} role={user.role} activeStays={activeStays}
              onCheckIn={(room) => setModal({ type: "checkin", room })}
              onCheckOut={(stay) => setModal({ type: "checkout", stay })}
              onExtend={(stay) => setModal({ type: "extend", stay })}
              onPay={(stay) => setModal({ type: "pay", stay })}
              onClean={(roomId) => runAction(() => api.validerNettoyage(roomId), "Chambre remise en service.")}
              onMaintenance={(room) => setModal({ type: "maintenance", room })}
            />
          )}
          {tab === "clients" && <Clients clients={clients} onSearch={reloadClients} />}
          {tab === "reservations" && (
            <Reservations reservations={reservations}
              onCreate={() => setModal({ type: "reservation" })}
              onCancel={(id) => runAction(() => api.cancelReservation(id), "Réservation annulée.")}
            />
          )}
          {tab === "payments" && <Payments payments={payments} />}
          {tab === "notifications" && (
            <NotificationsView notifications={notifications}
              onRetry={(id) => runAction(() => api.retryNotification(id), "Nouvelle tentative effectuée.")}
            />
          )}
          {tab === "settings" && settings && <SettingsView settings={settings} onSave={(v) => runAction(() => api.updateSettings(v), "Paramètres enregistrés.")} />}
          {loadError && <div className="text-sm text-red-600 mt-4">{loadError}</div>}
        </main>
      </div>

      {modal?.type === "checkin" && (
        <CheckInModal room={modal.room} rooms={rooms} onClose={() => setModal(null)}
          onSubmit={(payload) => runAction(() => api.checkIn(payload), `Check-in enregistré — chambre ${modal.room.numero} occupée.`)} />
      )}
      {modal?.type === "checkout" && (
        <CheckOutModal stay={modal.stay} onClose={() => setModal(null)}
          onSubmit={(id, payload) => runAction(() => api.checkOut(id, payload), `Check-out effectué.`)} />
      )}
      {modal?.type === "extend" && (
        <ExtendModal stay={modal.stay} onClose={() => setModal(null)}
          onSubmit={(id, payload) => runAction(() => api.extendStay(id, payload), "Séjour prolongé.")} />
      )}
      {modal?.type === "pay" && (
        <PayModal stay={modal.stay} onClose={() => setModal(null)}
          onSubmit={(payload) => runAction(() => api.recordPayment(payload), "Paiement enregistré.")} />
      )}
      {modal?.type === "maintenance" && (
        <MaintenanceModal room={modal.room} onClose={() => setModal(null)}
          onSubmit={(roomId, description) => runAction(() => api.signalerAnomalie(roomId, description), "Anomalie signalée.")} />
      )}
      {modal?.type === "reservation" && (
        <ReservationModal rooms={rooms.filter((r) => r.statut === "libre")} onClose={() => setModal(null)}
          onSubmit={(payload) => runAction(() => api.createReservation(payload), "Réservation créée.")} />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-sm shadow-lg" style={{ background: PALETTE.brandDark, color: "#fff" }}>{toast}</div>
      )}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ dashboard: m }) {
  if (!m) return <div style={{ color: PALETTE.inkSoft }}>Chargement du tableau de bord…</div>;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: PALETTE.brandDark }}>Tableau de bord</h1>
        <p className="text-sm" style={{ color: PALETTE.inkSoft }}>Vue d'ensemble en temps réel de l'Hôtel Hellas.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Chambres au total" value={m.total_chambres} />
        <StatCard label="Libres" value={m.libres} accent="#2F9E63" />
        <StatCard label="Occupées" value={m.occupees} accent="#D64545" />
        <StatCard label="Réservées" value={m.reservees} accent="#C98A2C" />
        <StatCard label="En nettoyage" value={m.nettoyage} accent="#2F80C7" />
        <StatCard label="En maintenance" value={m.maintenance} accent="#495057" />
        <StatCard label="Clients présents" value={m.clients_presents} />
        <StatCard label="Taux d'occupation" value={`${m.taux_occupation}%`} accent={PALETTE.brand} />
        <StatCard label="Arrivées aujourd'hui" value={m.arrivees_jour} />
        <StatCard label="Départs prévus aujourd'hui" value={m.departs_jour} />
        <StatCard label="Recettes du jour" value={fmtFCFA(m.recettes_jour)} accent={PALETTE.ochre} />
      </div>
      <div>
        <h2 className="text-base font-semibold mb-2" style={{ color: PALETTE.brandDark }}>Alertes</h2>
        <div className="flex flex-col gap-2">
          {m.sejours_en_retard.length === 0 && m.soldes_restants.length === 0 && m.nettoyage === 0 && m.maintenance === 0 && (
            <div className="text-sm rounded-xl p-3" style={{ background: PALETTE.brandSoft, color: PALETTE.brandDark }}>Aucune alerte pour le moment.</div>
          )}
          {m.sejours_en_retard.map((s) => (
            <div key={s.id} className="text-sm rounded-xl p-3" style={{ background: "#FBE7E7", color: "#8A2C2C" }}>
              ⏰ Sortie dépassée — {s.client_nom} {s.client_prenoms}, chambre {s.chambre_numero} (prévue {fmtDate(s.date_sortie_prevue)} {s.heure_sortie_prevue})
            </div>
          ))}
          {m.soldes_restants.map((s) => (
            <div key={s.id} className="text-sm rounded-xl p-3" style={{ background: PALETTE.ochreSoft, color: "#7A5416" }}>
              💰 Solde restant de {fmtFCFA(s.solde)} — {s.client_nom} {s.client_prenoms}, chambre {s.chambre_numero}.
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Rooms ---------------- */
function Rooms({ rooms, role, activeStays, onCheckIn, onCheckOut, onExtend, onPay, onClean, onMaintenance }) {
  const [filterStatus, setFilterStatus] = useState("tous");
  const floors = [...new Set(rooms.map((r) => r.etage))].sort();
  const [filterFloor, setFilterFloor] = useState("tous");
  const filtered = rooms.filter((r) => (filterStatus === "tous" || r.statut === filterStatus) && (filterFloor === "tous" || r.etage === Number(filterFloor)));
  const canOperate = role === "admin" || role === "reception";
  const canClean = role === "admin" || role === "entretien";
  const stayFor = (roomId) => activeStays.find((s) => s.chambre_id === roomId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: PALETTE.brandDark }}>Chambres</h1>
          <p className="text-sm" style={{ color: PALETTE.inkSoft }}>{filtered.length} chambre(s) affichée(s) sur {rooms.length}.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="tous">Tous les statuts</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select value={filterFloor} onChange={(e) => setFilterFloor(e.target.value)}>
            <option value="tous">Tous les étages</option>
            {floors.map((f) => <option key={f} value={f}>Étage {f}</option>)}
          </Select>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((room) => {
          const stay = stayFor(room.id);
          return (
            <div key={room.id} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: PALETTE.paperRaised, border: `1px solid ${PALETTE.line}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Chambre {room.numero}</div>
                  <div className="text-xs" style={{ color: PALETTE.inkSoft }}>{room.type} · Étage {room.etage} · {fmtFCFA(room.prix_nuit)}/nuit</div>
                </div>
                <Badge statut={room.statut} />
              </div>
              {stay && (
                <div className="text-xs rounded-lg p-2" style={{ background: PALETTE.paper }}>
                  <div>Client : <strong>{stay.client_nom} {stay.client_prenoms}</strong></div>
                  <div>Sortie prévue : {fmtDate(stay.date_sortie_prevue)} {stay.heure_sortie_prevue}</div>
                  <div>Solde : <span style={{ color: Number(stay.solde) > 0 ? "#D64545" : "#2F9E63" }}>{fmtFCFA(stay.solde)}</span></div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-1">
                {room.statut === "libre" && canOperate && <Button onClick={() => onCheckIn(room)}>Check-in</Button>}
                {room.statut === "occupee" && canOperate && stay && (
                  <>
                    <Button variant="subtle" onClick={() => onPay(stay)}>Paiement</Button>
                    <Button variant="subtle" onClick={() => onExtend(stay)}>Prolonger</Button>
                    <Button variant="danger" onClick={() => onCheckOut(stay)}>Check-out</Button>
                  </>
                )}
                {room.statut === "nettoyage" && canClean && <Button onClick={() => onClean(room.id)}>Valider le nettoyage</Button>}
                {(room.statut === "libre" || room.statut === "occupee") && (role === "admin" || role === "entretien") && (
                  <Button variant="ghost" onClick={() => onMaintenance(room)}>Signaler une anomalie</Button>
                )}
                {room.statut === "maintenance" && role === "admin" && <Button variant="subtle" onClick={() => onClean(room.id)}>Remettre en service</Button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Clients ---------------- */
function Clients({ clients, onSearch }) {
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => onSearch(q), 300); return () => clearTimeout(t); }, [q]); // eslint-disable-line
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: PALETTE.brandDark }}>Clients</h1>
        <p className="text-sm" style={{ color: PALETTE.inkSoft }}>Historique et fiches clients.</p>
      </div>
      <Input placeholder="Rechercher par nom, téléphone ou n° de pièce…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="flex flex-col gap-3">
        {clients.length === 0 && <div className="text-sm" style={{ color: PALETTE.inkSoft }}>Aucun client trouvé.</div>}
        {clients.map((c) => (
          <div key={c.id} className="rounded-2xl p-4" style={{ background: PALETTE.paperRaised, border: `1px solid ${PALETTE.line}` }}>
            <div className="font-semibold">{c.nom} {c.prenoms}</div>
            <div className="text-xs" style={{ color: PALETTE.inkSoft }}>{c.telephone} · {c.type_piece} n° {c.numero_piece}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Reservations ---------------- */
function Reservations({ reservations, onCreate, onCancel }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: PALETTE.brandDark }}>Réservations</h1>
          <p className="text-sm" style={{ color: PALETTE.inkSoft }}>Suivi des réservations à venir.</p>
        </div>
        <Button onClick={onCreate}>+ Nouvelle réservation</Button>
      </div>
      <div className="flex flex-col gap-3">
        {reservations.length === 0 && <div className="text-sm" style={{ color: PALETTE.inkSoft }}>Aucune réservation enregistrée.</div>}
        {reservations.map((r) => (
          <div key={r.id} className="rounded-2xl p-4 flex flex-wrap justify-between gap-2 items-center" style={{ background: PALETTE.paperRaised, border: `1px solid ${PALETTE.line}` }}>
            <div>
              <div className="font-semibold">{r.nom_client}</div>
              <div className="text-xs" style={{ color: PALETTE.inkSoft }}>Chambre {r.chambre_numero} · {fmtDate(r.date_arrivee)} → {fmtDate(r.date_depart)}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: r.statut === "annulee" ? "#E7E9EA" : PALETTE.ochreSoft, color: r.statut === "annulee" ? "#495057" : "#7A5416" }}>
                {r.statut === "annulee" ? "Annulée" : "Confirmée"}
              </span>
              <span className="text-sm">{fmtFCFA(r.montant)}</span>
              {r.statut !== "annulee" && <Button variant="ghost" onClick={() => onCancel(r.id)}>Annuler</Button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Payments ---------------- */
function Payments({ payments }) {
  const total = payments.reduce((a, p) => a + Number(p.montant), 0);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: PALETTE.brandDark }}>Paiements</h1>
        <p className="text-sm" style={{ color: PALETTE.inkSoft }}>Suivi financier des séjours.</p>
      </div>
      <StatCard label="Total encaissé" value={fmtFCFA(total)} accent={PALETTE.brand} />
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.paperRaised }}>
        <table className="w-full text-sm">
          <thead><tr style={{ background: PALETTE.paper, color: PALETTE.inkSoft }}>
            <th className="text-left font-medium px-3 py-2">Date</th><th className="text-left font-medium px-3 py-2">Client</th>
            <th className="text-left font-medium px-3 py-2">Chambre</th><th className="text-left font-medium px-3 py-2">Mode</th>
            <th className="text-right font-medium px-3 py-2">Montant</th>
          </tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${PALETTE.line}` }}>
                <td className="px-3 py-2">{new Date(p.date_paiement).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2">{p.client_nom ? `${p.client_nom} ${p.client_prenoms}` : "—"}</td>
                <td className="px-3 py-2">{p.chambre_numero || "—"}</td>
                <td className="px-3 py-2">{p.mode_paiement}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtFCFA(p.montant)}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center" style={{ color: PALETTE.inkSoft }}>Aucun paiement enregistré.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Notifications ---------------- */
function NotificationsView({ notifications, onRetry }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: PALETTE.brandDark }}>Notifications WhatsApp</h1>
        <p className="text-sm" style={{ color: PALETTE.inkSoft }}>Journal réel des envois au gérant, avec statut et relance en cas d'échec.</p>
      </div>
      <div className="flex flex-col gap-3">
        {notifications.length === 0 && <div className="text-sm" style={{ color: PALETTE.inkSoft }}>Aucune notification pour le moment.</div>}
        {notifications.map((n) => (
          <div key={n.id} className="rounded-2xl p-4" style={{ background: n.statut === "envoyee" ? "#DCF8C6" : "#FBE7E7", border: `1px solid ${n.statut === "envoyee" ? "#BEE9A0" : "#F3C9C9"}` }}>
            <div className="flex justify-between items-start mb-1">
              <div className="text-[11px]" style={{ color: n.statut === "envoyee" ? "#3E6B1F" : "#8A2C2C" }}>{new Date(n.created_at).toLocaleString("fr-FR")} · {n.type} · {n.statut}</div>
              {n.statut === "echec" && <Button variant="ghost" onClick={() => onRetry(n.id)}>Réessayer</Button>}
            </div>
            <pre className="whitespace-pre-wrap text-sm" style={{ fontFamily: "var(--font-body)", color: "#213319" }}>{n.message}</pre>
            {n.erreur && <div className="text-xs mt-1" style={{ color: "#8A2C2C" }}>Erreur : {n.erreur}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsView({ settings, onSave }) {
  const [number, setNumber] = useState(settings.manager_whatsapp || "");
  return (
    <div className="flex flex-col gap-4 max-w-md">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: PALETTE.brandDark }}>Paramètres</h1>
        <p className="text-sm" style={{ color: PALETTE.inkSoft }}>Configuration des notifications.</p>
      </div>
      <Field label="Numéro WhatsApp du gérant" required><Input value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
      <Button onClick={() => onSave({ manager_whatsapp: number })}>Enregistrer</Button>
      <div className="text-xs rounded-xl p-3" style={{ background: PALETTE.brandSoft, color: PALETTE.brandDark }}>
        Les identifiants de l'API WhatsApp Business (token, phone_number_id) se configurent dans le fichier <code>.env</code> du backend — jamais ici.
      </div>
    </div>
  );
}

/* ---------------- Modals ---------------- */
function CheckInModal({ room, rooms, onClose, onSubmit }) {
  const availableRooms = rooms.filter((r) => r.statut === "libre" || r.id === room?.id);
  const [form, setForm] = useState({
    nom: "", prenoms: "", sexe: "M", telephone: "", whatsapp: "", type_piece: "CNI", numero_piece: "",
    chambre_id: room?.id || availableRooms[0]?.id || "",
    date_entree: todayStr(), heure_entree: nowTime(), date_sortie_prevue: todayStr(), heure_sortie_prevue: "12:00",
    nb_personnes: 1, mode_paiement: "Espèces", avance: 0,
  });
  const selectedRoom = rooms.find((r) => r.id === Number(form.chambre_id));
  const nights = selectedRoom ? nightsBetween(form.date_entree, form.date_sortie_prevue) : 0;
  const montant = selectedRoom ? nights * Number(selectedRoom.prix_nuit) : 0;
  const valid = form.nom && form.prenoms && form.telephone && form.numero_piece && form.chambre_id;

  const submit = () => onSubmit({
    client: { nom: form.nom, prenoms: form.prenoms, sexe: form.sexe, telephone: form.telephone, whatsapp: form.whatsapp, type_piece: form.type_piece, numero_piece: form.numero_piece },
    chambre_id: Number(form.chambre_id),
    date_entree: form.date_entree, heure_entree: form.heure_entree,
    date_sortie_prevue: form.date_sortie_prevue, heure_sortie_prevue: form.heure_sortie_prevue,
    nb_personnes: Number(form.nb_personnes), avance: Number(form.avance), mode_paiement: form.mode_paiement,
  });

  return (
    <Modal title="Enregistrement — Check-in" onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nom" required><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
        <Field label="Prénoms" required><Input value={form.prenoms} onChange={(e) => setForm({ ...form, prenoms: e.target.value })} /></Field>
        <Field label="Sexe"><Select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}><option value="M">Masculin</option><option value="F">Féminin</option></Select></Field>
        <Field label="Téléphone" required><Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+225…" /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="identique si vide" /></Field>
        <Field label="Type de pièce"><Select value={form.type_piece} onChange={(e) => setForm({ ...form, type_piece: e.target.value })}>
          <option value="CNI">Carte nationale d'identité</option><option value="Passeport">Passeport</option><option value="Permis">Permis de conduire</option><option value="Autre">Autre</option>
        </Select></Field>
        <Field label="Numéro de pièce" required><Input value={form.numero_piece} onChange={(e) => setForm({ ...form, numero_piece: e.target.value })} /></Field>
        <Field label="Chambre" required>
          <Select value={form.chambre_id} onChange={(e) => setForm({ ...form, chambre_id: e.target.value })}>
            {availableRooms.map((r) => <option key={r.id} value={r.id}>Chambre {r.numero} — {r.type} — {fmtFCFA(r.prix_nuit)}/nuit</option>)}
          </Select>
        </Field>
        <Field label="Nombre de personnes"><Input type="number" min={1} value={form.nb_personnes} onChange={(e) => setForm({ ...form, nb_personnes: e.target.value })} /></Field>
        <Field label="Date d'arrivée"><Input type="date" value={form.date_entree} onChange={(e) => setForm({ ...form, date_entree: e.target.value })} /></Field>
        <Field label="Heure d'entrée"><Input type="time" value={form.heure_entree} onChange={(e) => setForm({ ...form, heure_entree: e.target.value })} /></Field>
        <Field label="Date de sortie prévue"><Input type="date" value={form.date_sortie_prevue} onChange={(e) => setForm({ ...form, date_sortie_prevue: e.target.value })} /></Field>
        <Field label="Heure de sortie prévue"><Input type="time" value={form.heure_sortie_prevue} onChange={(e) => setForm({ ...form, heure_sortie_prevue: e.target.value })} /></Field>
        <Field label="Mode de paiement"><Select value={form.mode_paiement} onChange={(e) => setForm({ ...form, mode_paiement: e.target.value })}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Avance versée (FCFA)"><Input type="number" min={0} value={form.avance} onChange={(e) => setForm({ ...form, avance: e.target.value })} /></Field>
      </div>
      <div className="mt-3 rounded-xl p-3 text-sm flex justify-between" style={{ background: PALETTE.brandSoft }}>
        <span>{nights} nuit(s) — {fmtFCFA(selectedRoom?.prix_nuit || 0)}/nuit</span>
        <strong>Total : {fmtFCFA(montant)}</strong>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button disabled={!valid} onClick={submit}>Valider le check-in</Button>
      </div>
    </Modal>
  );
}

function CheckOutModal({ stay, onClose, onSubmit }) {
  const [montantSupp, setMontantSupp] = useState(0);
  const soldeApres = Number(stay.solde) - Number(montantSupp || 0);
  return (
    <Modal title={`Check-out — Chambre ${stay.chambre_numero}`} onClose={onClose}>
      <div className="text-sm mb-3" style={{ color: PALETTE.inkSoft }}>
        Client : <strong style={{ color: PALETTE.ink }}>{stay.client_nom} {stay.client_prenoms}</strong><br />
        Montant total : {fmtFCFA(stay.montant_total)} · Déjà payé : {fmtFCFA(stay.montant_paye)}<br />
        Solde actuel : <strong style={{ color: Number(stay.solde) > 0 ? "#D64545" : "#2F9E63" }}>{fmtFCFA(stay.solde)}</strong>
      </div>
      <Field label="Paiement complémentaire au départ (FCFA)"><Input type="number" min={0} value={montantSupp} onChange={(e) => setMontantSupp(e.target.value)} /></Field>
      <div className="mt-2 text-sm">Solde après paiement : <strong style={{ color: soldeApres > 0 ? "#D64545" : "#2F9E63" }}>{fmtFCFA(soldeApres)}</strong></div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button variant="danger" onClick={() => onSubmit(stay.id, { montant_supplementaire: Number(montantSupp) })}>Valider le check-out</Button>
      </div>
    </Modal>
  );
}

function ExtendModal({ stay, onClose, onSubmit }) {
  const [date, setDate] = useState(stay.date_sortie_prevue?.slice(0, 10));
  const [heure, setHeure] = useState(stay.heure_sortie_prevue);
  const [paiement, setPaiement] = useState(0);
  const nights = nightsBetween(stay.date_entree, date);
  const supp = nights * (Number(stay.montant_total) / nightsBetween(stay.date_entree, stay.date_sortie_prevue)) - Number(stay.montant_total);
  return (
    <Modal title={`Prolonger le séjour — Chambre ${stay.chambre_numero}`} onClose={onClose}>
      <Field label="Nouvelle date de sortie"><Input type="date" min={stay.date_sortie_prevue?.slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="h-2" />
      <Field label="Nouvelle heure de sortie"><Input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} /></Field>
      <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: PALETTE.ochreSoft }}>Montant supplémentaire estimé : <strong>{fmtFCFA(Math.max(0, supp))}</strong></div>
      <Field label="Paiement complémentaire encaissé (FCFA)"><Input type="number" min={0} value={paiement} onChange={(e) => setPaiement(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button onClick={() => onSubmit(stay.id, { nouvelle_date_sortie: date, nouvelle_heure_sortie: heure, paiement_supplementaire: Number(paiement) })}>Confirmer la prolongation</Button>
      </div>
    </Modal>
  );
}

function PayModal({ stay, onClose, onSubmit }) {
  const [montant, setMontant] = useState(Math.max(0, Number(stay.solde)));
  const [mode, setMode] = useState("Espèces");
  return (
    <Modal title="Enregistrer un paiement" onClose={onClose}>
      <div className="text-sm mb-3" style={{ color: PALETTE.inkSoft }}>Solde actuel : <strong style={{ color: PALETTE.ink }}>{fmtFCFA(stay.solde)}</strong></div>
      <Field label="Montant (FCFA)"><Input type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} /></Field>
      <div className="h-2" />
      <Field label="Mode de paiement"><Select value={mode} onChange={(e) => setMode(e.target.value)}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</Select></Field>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button disabled={!(Number(montant) > 0)} onClick={() => onSubmit({ sejour_id: stay.id, montant: Number(montant), mode_paiement: mode })}>Enregistrer</Button>
      </div>
    </Modal>
  );
}

function MaintenanceModal({ room, onClose, onSubmit }) {
  const [note, setNote] = useState("");
  return (
    <Modal title={`Signaler une anomalie — Chambre ${room?.numero}`} onClose={onClose}>
      <Field label="Description de la panne" required><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} style={inputStyle} /></Field>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button variant="danger" disabled={!note} onClick={() => onSubmit(room.id, note)}>Mettre en maintenance</Button>
      </div>
    </Modal>
  );
}

function ReservationModal({ rooms, onClose, onSubmit }) {
  const [form, setForm] = useState({ nom_client: "", telephone: "", chambre_id: rooms[0]?.id || "", date_arrivee: todayStr(), date_depart: todayStr(), montant: 0, avance: 0 });
  const valid = form.nom_client && form.chambre_id;
  return (
    <Modal title="Nouvelle réservation" onClose={onClose}>
      <Field label="Nom du client" required><Input value={form.nom_client} onChange={(e) => setForm({ ...form, nom_client: e.target.value })} /></Field>
      <div className="h-2" />
      <Field label="Téléphone"><Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></Field>
      <div className="h-2" />
      <Field label="Chambre" required>
        <Select value={form.chambre_id} onChange={(e) => setForm({ ...form, chambre_id: e.target.value })}>
          {rooms.length === 0 && <option value="">Aucune chambre libre</option>}
          {rooms.map((r) => <option key={r.id} value={r.id}>Chambre {r.numero} — {r.type}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <Field label="Arrivée prévue"><Input type="date" value={form.date_arrivee} onChange={(e) => setForm({ ...form, date_arrivee: e.target.value })} /></Field>
        <Field label="Départ prévu"><Input type="date" value={form.date_depart} onChange={(e) => setForm({ ...form, date_depart: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <Field label="Montant (FCFA)"><Input type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} /></Field>
        <Field label="Avance (FCFA)"><Input type="number" value={form.avance} onChange={(e) => setForm({ ...form, avance: e.target.value })} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="subtle" onClick={onClose}>Annuler</Button>
        <Button disabled={!valid} onClick={() => onSubmit({ ...form, chambre_id: Number(form.chambre_id), montant: Number(form.montant), avance: Number(form.avance) })}>Créer la réservation</Button>
      </div>
    </Modal>
  );
}
