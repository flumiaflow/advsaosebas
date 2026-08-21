import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';
import { isTokenBlacklisted } from '../config/redis';
import { prisma } from '../config/db';

// Extend the Express User type to match our TokenPayload
declare global {
  namespace Express {
    interface User {
      userId: string;
      tenantId: string | null;
      role: string;
      jti: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    // Check blacklist in Redis
    const blacklisted = await isTokenBlacklisted(payload.jti);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token is invalid (logged out)' });
    }

    // Check if tenant is active
    const isSuperAdmin = payload.role === 'super_admin' || (payload as any).originalRole === 'super_admin';
    if (payload.tenantId && !isSuperAdmin) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: payload.tenantId }
      });

      if (!tenant) {
        return res.status(401).json({ error: 'Tenant not found' });
      }

      if (tenant.status === 'suspended') {
        return res.status(402).json({ error: 'Escritório suspenso. Entre em contato com o suporte.' });
      }

      if (tenant.status === 'cancelled') {
        return res.status(403).json({ error: 'Escritório cancelado.' });
      }
    }

    req.user = payload as Express.User;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function superAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  const isSuperAdmin = req.user?.role === 'super_admin' || (req.user as any)?.originalRole === 'super_admin' || (req.user as any)?.isImpersonating;
  if (!isSuperAdmin) {
    return res.status(403).json({ error: 'Access denied: Super Admin only' });
  }
  next();
}
