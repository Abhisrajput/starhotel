import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRouter from './modules/auth/auth.controller';
import roomsRouter from './modules/rooms/rooms.controller';
import bookingsRouter from './modules/bookings/bookings.controller';
import adminRouter from './modules/admin/admin.controller';
import reportsRouter from './modules/reports/reports.controller';
import { initDashboardGateway } from './modules/dashboard/dashboard.gateway';
import { AppError } from './shared/errors';
import logger from './shared/logger';
import prisma from './shared/database';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Request');
  next();
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reports', reportsRouter);

// Dashboard status endpoint (separate from rooms for clarity)
app.get('/api/dashboard/status', async (req, res, next) => {
  try {
    const { roomsService } = await import('./modules/rooms/rooms.service');
    const status = await roomsService.getDashboardStatus();
    res.json(status);
  } catch (err) { next(err); }
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
  } else {
    logger.error(err, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// Init Socket.IO for real-time dashboard — BR-15
initDashboardGateway(httpServer);

const PORT = parseInt(process.env.PORT || '3001', 10);

async function start() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    httpServer.listen(PORT, () => {
      logger.info(`Star Hotel Backend running on http://localhost:${PORT}`);
      logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

start();

export default app;