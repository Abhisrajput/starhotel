import { Server as SocketServer, Socket } from 'socket.io';
import { Server } from 'http';
import { authService } from '../auth/auth.service';
import { roomsService } from '../rooms/rooms.service';
import logger from '../../shared/logger';

let io: SocketServer | null = null;

export function initDashboardGateway(httpServer: Server) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = authService.verifyToken(token);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = (socket as any).user;
    logger.info({ userId: user?.userId }, 'Dashboard client connected');

    // Send initial room status
    try {
      const status = await roomsService.getDashboardStatus();
      socket.emit('dashboard:status', status);
    } catch (err) {
      logger.error(err, 'Error fetching dashboard status');
    }

    socket.on('dashboard:refresh', async () => {
      try {
        const status = await roomsService.getDashboardStatus();
        socket.emit('dashboard:status', status);
      } catch (err) {
        logger.error(err, 'Error refreshing dashboard');
      }
    });

    socket.on('disconnect', () => {
      logger.info({ userId: user?.userId }, 'Dashboard client disconnected');
    });
  });

  return io;
}

/** Broadcast room status update to all connected dashboard clients */
export function broadcastRoomUpdate() {
  if (io) {
    roomsService.getDashboardStatus().then((status) => {
      io!.emit('dashboard:status', status);
    }).catch((err) => {
      logger.error(err, 'Error broadcasting room update');
    });
  }
}