import { Queue, Worker, QueueEvents } from 'bullmq';
import { redisClient } from '../../config/redis'; // Assume this is generic redis connection string url
import { PrismaClient } from '@prisma/client';
import { DataJudAdapter } from './adapters/datajud';
import { getIO } from '../../socket';
import { findOrCreateParty, linkPartyToProcess } from '../parties/partyService';
import { enrichProcessFromDjen } from './djenEnricher';

const prisma = new PrismaClient();
const QUEUE_NAME = 'SyncQueue';

// We need a raw connection object for BullMQ
let redisHost = process.env.REDIS_HOST || '127.0.0.1';
let redisPort = parseInt(process.env.REDIS_PORT || '6379');

if (process.env.REDIS_URL) {
  try {
    const parsed = new URL(process.env.REDIS_URL);
    if (parsed.hostname) redisHost = parsed.hostname;
    if (parsed.port) redisPort = parseInt(parsed.port);
  } catch (e) {
    // Ignore URL parse errors
  }
}

const redisConnection = {
  host: redisHost,
  port: redisPort,
};

const useRedis = process.env.NO_REDIS !== 'true' && process.env.REDIS_ENABLED === 'true';

export const syncQueue = useRedis ? new Queue(QUEUE_NAME, { connection: redisConnection }) : null as any;
export const syncQueueEvents = useRedis ? new QueueEvents(QUEUE_NAME, { connection: redisConnection }) : null as any;

export async function addSyncJob(tenantId: string, clientId: string, triggeredBy: string) {
  if (useRedis && syncQueue) {
    await syncQueue.add('sync-client', { tenantId, clientId, triggeredBy });
  } else {
    console.log('[FALLBACK] Fila desativada (NO_REDIS). Executando o job sincronamente no Node...');
    handleSyncJob({ data: { tenantId, clientId, triggeredBy } }).catch(e => {
      console.error('[FALLBACK] Erro no worker síncrono:', e);
    });
  }
}

// Inicializa o worker
export const syncWorker = useRedis ? new Worker(QUEUE_NAME, async (job) => {
  if (job.name === 'import-processes') {
    return handleImportJob(job);
  }
  return handleSyncJob(job);
}, { connection: redisConnection }) : null as any;

