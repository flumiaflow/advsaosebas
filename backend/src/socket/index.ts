import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, TokenPayload } from '../utils/jwt';
import { isTokenBlacklisted } from '../config/redis';

let io: Server;

export function initSocketIO(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: '*', // Customize in production
      methods: ['GET', 'POST']
    }
  });

  // Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const payload = verifyToken(token as string);

      const blacklisted = await isTokenBlacklisted(payload.jti);
      if (blacklisted) {
        return next(new Error('Authentication error: Token blacklisted'));
      }

      // Attach payload to socket
      (socket as any).user = payload;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as TokenPayload;
    
    // Join tenant room (for broadcasts to the whole office)
    if (user.tenantId) {
      socket.join(`tenant:${user.tenantId}`);
    }

    // Join specific user room (for targeted notifications)
    socket.join(`user:${user.userId}`);
    
    console.log(`[SOCKET] User ${user.userId} connected and joined rooms.`);

    socket.on('disconnect', () => {
      console.log(`[SOCKET] User ${user.userId} disconnected.`);
    });
  });

  console.log('✅ Socket.io initialized.');
}

// Helper to emit events from anywhere in the backend
export function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet.');
  }
  return io;
}
