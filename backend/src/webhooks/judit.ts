import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { getIO } from '../socket';

export async function juditWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers['x-judit-signature'] as string;
    const payload = JSON.stringify(req.body);
    const secret = process.env.JUDIT_WEBHOOK_SECRET;

    if (!secret) {
      console.warn('JUDIT_WEBHOOK_SECRET not configured. Accepting mock webhook.');
    } else if (signature) {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(payload).digest('hex');
      if (signature !== digest) {
        return res.status(401).json({ error: 'Assinatura HMAC inválida' });
      }
    }

    const { tenantId, processNumber, eventId, date, code, name, typeGroup, description } = req.body;
    
    // Webhook deve pelo menos informar o tenant, número do processo e id do evento
    if (!tenantId || !processNumber || !eventId || !name) {
      return res.status(400).json({ error: 'Payload incompleto' });
    }

    // Achar o processo ou criar stubs
    let processRecord = await prisma.process.findFirst({
      where: { tenantId, processNumber }
    });

    if (!processRecord) {
      // Se processo não existe ainda, criamos um cabeçalho básico para poder receber a movimentação
      processRecord = await prisma.process.create({
        data: {
          tenantId,
          processNumber,
          sourceAdapter: 'judit',
          status: 'ativo'
        }
      });
    }

    // Idempotência
    const existing = await prisma.movement.findUnique({
      where: {
        processId_sourceEventId: {
          processId: processRecord.id,
          sourceEventId: eventId
        }
      }
    });

    if (!existing) {
      const movRecord = await prisma.movement.create({
        data: {
          processId: processRecord.id,
          tenantId,
          sourceEventId: eventId,
          eventDate: new Date(date || Date.now()),
          eventCode: code || null,
          eventName: name,
          eventTypeGroup: typeGroup || 'andamento',
          description: description || '',
          importType: 'scheduled',
          source: 'judit'
        }
      });

      // Gerar notificações
      // Find all clients associated with this process
      const parties = await prisma.processParty.findMany({ where: { processId: processRecord.id }});
      const clientIds = [...new Set(parties.map(p => p.clientId).filter((id): id is string => Boolean(id)))];

      for (const clientId of clientIds) {
        const accesses = await prisma.userClientAccess.findMany({ where: { clientId } });
        const supervisorAccesses = await prisma.user.findMany({ where: { tenantId, role: 'supervisor' }});
        const usersToNotify = new Set([...accesses.map(a => a.userId), ...supervisorAccesses.map(s => s.id)]);

        const notifications = Array.from(usersToNotify).map(userId => ({
          tenantId, userId, clientId, type: 'NEW_MOVEMENT', processId: processRecord.id, movementId: movRecord.id,
          title: `Nova movimentação (JUDIT): ${name}`
        }));

        if (notifications.length > 0) {
          await prisma.notification.createMany({ data: notifications });
          // Emit socket for online users
          const io = getIO();
          for (const userId of usersToNotify) {
            io.to(`user:${userId}`).emit('notification:new', {
              title: `Nova movimentação (JUDIT): ${name}`,
              processId: processRecord.id
            });
          }
        }
      }
    }

    // Sempre retorna 200 pro webhook não ficar retentando em caso de sucesso ou conflito
    return res.status(200).send('OK');

  } catch (error) {
    console.error('Error processing JUDIT webhook:', error);
    // Erros 500 fazem o webhook retentar depois
    return res.status(500).send('Internal Server Error');
  }
}
