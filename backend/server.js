require('dotenv').config();
const express = require('express');
const cors = require('cors');
let compression;
try { compression = require('compression'); } catch (e) {}
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { seedUsers } = require('./controllers/authController');

const app = express();
const PORT = process.env.PORT || 5060;

app.set('trust proxy', 1);
app.disable('x-powered-by');

if (compression) {
  app.use(compression());
}
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/user', require('./routes/userWarehouseRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/dealers', require('./routes/dealerRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/dispatches', require('./routes/dispatchRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/reports', require('./routes/reportsRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));

app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'OK',
    application: 'Vaniki Stock Trace - Warehouse WMS API',
    database: dbStates[mongoose.connection.readyState] || 'unknown',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date()
  });
});

app.use(notFound);
app.use(errorHandler);

// Start listening only once the database is reachable, so the app never serves
// requests that are guaranteed to fail.
const start = async () => {
  await connectDB();
  await seedUsers().catch(err => console.error('[Auth Seed] failed:', err.message));

  const server = app.listen(PORT, () => {
    console.log('----------------------------------------------------');
    console.log(`Vaniki Stock Trace API listening on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log('----------------------------------------------------');
  });

  // Start automatic 2-way background Tally sync worker
  try {
    const { startTallyCron } = require('./services/tallyCronService');
    startTallyCron();
  } catch (err) {
    console.warn('[Tally Cron Worker] Failed to initialize:', err.message);
  }

  const shutdown = (signal) => async () => {
    console.log(`[Server] ${signal} received, shutting down.`);
    server.close(() => mongoose.connection.close(false).then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));
};

process.on('unhandledRejection', (err) => console.error('[UnhandledRejection]', err));

start().catch((err) => {
  console.error('[Server] Startup aborted:', err.message);
  process.exit(1);
});

module.exports = app;
