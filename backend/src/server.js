import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import roomsRoutes from "./routes/rooms.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import staysRoutes from "./routes/stays.routes.js";
import reservationsRoutes from "./routes/reservations.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import usersRoutes from "./routes/users.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { startAlertScheduler } from "./jobs/alertScheduler.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true, service: "hellas-hotel-manager-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/stays", staysRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/users", usersRoutes);

app.use((req, res) => res.status(404).json({ error: "Route introuvable." }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Hellas Hôtel Manager API en écoute sur le port ${PORT}`);
  if (process.env.NODE_ENV !== "test") {
    startAlertScheduler();
  }
});

export default app;
