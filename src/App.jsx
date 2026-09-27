import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { useToast } from "./context/ToastContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import Topbar from "./components/layout/Topbar.jsx";
import Spinner from "./components/ui/Spinner.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RoomsPage from "./pages/RoomsPage.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import ReservationsPage from "./pages/ReservationsPage.jsx";
import PaymentsPage from "./pages/PaymentsPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import CheckInModal from "./pages/modals/CheckInModal.jsx";
import CheckOutModal from "./pages/modals/CheckOutModal.jsx";
import ExtendModal from "./pages/modals/ExtendModal.jsx";
import PayModal from "./pages/modals/PayModal.jsx";
import MaintenanceModal from "./pages/modals/MaintenanceModal.jsx";
import ReservationModal from "./pages/modals/ReservationModal.jsx";
import NewUserModal from "./pages/modals/NewUserModal.jsx";

import { NAV_BY_ROLE } from "./constants.js";
import { getDashboard } from "./services/dashboard.js";
import { listRooms, validerNettoyage, signalerAnomalie, subscribeRooms } from "./services/rooms.js";
import { listClients } from "./services/clients.js";
import { listStays, checkIn, checkOut, extendStay } from "./services/stays.js";
import { listReservations, createReservation, cancelReservation } from "./services/reservations.js";
import { listPayments, recordPayment } from "./services/payments.js";
import { listNotifications, retryNotification } from "./services/notifications.js";
import { getSettings, updateSettings } from "./services/settings.js";
import { listUsers, createUser, setUserActive, setUserRole } from "./services/users.js";

