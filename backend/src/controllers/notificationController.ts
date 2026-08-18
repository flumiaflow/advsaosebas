import { Request, Response } from 'express';
import { prisma } from '../config/db';

export async function getUnreadNotifications(req: Request, res: Response) {
  try {
    const userId = req.user?.userId!;

    const notifications = await prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limite pro Popover
    });

    const count = await prisma.notification.count({
      where: { userId, isRead: false }
    });

    return res.status(200).json({ notifications, count });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function markAsRead(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId!;

    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function markAllAsRead(req: Request, res: Response) {
  try {
    const userId = req.user?.userId!;
    const { until_timestamp } = req.body; // Conforme definido na ressalva arquitetural!

    if (!until_timestamp) {
      return res.status(400).json({ error: 'until_timestamp é obrigatório para evitar race conditions' });
    }

    await prisma.notification.updateMany({
      where: { 
        userId, 
        isRead: false,
        createdAt: { lte: new Date(until_timestamp) }
      },
      data: { isRead: true }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}
