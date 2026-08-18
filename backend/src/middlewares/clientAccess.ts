import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

export async function clientAccessMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params; // This expects the route parameter to be the client id, e.g. /clients/:id
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Super Admin has no tenant, they can't access client specific routes directly without passing tenant context
    // Usually they use the backoffice routes
    if (user.role === 'super_admin') {
       return res.status(403).json({ error: 'Super Admin cannot access tenant client routes' });
    }

    // Supervisor has automatic access to all clients in their tenant
    if (user.role === 'supervisor') {
      const client = await prisma.client.findUnique({
        where: { id: id }
      });

      if (!client || client.tenantId !== user.tenantId) {
        return res.status(404).json({ error: 'Client not found' }); // Return 404 to not reveal existence
      }

      return next();
    }

    // Regular user needs to be checked against user_client_access
    const access = await prisma.userClientAccess.findUnique({
      where: {
        userId_clientId: {
          userId: user.userId,
          clientId: id
        }
      }
    });

    if (!access) {
      // We check if the client exists in the tenant at all
      const client = await prisma.client.findUnique({
        where: { id: id }
      });
      
      // If client exists in the tenant but user doesn't have access -> 403
      // If client doesn't exist in the tenant -> 404
      if (client && client.tenantId === user.tenantId) {
        return res.status(403).json({ error: 'Access denied to this client' });
      } else {
        return res.status(404).json({ error: 'Client not found' });
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error checking client access' });
  }
}