export default function App() {
  const { session, profile, loading, logout } = useAuth();
  const { showToast, showError } = useToast();

  const [tab, setTab] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeStays, setActiveStays] = useState([]);
  const [clients, setClients] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);

  const role = profile?.role;

  useEffect(() => {
    if (role && !NAV_BY_ROLE[role]?.includes(tab)) setTab(NAV_BY_ROLE[role][0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const reloadDashboard = useCallback(() => getDashboard().then(setDashboard).catch(showError), [showError]);
  const reloadRooms = useCallback(() => listRooms().then(setRooms).catch(showError), [showError]);
  const reloadActiveStays = useCallback(() => listStays({ statut: "en_cours" }).then(setActiveStays).catch(showError), [showError]);
  const reloadClients = useCallback((q) => listClients(q).then(setClients).catch(showError), [showError]);
  const reloadReservations = useCallback(() => listReservations().then(setReservations).catch(showError), [showError]);
  const reloadPayments = useCallback(() => listPayments().then(setPayments).catch(showError), [showError]);
  const reloadNotifications = useCallback(() => listNotifications().then(setNotifications).catch(showError), [showError]);
  const reloadSettings = useCallback(() => getSettings().then(setSettings).catch(showError), [showError]);
  const reloadUsers = useCallback(() => listUsers().then(setUsers).catch(showError), [showError]);

  const reloadAll = useCallback(() => {
    reloadDashboard();
    reloadRooms();
    reloadActiveStays();
  }, [reloadDashboard, reloadRooms, reloadActiveStays]);

  // Chargement par onglet.
  useEffect(() => {
    if (!profile) return;
    if (tab === "dashboard") reloadDashboard();
    if (tab === "rooms") { reloadRooms(); reloadActiveStays(); }
    if (tab === "clients") reloadClients();
    if (tab === "reservations") { reloadReservations(); reloadRooms(); }
    if (tab === "payments") reloadPayments();
    if (tab === "notifications") reloadNotifications();
    if (tab === "settings") reloadSettings();
    if (tab === "users") reloadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile]);

  // Mise à jour temps réel des chambres (check-in/out effectués par un autre poste).
  useEffect(() => {
    if (!profile) return undefined;
    return subscribeRooms(() => {
      if (tab === "rooms") reloadRooms();
      if (tab === "dashboard") reloadDashboard();
    });
  }, [profile, tab, reloadRooms, reloadDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-brand-900">
        <Spinner label="Chargement de la session…" />
      </div>
    );
  }

  if (!session || !profile) {
    return <LoginPage />;
  }

  const canSee = (t) => NAV_BY_ROLE[role]?.includes(t);

  const runAction = async (fn, successMsg) => {
    setSubmitting(true);
    try {
      await fn();
      if (successMsg) showToast(successMsg);
      setModal(null);
      reloadAll();
      if (tab === "clients") reloadClients();
      if (tab === "reservations") reloadReservations();
      if (tab === "payments") reloadPayments();
      if (tab === "users") reloadUsers();
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex bg-stone-50 dark:bg-brand-900">
      <Sidebar role={role} tab={tab} onSelect={setTab} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar profile={profile} onOpenNav={() => setNavOpen(true)} onLogout={logout} />

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {tab === "dashboard" && canSee("dashboard") && <DashboardPage dashboard={dashboard} />}
          {tab === "rooms" && canSee("rooms") && (
            <RoomsPage
              rooms={rooms}
              role={role}
              activeStays={activeStays}
              onCheckIn={(room) => setModal({ type: "checkin", room })}
              onCheckOut={(stay) => setModal({ type: "checkout", stay })}
              onExtend={(stay) => setModal({ type: "extend", stay })}
              onPay={(stay) => setModal({ type: "pay", stay })}
              onClean={(roomId) => runAction(() => validerNettoyage(roomId), "Chambre remise en service.")}
              onMaintenance={(room) => setModal({ type: "maintenance", room })}
            />
          )}
          {tab === "clients" && canSee("clients") && <ClientsPage clients={clients} onSearch={reloadClients} />}
          {tab === "reservations" && canSee("reservations") && (
            <ReservationsPage
              reservations={reservations}
              onCreate={() => setModal({ type: "reservation" })}
              onCancel={(id) => runAction(() => cancelReservation(id), "Réservation annulée.")}
            />
          )}
          {tab === "payments" && canSee("payments") && <PaymentsPage payments={payments} />}
          {tab === "notifications" && canSee("notifications") && (
            <NotificationsPage
              notifications={notifications}
              onRetry={(id) => runAction(() => retryNotification(id), "Nouvelle tentative effectuée.")}
            />
          )}
          {tab === "users" && canSee("users") && (
            <UsersPage
              users={users}
              currentUserId={session.user.id}
              onCreate={() => setModal({ type: "user" })}
              onToggleActive={(id, actif) => runAction(() => setUserActive(id, actif), actif ? "Compte réactivé." : "Compte désactivé.")}
              onChangeRole={(id, role) => runAction(() => setUserRole(id, role), "Rôle mis à jour.")}
            />
          )}
          {tab === "settings" && canSee("settings") && settings && (
            <SettingsPage settings={settings} onSave={(v) => runAction(() => updateSettings(v), "Paramètres enregistrés.")} />
          )}
        </main>
      </div>

      {modal?.type === "checkin" && (
        <CheckInModal
          room={modal.room} rooms={rooms} submitting={submitting} onClose={() => setModal(null)}
          onSubmit={(payload) => runAction(() => checkIn(payload), `Check-in enregistré — chambre ${modal.room.numero} occupée.`)}
        />
      )}
      {modal?.type === "checkout" && (
        <CheckOutModal
          stay={modal.stay} submitting={submitting} onClose={() => setModal(null)}
          onSubmit={(id, payload) => runAction(() => checkOut(id, payload), "Check-out effectué.")}
        />
      )}
      {modal?.type === "extend" && (
        <ExtendModal
          stay={modal.stay} submitting={submitting} onClose={() => setModal(null)}
          onSubmit={(id, payload) => runAction(() => extendStay(id, payload), "Séjour prolongé.")}
        />
      )}
      {modal?.type === "pay" && (
        <PayModal
          stay={modal.stay} submitting={submitting} onClose={() => setModal(null)}
          onSubmit={(payload) => runAction(() => recordPayment(payload), "Paiement enregistré.")}
        />
      )}
      {modal?.type === "maintenance" && (
        <MaintenanceModal
          room={modal.room} submitting={submitting} onClose={() => setModal(null)}
          onSubmit={(roomId, description) => runAction(() => signalerAnomalie(roomId, description), "Anomalie signalée.")}
        />
      )}
      {modal?.type === "reservation" && (
        <ReservationModal
          rooms={rooms.filter((r) => r.statut === "libre")} submitting={submitting} onClose={() => setModal(null)}
          onSubmit={(payload) => runAction(() => createReservation(payload), "Réservation créée.")}
        />
      )}
      {modal?.type === "user" && (
        <NewUserModal
          submitting={submitting} onClose={() => setModal(null)}
          onSubmit={(payload) => runAction(() => createUser(payload), "Compte créé.")}
        />
      )}
    </div>
  );
}
