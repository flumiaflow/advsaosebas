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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/establishments', establishmentRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/sync/config', syncConfigRoutes);
app.use('/api/processes', processRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', userRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/webhooks', webhookRoutes);

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

    // Start server explicitly on IPv4 to fix Vite Proxy ECONNREFUSED
    const server = app.listen(PORT as number, '127.0.0.1', () => {
      console.log(`🚀 JurisWatch API is running on http://127.0.0.1:${PORT}`);
    });

    // Initialize WebSockets
    initSocketIO(server);
  } catch (error) {
    console.error('❌ Failed to bootstrap the application:', error);
    process.exit(1);
  }
}

bootstrap();
