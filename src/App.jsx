import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { useToast } from "./context/ToastContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import Topbar from "./components/layout/Topbar.jsx";
import Spinner from "./components/ui/Spinner.jsx";
import ConfirmModal from "./components/ui/ConfirmModal.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RoomsPage from "./pages/RoomsPage.jsx";
import PassagesPage from "./pages/PassagesPage.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import ReservationsPage from "./pages/ReservationsPage.jsx";
import PaymentsPage from "./pages/PaymentsPage.jsx";
import FinancialReportPage from "./pages/FinancialReportPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import CheckInModal from "./pages/modals/CheckInModal.jsx";
import PassageModal from "./pages/modals/PassageModal.jsx";
import CheckOutModal from "./pages/modals/CheckOutModal.jsx";
import ExtendModal from "./pages/modals/ExtendModal.jsx";
import ExtendPassageModal from "./pages/modals/ExtendPassageModal.jsx";
import PayModal from "./pages/modals/PayModal.jsx";
import MaintenanceModal from "./pages/modals/MaintenanceModal.jsx";
import ReservationModal from "./pages/modals/ReservationModal.jsx";
import NewUserModal from "./pages/modals/NewUserModal.jsx";
import RoomFormModal from "./pages/modals/RoomFormModal.jsx";
import ClientDetailModal from "./pages/modals/ClientDetailModal.jsx";

import { NAV_BY_ROLE, NAV_ITEMS } from "./constants.js";
import { todayStr } from "./lib/format.js";
import { getDashboard } from "./services/dashboard.js";
import {
  listRooms,
  validerNettoyage,
  signalerAnomalie,
  subscribeHotel,
  createRoom,
  updateRoom,
  deleteRoom,
} from "./services/rooms.js";
import { listClients } from "./services/clients.js";
import {
  listStays,
  listPassages,
  createPassage,
  extendPassage,
  checkIn,
  checkOut,
  extendStay,
} from "./services/stays.js";
import {
  listReservations,
  createReservation,
  cancelReservation,
  markReservationAbsent,
} from "./services/reservations.js";
import { listPayments, recordPayment } from "./services/payments.js";
import { getMonthlyFinancialReport } from "./services/reports.js";
import { listNotifications, retryNotification } from "./services/notifications.js";
import { getSettings, updateSettings } from "./services/settings.js";
import { listUsers, createUser, setUserActive, setUserRole } from "./services/users.js";

/** Données nécessaires à chaque onglet. */
const TAB_RESOURCES = {
  dashboard: ["dashboard"],
  rooms: ["rooms", "stays", "reservations"],
  passages: ["passages", "rooms"],
  reservations: ["reservations", "rooms"],
  clients: ["clients"],
  payments: ["payments"],
  reports: ["reports"],
  notifications: ["notifications"],
  users: ["users"],
  settings: ["settings"],
};

function initialTab() {
  const hash = window.location.hash.replace("#", "");
  return NAV_ITEMS.some((i) => i.key === hash) ? hash : "dashboard";
}

