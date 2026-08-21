import cron from 'node-cron';
import { prisma } from '../../config/db';
import { addSyncJob } from './worker';

// Start global cron job that runs every minute
export function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const activeTenants = await prisma.tenant.findMany({
        where: { status: 'active' },
        include: { syncConfig: true }
      });

      for (const tenant of activeTenants) {
        const config = tenant.syncConfig || {
          daysOfWeek: [1, 2, 3, 4, 5],
          times: ['07:00'],
          timezone: tenant.timezone || 'America/Sao_Paulo',
          onlyActiveClients: true,
          isActive: true
        };

        if (!config.isActive) continue;

        const timezone = config.timezone || tenant.timezone || 'America/Sao_Paulo';

        // Get current date/time in tenant's configured timezone
        const now = new Date();
        const tzTime = new Intl.DateTimeFormat('pt-BR', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(now);

        // Calculate Day of Week in Target Timezone (0 = Sunday, 1 = Monday, ...)
        const tzDateStr = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          weekday: 'short'
        }).format(now);
        
        const daysMap: Record<string, number> = {
          'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
        };
        const currentDayOfWeek = daysMap[tzDateStr];

        // Check if today is an active day
        const daysOfWeek = config.daysOfWeek || [1, 2, 3, 4, 5];
        if (!daysOfWeek.includes(currentDayOfWeek)) {
          continue;
        }

        // Check if current hour:minute matches any of the configured times
        const currentHourMinute = tzTime; // "HH:mm"
        const times = config.times || ['07:00'];
        if (times.includes(currentHourMinute)) {
          const clients = await prisma.client.findMany({
            where: {
              tenantId: tenant.id,
              isActive: config.onlyActiveClients ? true : undefined
            }
          });

          console.log(`[SCHEDULER] Auto-Sync disparado para escritório ${tenant.name} (${clients.length} clientes) às ${currentHourMinute}`);

          for (const client of clients) {
            await addSyncJob(tenant.id, client.id, 'system');
          }
        }
      }
    } catch (error) {
      console.error('[SCHEDULER] Error processing cron check:', error);
    }
  });

  console.log('✅ Sync Scheduler (cron) initialized.');
}
