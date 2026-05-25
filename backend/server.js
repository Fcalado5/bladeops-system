require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { pool } = require('./config/database');

const authRoutes          = require('./routes/auth.routes');
const pilotsRoutes        = require('./routes/pilots.routes');
const aircraftRoutes      = require('./routes/aircraft.routes');
const destinationsRoutes  = require('./routes/destinations.routes');
const dayOperationsRoutes = require('./routes/dayOperations.routes');
const tripsRoutes         = require('./routes/trips.routes');
const flightsRoutes       = require('./routes/flights.routes');   // ← ADICIONADO
const exportRoutes        = require('./routes/export.routes');
const alertsRoutes        = require('./routes/alerts.routes');
const editLogsRoutes      = require('./routes/editLogs.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

const storageDir = path.join(__dirname, '../storage/reports');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = [
  'https://bladeops-frontend.vercel.app',
  'https://bladeops-frontend-git-main-fernando-calado-s-projects.vercel.app',
  'https://bladeops-frontend-2qybnhxg1-fernando-calado-s-projects.vercel.app',
  'https://bladeops.ao',
  'https://app.bladeops.ao'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/auth',           authRoutes);
app.use('/api/pilots',         pilotsRoutes);
app.use('/api/aircraft',       aircraftRoutes);
app.use('/api/destinations',   destinationsRoutes);
app.use('/api/day-operations', dayOperationsRoutes);
app.use('/api/trips',          tripsRoutes);
app.use('/api/flights',        flightsRoutes);        // ← ADICIONADO
app.use('/api/export',         exportRoutes);
app.use('/api/alerts',         alertsRoutes);
app.use('/api/edit-logs',      editLogsRoutes);

app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const indexPath = path.join(__dirname, '../frontend/build/index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  if (process.env.NODE_ENV === 'development') console.error(err.stack);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 BladeOps running on port ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   API: http://localhost:${PORT}/api\n`);
});

module.exports = app;