export default function App() {
  const { session, profile, loading, logout } = useAuth();
  const { showToast, showError } = useToast();

  const now = new Date();
  const [tab, setTabState] = useState(initialTab);
  const [navOpen, setNavOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(0);
  const [live, setLive] = useState(false);
  const [reportPeriod, setReportPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const params = useRef({
    clients: "",
    paymentsSince: null,
    paymentsPeriod: "tout",
    reportYear: now.getFullYear(),
    reportMonth: now.getMonth() + 1,
  });
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const role = profile?.role;

  const setTab = useCallback((t) => {
    setTabState(t);
    window.history.replaceState(null, "", `#${t}`);
  }, []);

  // Onglet non autorisé pour ce rôle → premier onglet autorisé.
  useEffect(() => {
    if (role && !NAV_BY_ROLE[role]?.includes(tab)) setTab(NAV_BY_ROLE[role][0]);
  }, [role, tab, setTab]);

  const fetchers = useRef({
    dashboard: () => getDashboard(),
    rooms: () => listRooms(),
    stays: () => listStays({ statut: "en_cours" }),
    passages: () => listPassages(),
    reservations: () => listReservations(),
    clients: () => listClients(params.current.clients),
    payments: () => listPayments({ since: params.current.paymentsSince }),
    reports: () =>
      getMonthlyFinancialReport({
        year: params.current.reportYear,
        month: params.current.reportMonth,
      }),
    notifications: () => listNotifications(),
    users: () => listUsers(),
    settings: () => getSettings(),
  });

  const load = useCallback(async (key) => {
    setPending((n) => n + 1);
    try {
      const value = await fetchers.current[key]();
      setData((d) => ({ ...d, [key]: value }));
      setErrors((e) => ({ ...e, [key]: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: err.message }));
    } finally {
      setPending((n) => n - 1);
    }
  }, []);

  const reloadTab = useCallback(
    (t = tabRef.current) => Promise.all((TAB_RESOURCES[t] || []).map(load)),
    [load]
  );

  // Chargement à l'ouverture d'un onglet (+ tableau de bord pour les badges).
  useEffect(() => {
    if (!profile) return;
    reloadTab(tab);
    if (tab !== "dashboard") load("dashboard");
  }, [tab, profile, reloadTab, load]);

  // Temps réel : un changement fait depuis un autre poste recharge l'onglet affiché.
  useEffect(() => {
    if (!profile) return undefined;
    let timer = null;
    const unsubscribe = subscribeHotel(
      () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          reloadTab();
          if (tabRef.current !== "dashboard") load("dashboard");
        }, 400);
      },
      setLive
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [profile, reloadTab, load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Chargement de la session…" />
      </div>
    );
  }

  if (!session || !profile) return <LoginPage />;

  const canSee = (t) => NAV_BY_ROLE[role]?.includes(t);
  const closeModal = () => setModal(null);

  /** Exécute une action, affiche le résultat et rafraîchit les données visibles. */
  const runAction = async (fn, successMsg) => {
    setSubmitting(true);
    try {
      await fn();
      if (successMsg) showToast(successMsg);
      setModal(null);
      reloadTab();
      if (tab !== "dashboard") load("dashboard");
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const confirm = (title, message, action, successMsg, opts = {}) =>
    setModal({ type: "confirm", title, message, action, successMsg, ...opts });

  const dashboard = data.dashboard;
  const activePassagesCount = (data.passages || []).filter(
    (p) => p.statut === "en_cours"
  ).length;
  const badges = {
    reservations: dashboard?.arrivees_prevues?.length || 0,
    passages: activePassagesCount,
  };
  const errorFor = (...keys) => keys.map((k) => errors[k]).find(Boolean);

  return (
    <div className="w-full min-h-screen flex">
      <Sidebar
        role={role}
        tab={tab}
        onSelect={setTab}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        live={live}
        badges={badges}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          profile={profile}
          onOpenNav={() => setNavOpen(true)}
          onLogout={logout}
          onRefresh={() => reloadTab()}
          refreshing={pending > 0}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {tab === "dashboard" && canSee("dashboard") && (
            <DashboardPage
              dashboard={dashboard}
              error={errors.dashboard}
              onRetry={() => load("dashboard")}
              role={role}
              onNavigate={setTab}
            />
          )}
          {tab === "rooms" && canSee("rooms") && (
            <RoomsPage
              rooms={data.rooms}
              activeStays={data.stays || []}
              error={errorFor("rooms", "stays")}
              onRetry={() => reloadTab("rooms")}
              role={role}
              onCheckIn={(room) => {
                const today = todayStr();
                const reservation =
                  room.statut === "reservee"
                    ? data.reservations?.find(
                        (r) =>
                          r.chambre_id === room.id &&
                          ["en_attente", "confirmee"].includes(r.statut) &&
                          r.date_arrivee <= today &&
                          r.date_depart > today
                      )
                    : undefined;
                setModal({ type: "checkin", room, reservation });
              }}
              onPassage={(room) => setModal({ type: "passage", room })}
              onCheckOut={(stay) => setModal({ type: "checkout", stay })}
              onExtend={(stay) =>
                setModal({
                  type: stay.type_sejour === "passage" ? "extend-passage" : "extend",
                  stay,
                })
              }
              onPay={(stay) => setModal({ type: "pay", stay })}
              onClean={(room) =>
                runAction(
                  () => validerNettoyage(room.id),
                  `Chambre ${room.numero} remise en service.`
                )
              }
              onMaintenance={(room) => setModal({ type: "maintenance", room })}
              onCreateRoom={() => setModal({ type: "room" })}
              onEditRoom={(room) => setModal({ type: "room", room })}
              onDeleteRoom={(room) =>
                confirm(
                  `Supprimer la chambre ${room.numero} ?`,
                  `La chambre ${room.numero} (${room.type}) sera définitivement supprimée.`,
                  () => deleteRoom(room.id),
                  `Chambre ${room.numero} supprimée.`,
                  { danger: true, confirmLabel: "Supprimer la chambre" }
                )
              }
            />
          )}
          {tab === "passages" && canSee("passages") && (
            <PassagesPage
              passages={data.passages}
              rooms={data.rooms || []}
              error={errorFor("passages", "rooms")}
              onRetry={() => reloadTab("passages")}
              role={role}
              onNewPassage={(room) => setModal({ type: "passage", room })}
              onExtendPassage={(stay) => setModal({ type: "extend-passage", stay })}
              onPayPassage={(stay) => setModal({ type: "pay", stay })}
              onCheckOutPassage={(stay) => setModal({ type: "checkout", stay })}
            />
          )}
          {tab === "reservations" && canSee("reservations") && (
            <ReservationsPage
              reservations={data.reservations}
              error={errors.reservations}
              onRetry={() => load("reservations")}
              role={role}
              onCreate={() => setModal({ type: "reservation" })}
              onCheckIn={(r) => {
                const room = data.rooms?.find((x) => x.id === r.chambre_id);
                if (room) setModal({ type: "checkin", room, reservation: r });
              }}
              onCancel={(r) =>
                confirm(
                  "Annuler la réservation ?",
                  `La réservation de ${r.nom_client} (chambre ${r.chambre_numero}) sera annulée. L'avance éventuellement versée reste enregistrée dans les paiements.`,
                  () => cancelReservation(r.id),
                  "Réservation annulée.",
                  { danger: true, confirmLabel: "Annuler la réservation" }
                )
              }
              onNoShow={(r) =>
                confirm(
                  "Marquer le client absent ?",
                  `${r.nom_client} ne s'est pas présenté. La chambre ${r.chambre_numero} sera libérée.`,
                  () => markReservationAbsent(r.id),
                  "Réservation marquée « client absent »."
                )
              }
            />
          )}
          {tab === "clients" && canSee("clients") && (
            <ClientsPage
              clients={data.clients}
              error={errors.clients}
              onRetry={() => load("clients")}
              initialQuery={params.current.clients}
              onSearch={(q) => {
                params.current.clients = q;
                load("clients");
              }}
              onOpen={(c) => setModal({ type: "client", client: c })}
            />
          )}
          {tab === "payments" && canSee("payments") && (
            <PaymentsPage
              payments={data.payments}
              error={errors.payments}
              onRetry={() => load("payments")}
              initialPeriod={params.current.paymentsPeriod}
              onPeriod={(since, key) => {
                params.current.paymentsSince = since;
                params.current.paymentsPeriod = key;
                load("payments");
              }}
            />
          )}
          {tab === "reports" && canSee("reports") && (
            <FinancialReportPage
              report={data.reports}
              error={errors.reports}
              onRetry={() => load("reports")}
              selectedYear={reportPeriod.year}
              selectedMonth={reportPeriod.month}
              onChangePeriod={(year, month) => {
                params.current.reportYear = year;
                params.current.reportMonth = month;
                setReportPeriod({ year, month });
                load("reports");
              }}
            />
          )}
          {tab === "notifications" && canSee("notifications") && (
            <NotificationsPage
              notifications={data.notifications}
              error={errors.notifications}
              onRetry={() => load("notifications")}
              role={role}
              onResend={(id) =>
                runAction(() => retryNotification(id), "Notification renvoyée.")
              }
            />
          )}
          {tab === "users" && canSee("users") && (
            <UsersPage
              users={data.users}
              error={errors.users}
              onRetry={() => load("users")}
              currentUserId={session.user.id}
              onCreate={() => setModal({ type: "user" })}
              onToggleActive={(u) =>
                u.actif
                  ? confirm(
                      "Désactiver ce compte ?",
                      `${u.nom} ${u.prenoms} ne pourra plus se connecter tant que le compte ne sera pas réactivé.`,
                      () => setUserActive(u.id, false),
                      "Compte désactivé.",
                      { danger: true, confirmLabel: "Désactiver" }
                    )
                  : runAction(() => setUserActive(u.id, true), "Compte activé.")
              }
              onChangeRole={(id, newRole) =>
                runAction(() => setUserRole(id, newRole), "Rôle mis à jour.")
              }
            />
          )}
          {tab === "settings" && canSee("settings") && (
            <SettingsPage
              settings={data.settings}
              error={errors.settings}
              onRetry={() => load("settings")}
              submitting={submitting}
              onSave={(v) =>
                runAction(() => updateSettings(v), "Paramètres enregistrés.")
              }
            />
          )}
        </main>
      </div>

      {modal?.type === "checkin" && (
        <CheckInModal
          room={modal.room}
          reservation={modal.reservation}
          rooms={data.rooms || []}
          submitting={submitting}
          onClose={closeModal}
          onSubmit={(payload) =>
            runAction(
              () => checkIn(payload),
              `Check-in enregistré — chambre ${modal.room?.numero || ""} occupée.`
            )
          }
        />
      )}
      {modal?.type === "passage" && (
        <PassageModal
          room={modal.room}
          rooms={data.rooms || []}
          submitting={submitting}
          onClose={closeModal}
          onSubmit={(payload) =>
            runAction(
              () => createPassage(payload),
              `Passage enregistré (${payload.duree_heures}h — ${
                payload.type_climatisation === "ventilee"
                  ? "Chambre ventilée 2 000 FCFA/h"
                  : "Chambre climatisée 2 500 FCFA/h"
              }).`
            )
          }
        />
      )}
      {modal?.type === "checkout" && (
        <CheckOutModal
          stay={modal.stay}
          submitting={submitting}
          onClose={closeModal}
          onSubmit={(id, payload) =>
            runAction(() => checkOut(id, payload), "Sortie enregistrée.")
          }
        />
      )}
      {modal?.type === "extend" && (
        <ExtendModal
          stay={modal.stay}
          submitting={submitting}
          onClose={closeModal}
          onSubmit={(id, payload) =>
            runAction(() => extendStay(id, payload), "Séjour prolongé.")
          }
        />
      )}
      {modal?.type === "extend-passage" && (
        <ExtendPassageModal
          stay={modal.stay}
          submitting={submitting}
          onClose={closeModal}
          onSubmit={(id, payload) =>
            runAction(
              () => extendPassage(id, payload),
              `Passage prolongé de +${payload.heures_supplementaires}h.`
            )
          }
        />
      )}
      {modal?.type === "pay" && (
        <PayModal
          stay={modal.stay}
          submitting={submitting}
          onClose={closeModal}
          onSubmit={(payload) =>
            runAction(() => recordPayment(payload), "Paiement enregistré.")
          }
        />
      )}
      {modal?.type === "maintenance" && (
        <MaintenanceModal
          room={modal.room}
          submitting={submitting}
          onClose={closeModal}
          onSubmit={(roomId, description) =>
            runAction(
              () => signalerAnomalie(roomId, description),
              "Anomalie signalée."
            )
          }
        />
      )}
      {modal?.type === "reservation" && (
        <ReservationModal
          rooms={data.rooms || []}
          submitting={submitting}
          onClose={closeModal}
          onSubmit={(payload) =>
            runAction(() => createReservation(payload), "Réservation créée.")
          }
        />
      )}
      {modal?.type === "user" && (
        <NewUserModal
          submitting={submitting}
          onClose={closeModal}
          onSubmit={(payload) =>
            runAction(() => createUser(payload), "Compte créé.")
          }
        />
      )}
      {modal?.type === "room" && (
        <RoomFormModal
          room={modal.room}
          submitting={submitting}
          onClose={closeModal}
          onSubmit={(values) =>
            runAction(
              () =>
                modal.room
                  ? updateRoom(modal.room.id, values)
                  : createRoom(values),
              modal.room ? "Chambre mise à jour." : "Chambre créée."
            )
          }
        />
      )}
      {modal?.type === "client" && (
        <ClientDetailModal client={modal.client} onClose={closeModal} />
      )}
      {modal?.type === "confirm" && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          danger={modal.danger}
          confirmLabel={modal.confirmLabel}
          submitting={submitting}
          onClose={closeModal}
          onConfirm={() => runAction(modal.action, modal.successMsg)}
        />
      )}
    </div>
  );
}
