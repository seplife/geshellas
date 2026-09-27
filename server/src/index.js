require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const roomsRoutes = require('./routes/rooms');
const staysRoutes = require('./routes/stays');
const reservationsRoutes = require('./routes/reservations');
const clientsRoutes = require('./routes/clients');
const paymentsRoutes = require('./routes/payments');
const notificationsRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');
const usersRoutes = require('./routes/users');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/stays', staysRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Une erreur inattendue est survenue !' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
