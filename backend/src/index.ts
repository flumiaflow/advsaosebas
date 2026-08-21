// BigInt JSON serialization support
(BigInt.prototype as any).toJSON = function () {
  const int = Number(this);
  return int ?? this.toString();
};

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connectRedis } from './config/redis';
import passport from './config/passport';
import { startScheduler } from './services/sync/scheduler';
import { startLifecycleJobs } from './services/lifecycle';
import { initSocketIO } from './socket';
import authRoutes from './routes/authRoutes';
import tenantRoutes from './routes/tenantRoutes';
import clientRoutes from './routes/clientRoutes';
import establishmentRoutes from './routes/establishmentRoutes';
import syncRoutes from './routes/syncRoutes';
import processRoutes from './routes/processRoutes';
import notificationRoutes from './routes/notificationRoutes';
import auditRoutes from './routes/auditRoutes';
import userRoutes from './routes/userRoutes';
import syncConfigRoutes from './routes/syncConfigRoutes';
import exportRoutes from './routes/exportRoutes';
import importRoutes from './routes/importRoutes';
import webhookRoutes from './routes/webhookRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import settingsRoutes from './routes/settingsRoutes';
import systemSettingsRoutes from './routes/systemSettingsRoutes';
import partyRoutes from './routes/partyRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://juriswatch.31.97.83.42.sslip.io',
  'http://juriswatch.31.97.83.42.sslip.io'
];
const envOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : [];
const allowedOrigins = [...defaultOrigins, ...envOrigins];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.includes('sslip.io') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in initial production rollout
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/backoffice/tenants', tenantRoutes);
app.use('/api/backoffice/settings', systemSettingsRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/establishments', establishmentRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/sync/config', syncConfigRoutes);
app.use('/api/processes', processRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', userRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

async function bootstrap() {
  try {
    // Connect to Redis
    await connectRedis();
    console.log('✅ Connected to Redis successfully');

    // Start background crons
    startScheduler();
    startLifecycleJobs();

    // Start server on 0.0.0.0
    const host = process.env.HOST || '0.0.0.0';
    const server = app.listen(PORT as number, host, () => {
      console.log(`🚀 JurisWatch API is running on http://${host}:${PORT}`);
    });

    // Initialize WebSockets
    initSocketIO(server);
  } catch (error) {
    console.error('❌ Failed to bootstrap the application:', error);
    process.exit(1);
  }
}

bootstrap();
