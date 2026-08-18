import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

export async function logAuditAction(params: {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
  ipAddress?: string;
}) {
  try {
    let userName: string | undefined;

    if (params.userId) {
      const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { name: true } });
      if (user) userName = user.name;
    }

    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId || null,
        userId: params.userId || null,
        userName,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata || {},
        ipAddress: params.ipAddress
      }
    });
  } catch (error) {
    console.error('[AUDIT_ERROR] Failed to log audit action:', error);
  }
}

// Optional middleware to attach audit logger to response locals or similar,
// but usually it's imported directly by controllers.