export async function handleSyncJob(job: any) {
  const { tenantId, clientId, triggeredBy } = job.data;
  const adapter = new DataJudAdapter();

  console.log(`[WORKER] Iniciando Sync. Tenant: ${tenantId}, Client: ${clientId}`);

  // Tenta criar o registro de SyncJob (O PostgreSQL rejeitará se já houver um 'running' para este client/tenant)
  let syncJobRecord;
  try {
    syncJobRecord = await prisma.syncJob.create({
      data: {
        tenantId,
        clientId,
        triggeredBy,
        type: triggeredBy === 'system' ? 'AUTO' : 'MANUAL',
        status: 'running'
      }
    });
  } catch (error: any) {
    // 23505 é o código do PostgreSQL para UNIQUE_VIOLATION (Unique Constraint error)
    // Se falhar no índice idx_sync_running, descartamos silenciosamente
    console.warn(`[WORKER] Sincronização já está em andamento para este cliente. Abortando.`);
    return;
  }

  let newProcessesCount = 0;
  let newMovementsCount = 0;
  let partialErrors = 0;
  const syncDetails: Array<{ processNumber: string; isNew: boolean; type: 'process' | 'movement'; description?: string }> = [];

  try {
    // 1. Busca os dados do cliente e todos os CNPJs ativos
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { establishments: { where: { isActive: true } } }
    });

    const establishments = client?.establishments || [];
    
    // Auto-enriquece estabelecimentos cujas razões sociais não foram buscadas
    // Pula CPFs — nome completo já foi informado manualmente no cadastro
    const { lookupCompanyByCnpj, generateCompanySearchTerms } = await import('../cnpjLookup');
    for (const est of establishments) {
      const cleanEstDoc = est.cnpj.replace(/\D/g, '');
      if (cleanEstDoc.length === 11) continue; // CPF: nome já informado pelo usuário
      if (!est.razaoSocial || est.razaoSocial === client?.name) {
        const info = await lookupCompanyByCnpj(est.cnpj);
        if (info && info.razaoSocial) {
          est.razaoSocial = info.razaoSocial;
          if (info.fantasyName) est.fantasyName = info.fantasyName;
          await prisma.establishment.update({
            where: { id: est.id },
            data: {
              razaoSocial: info.razaoSocial,
              fantasyName: info.fantasyName || est.fantasyName
            }
          }).catch(() => {});
        }
      }
    }

    for (const est of establishments) {
      try {
        // Para CPFs (pessoa física), usa o nome completo diretamente como termo de busca
        // Para CNPJs, gera variações com sufixos societários
        const cleanEstDoc = est.cnpj.replace(/\D/g, '');
        const isCpfEst = cleanEstDoc.length === 11;
        const specificTerms = isCpfEst
          ? [est.razaoSocial.trim().toUpperCase()]
          : generateCompanySearchTerms(est.razaoSocial, est.fantasyName);

        // 2. Busca automatizada multi-tribunais via DJEN + DataJud com termos reais
        const processes = await adapter.fetchByCnpjAndTerms(est.cnpj, specificTerms);
        
        for (const p of processes) {
          // Pre-validação de Falso Positivo (LGPD e Isolamento)
          let isFalsePositive = true;
          if (p.parties && Array.isArray(p.parties)) {
            for (const rawParty of p.parties) {
              const normPartyName = rawParty.name.toUpperCase();
              const matchDoc = !!(rawParty.document && rawParty.document.replace(/\D/g, '') === est.cnpj.replace(/\D/g, ''));
              const matchName = !!(est.razaoSocial && normPartyName.includes(est.razaoSocial.toUpperCase()));
              const matchFantasy = !!(est.fantasyName && normPartyName.includes(est.fantasyName.toUpperCase()));
              if (matchDoc || matchName || matchFantasy) {
                isFalsePositive = false;
                break;
              }
            }
          }

          if (isFalsePositive) {
            console.log(`[WORKER] Descartando Falso Positivo: Processo ${p.processNumber} não pertence ao CNPJ ${est.cnpj}`);
            continue;
          }

          // 3. Upsert do Processo
          const processRecord = await prisma.process.upsert({
            where: {
              tenantId_processNumber: {
                tenantId,
                processNumber: p.processNumber
              }
            },
            update: {
              status: p.status,
              justiceType: p.justiceType,
              tribunal: p.tribunal,
              className: p.className,
              subjectMain: p.subjectMain,
              subjectsExtra: p.subjectsExtra || [],
              lastSyncAt: new Date(),
              value: p.value ? BigInt(p.value) : null
            },
            create: {
              tenantId,
              processNumber: p.processNumber,
              status: p.status,
              justiceType: p.justiceType,
              tribunal: p.tribunal,
              className: p.className,
              subjectMain: p.subjectMain,
              subjectsExtra: p.subjectsExtra || [],
              lastSyncAt: new Date(),
              sourceAdapter: 'datajud',
              value: p.value ? BigInt(p.value) : null
            }
          });

          // Se acabou de ser criado, não existia antes. 
          if (processRecord.firstSeenAt?.getTime() === processRecord.lastSyncAt?.getTime()) {
            newProcessesCount++;
            syncDetails.push({
              processNumber: p.processNumber,
              isNew: true,
              type: 'process'
            });
          }

          // 4. Cria e vincula as partes reais retornadas pelo DataJud / DJEN
          let matchedClientPartyInParties = false;

          if (p.parties && Array.isArray(p.parties)) {
            for (const rawParty of p.parties) {
              const isAuthor = rawParty.type?.toLowerCase().includes('ativo') || rawParty.type?.toLowerCase().includes('autor');
              const normPartyName = rawParty.name.toUpperCase();
              
              const matchDoc = !!(rawParty.document && rawParty.document.replace(/\D/g, '') === est.cnpj.replace(/\D/g, ''));
              const matchName = !!(est.razaoSocial && normPartyName.includes(est.razaoSocial.toUpperCase()));
              const matchFantasy = !!(est.fantasyName && normPartyName.includes(est.fantasyName.toUpperCase()));
              
              const isClientMatch = matchDoc || matchName || matchFantasy;

              const partyEntity = await findOrCreateParty(tenantId, {
                name: rawParty.name,
                document: isClientMatch ? est.cnpj : undefined,
                documentType: isClientMatch ? 'cnpj' : undefined,
                type: rawParty.name.includes('LTDA') || rawParty.name.includes('S.A.') || rawParty.name.includes('EIRELI') || rawParty.name.includes('ME') ? 'pessoa_juridica' : 'pessoa_fisica',
                enrichmentSource: 'datajud'
              });

              await linkPartyToProcess({
                processId: processRecord.id,
                partyId: partyEntity.id,
                tenantId,
                clientId: isClientMatch ? clientId : null,
                establishmentId: isClientMatch ? est.id : null,
                polo: isAuthor ? 'autor' : 'reu',
                side: isAuthor ? 'ativo' : 'passivo',
                isPrimary: isClientMatch
              });

              if (isClientMatch) {
                matchedClientPartyInParties = true;
              }
            }
          }

          // Bloqueio de Fallback (removido) para evitar exposição de falsos positivos (LGPD).
          // Se o processo chegou até aqui, uma das partes retornadas já deu 'isClientMatch = true'.

          // 5. Aciona o Enriquecimento Gratuito via DJEN (Diário de Justiça Eletrônico Nacional)
          enrichProcessFromDjen(processRecord.processNumber, tenantId, processRecord.id).catch(djenErr => {
            console.warn(`[DJEN] Falha não-bloqueante no enriquecimento:`, djenErr);
          });

          // 5. Upsert de Movimentações (ON CONFLICT DO NOTHING é garantido pelo UNIQUE)
          for (const mov of p.movements) {
            try {
              const movRecord = await prisma.movement.create({
                data: {
                  processId: processRecord.id,
                  tenantId,
                  sourceEventId: mov.eventId,
                  eventDate: mov.date,
                  eventCode: mov.code,
                  eventName: mov.name,
                  eventTypeGroup: mov.typeGroup,
                  description: mov.description,
                  importType: 'DATAJUD',
                  source: 'API_PUBLICA'
                }
              });
              newMovementsCount++;
              
              syncDetails.push({
                processNumber: processRecord.processNumber,
                isNew: false,
                type: 'movement',
                description: mov.name
              });
              
              // 6. Criar NOTIFICAÇÃO (Central de Notificações)
              // Dispara para todos os usuários que têm acesso ao Cliente
              const accesses = await prisma.userClientAccess.findMany({ where: { clientId } });
              const supervisorAccesses = await prisma.user.findMany({ where: { tenantId, role: 'supervisor' }});
              
              const usersToNotify = new Set([
                ...accesses.map(a => a.userId),
                ...supervisorAccesses.map(s => s.id)
              ]);

              const notifications = Array.from(usersToNotify).map(userId => ({
                tenantId,
                userId,
                clientId,
                type: 'NEW_MOVEMENT',
                processId: processRecord.id,
                movementId: movRecord.id,
                title: `Nova Movimentação: ${mov.name}`
              }));

              if (notifications.length > 0) {
                await prisma.notification.createMany({ data: notifications });
                
                // Dispara WebSockets para todos os usuários notificados
                try {
                  const io = getIO();
                  for (const userId of usersToNotify) {
                    io.to(`user:${userId}`).emit('notification:new', {
                      title: `Nova Movimentação: ${mov.name}`,
                      processId: processRecord.id
                    });
                  }
                } catch (socketErr) {
                  // Ignore if socket.io is not initialized (e.g. tests or strict background mode)
                }
              }

            } catch (e: any) {
              // Se violou unique de (processId, sourceEventId), já existe, tudo bem
              if (e.code !== 'P2002') throw e;
            }
          }
        }
      } catch (estError: any) {
        console.error(`[WORKER] Erro no CNPJ ${est.cnpj}:`, estError);
        partialErrors++;
        // Continua para o próximo CNPJ
      }
    }

    // 7. Atualiza o status do Job para SUCCESS
    await prisma.syncJob.update({
      where: { id: syncJobRecord.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        clientsProcessed: establishments.length,
        newProcessesFound: newProcessesCount,
        newMovementsFound: newMovementsCount,
        partialErrorCount: partialErrors,
        details: syncDetails
      }
    });

    // Invalida caches do Redis relacionados aos processos e métricas
    try {
      const { invalidateCachePattern } = await import('../../config/redis');
      await invalidateCachePattern(`procs:${tenantId}:*`);
      await invalidateCachePattern(`dash:${tenantId}:*`);
      await invalidateCachePattern(`clients:${tenantId}:*`);
    } catch (e) {}

    // Notificar o front-end sobre o encerramento do job assíncrono
    try {
      const io = getIO();
      io.to(`tenant:${tenantId}`).emit('sync:completed', {
        clientId,
        success: true,
        summary: {
          establishmentsCount: establishments.length,
          newProcessesCount,
          newMovementsCount,
          partialErrors
        }
      });
    } catch (socketErr) {
      console.warn('[WORKER] Falha ao notificar websocket:', socketErr);
    }

    return {
      success: true,
      jobId: syncJobRecord.id,
      establishmentsCount: establishments.length,
      newProcessesCount,
      newMovementsCount,
      partialErrors
    };

  } catch (globalError: any) {
    console.error(`[WORKER] Erro Crítico no SyncJob ${syncJobRecord.id}:`, globalError);
    await prisma.syncJob.update({
      where: { id: syncJobRecord.id },
      data: {
        status: 'error',
        finishedAt: new Date(),
        errorMessage: globalError.message
      }
    });

    try {
      const io = getIO();
      io.to(`tenant:${tenantId}`).emit('sync:completed', {
        clientId,
        success: false,
        error: globalError.message
      });
    } catch (socketErr) {}

    if (triggeredBy === 'system') {
      const { logAuditAction } = await import('../../middlewares/auditLogger');
      await logAuditAction({
        tenantId,
        userId: 'system',
        action: 'SYNC_AUTO_FAILED',
        metadata: { jobId: syncJobRecord.id, clientId, error: globalError.message }
      }).catch(console.error);
    }
  }
}

