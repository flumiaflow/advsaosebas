import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { DataJudAdapter } from '../services/sync/adapters/datajud';
import { syncQueue } from '../services/sync/worker';
import { logAuditAction } from '../middlewares/auditLogger';

export async function previewImport(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    const { processNumbers } = req.body; // array of strings
    if (!Array.isArray(processNumbers) || processNumbers.length === 0) {
      return res.status(400).json({ error: 'É necessário enviar um array de processNumbers.' });
    }

    const adapter = new DataJudAdapter();
    const result = {
      newProcesses: [] as any[],
      existingProcesses: [] as any[],
      notFound: [] as string[]
    };

    // Para evitar timeout na requisição, limitamos o preview a 20 processos
    const toCheck = processNumbers.slice(0, 20);

    for (const pNumber of toCheck) {
      const cleanNumber = pNumber.replace(/\D/g, ''); // Limpa máscara
      
      const existing = await prisma.process.findFirst({
        where: { tenantId, processNumber: pNumber }
      });

      if (existing) {
        result.existingProcesses.push({
          processNumber: pNumber,
          status: existing.status,
          tribunal: existing.tribunal
        });
      } else {
        const datajudData = await adapter.fetchByProcessNumber(pNumber);
        if (datajudData) {
          result.newProcesses.push({
            processNumber: datajudData.processNumber,
            status: datajudData.status,
            tribunal: datajudData.tribunal
          });
        } else {
          result.notFound.push(pNumber);
        }
      }
    }

    return res.status(200).json({
      previewNote: processNumbers.length > 20 ? 'Preview limitado aos primeiros 20 processos.' : undefined,
      totalSent: processNumbers.length,
      previewResult: result
    });
  } catch (error) {
    console.error('Error in import preview:', error);
    return res.status(500).json({ error: 'Erro ao gerar preview de importação' });
  }
}

export async function confirmImport(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    const { processNumbers, clientId } = req.body;
    if (!Array.isArray(processNumbers) || processNumbers.length === 0 || !clientId) {
      return res.status(400).json({ error: 'Faltam parâmetros (processNumbers ou clientId).' });
    }

    // Verify if client belongs to tenant
    const client = await prisma.client.findFirst({ where: { id: clientId, tenantId }});
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    if (!syncQueue) {
      // Fallback síncrono para desenvolvimento sem Redis
      console.log('[FALLBACK] Fila desativada. Disparando importação background no Node...');
      
      const { handleImportJob } = await import('../services/sync/worker');
      const jobId = 'mock-job-' + Date.now();
      
      handleImportJob({
        data: { tenantId, clientId, processNumbers, triggeredBy: req.user!.userId }
      }).catch(e => {
        console.error('[FALLBACK] Erro fatal no worker de importação:', e);
      });

      await logAuditAction({
        tenantId,
        userId: req.user!.userId,
        action: 'IMPORT_ENQUEUED',
        metadata: { count: processNumbers.length, clientId, jobId }
      });

      return res.status(202).json({
        message: 'Importação enviada para processamento em background (Fallback local).',
        jobId
      });
    }

    // Enqueue background import job
    const job = await syncQueue.add('import-processes', {
      tenantId,
      clientId,
      processNumbers,
      triggeredBy: req.user!.userId
    });

    await logAuditAction({
      tenantId,
      userId: req.user!.userId,
      action: 'IMPORT_ENQUEUED',
      metadata: { count: processNumbers.length, clientId, jobId: job.id }
    });

    return res.status(202).json({
      message: 'Importação enviada para processamento em background.',
      jobId: job.id
    });
  } catch (error) {
    console.error('Error confirming import:', error);
    return res.status(500).json({ error: 'Erro ao iniciar importação' });
  }
}