export async function handleImportJob(job: any) {
  const { tenantId, clientId, processNumbers, triggeredBy } = job.data;
  console.log(`[WORKER] Iniciando Importação em lote. Tenant: ${tenantId}, Client: ${clientId}`);

  const adapter = new DataJudAdapter();

  try {
    const establishment = await prisma.establishment.findFirst({
      where: { clientId, isActive: true }
    });
    if (!establishment) {
      console.warn(`[WORKER] Cliente ${clientId} não possui filiais ativas. Cancelando importação.`);
      return;
    }

    for (const pNumber of processNumbers) {
      try {
        const p = await adapter.fetchByProcessNumber(pNumber);
        if (!p) continue; // Not found

        // We use an interactive transaction to ensure atomicity per process
        await prisma.$transaction(async (tx) => {
          const processRecord = await tx.process.upsert({
            where: { tenantId_processNumber: { tenantId, processNumber: p.processNumber } },
            update: { status: p.status, justiceType: p.justiceType, tribunal: p.tribunal, lastSyncAt: new Date(), value: p.value ? BigInt(p.value) : null },
            create: { tenantId, processNumber: p.processNumber, status: p.status, justiceType: p.justiceType, tribunal: p.tribunal, lastSyncAt: new Date(), sourceAdapter: 'datajud', value: p.value ? BigInt(p.value) : null }
          });

          const clientParty = await findOrCreateParty(tenantId, {
            name: establishment.razaoSocial || `Empresa CNPJ ${establishment.cnpj}`,
            document: establishment.cnpj,
            documentType: 'cnpj',
            type: 'pessoa_juridica',
            isMasked: false,
            enrichmentSource: 'datajud'
          });

          await linkPartyToProcess({
            processId: processRecord.id,
            partyId: clientParty.id,
            tenantId,
            clientId,
            establishmentId: establishment.id,
            polo: 'reu',
            side: 'passivo',
            isPrimary: true
          });

          enrichProcessFromDjen(processRecord.processNumber, tenantId, processRecord.id).catch(console.warn);

          for (const mov of p.movements) {
            const existingMov = await tx.movement.findUnique({ where: { processId_sourceEventId: { processId: processRecord.id, sourceEventId: mov.eventId } } });
            if (!existingMov) {
              const movRecord = await tx.movement.create({
                data: { processId: processRecord.id, tenantId, sourceEventId: mov.eventId, eventDate: mov.date, eventCode: mov.code, eventName: mov.name, eventTypeGroup: mov.typeGroup, description: mov.description, importType: 'DATAJUD', source: 'API_PUBLICA' }
              });

              // Notifications with isRead = true for historical
              const accesses = await tx.userClientAccess.findMany({ where: { clientId } });
              const supervisorAccesses = await tx.user.findMany({ where: { tenantId, role: 'supervisor' }});
              const usersToNotify = new Set([...accesses.map(a => a.userId), ...supervisorAccesses.map(s => s.id)]);

              const notifications = Array.from(usersToNotify).map(userId => ({
                tenantId, userId, clientId, type: 'NEW_MOVEMENT', processId: processRecord.id, movementId: movRecord.id,
                title: `Nova Movimentação Histórica: ${mov.name}`, isRead: true
              }));

              if (notifications.length > 0) {
                await tx.notification.createMany({ data: notifications });
              }
            }
          }
        });
      } catch (e) {
        console.error(`[WORKER] Erro importando processo ${pNumber}:`, e);
      }
    }

    console.log(`[WORKER] Importação concluída. Notificando websockets...`);
    try {
      const io = getIO();
      io.to(`user:${triggeredBy}`).emit('notification:new', {
        title: 'Importação Concluída',
        processId: null
      });
    } catch(e) {}

  } catch (error) {
    console.error('[WORKER] Falha fatal na importação:', error);
  }
}

export async function handleProcessSync(processId: string, tenantId: string, triggeredBy: string) {
  const adapter = new DataJudAdapter();
  const processRecord = await prisma.process.findUnique({
    where: { id: processId }
  });
  if (!processRecord) return { success: false, error: 'Processo não encontrado' };

  console.log(`[WORKER] Sincronizando processo unitário: ${processRecord.processNumber} (ID: ${processId})`);
  let newMovementsCount = 0;

  try {
    const p = await adapter.fetchByProcessNumber(processRecord.processNumber);
    if (p) {
      await prisma.process.update({
        where: { id: processId },
        data: {
          status: p.status,
          justiceType: p.justiceType,
          tribunal: p.tribunal,
          className: p.className,
          subjectMain: p.subjectMain,
          subjectsExtra: p.subjectsExtra || [],
          lastSyncAt: new Date(),
          ...(p.value ? { value: BigInt(p.value) } : {})
        }
      });

      for (const mov of p.movements) {
        try {
          await prisma.movement.create({
            data: {
              processId: processRecord.id,
              tenantId,
              sourceEventId: mov.eventId,
              eventDate: mov.date,
              eventCode: mov.code,
              eventName: mov.name,
              eventTypeGroup: mov.typeGroup,
              description: mov.description,
              importType: 'DATAJUD',
              source: 'API_PUBLICA'
            }
          });
          newMovementsCount++;
        } catch (e: any) {
          if (e.code !== 'P2002') console.warn(`[WORKER] Movement create error:`, e.message);
        }
      }
    }

    // Always run DJEN enrichment
    await enrichProcessFromDjen(processRecord.processNumber, tenantId, processRecord.id);

    try {
      const io = getIO();
      io.to(`tenant:${tenantId}`).emit('notification:new', {
        title: `Processo ${processRecord.processNumber} atualizado!`,
        processId: processRecord.id
      });
    } catch (e) {}

    return {
      success: true,
      processNumber: processRecord.processNumber,
      newMovementsCount
    };
  } catch (error: any) {
    console.error(`[WORKER] Erro sincronizando processo ${processId}:`, error);
    return { success: false, error: error.message };
  }
}
