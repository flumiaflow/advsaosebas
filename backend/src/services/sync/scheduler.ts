import cron from 'node-cron';
import { prisma } from '../../config/db';
import { addSyncJob } from './worker';

// Start global cron job that runs every minute
export function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const activeConfigs = await prisma.syncConfig.findMany({
        where: { 
          isActive: true,
          tenant: { status: 'active' }
        },
        include: { tenant: true }
      });

      for (const config of activeConfigs) {
        if (!config.tenant) continue; // Skip if tenant is suspended/cancelled/not found

        // Get current date/time in tenant's configured timezone
        const now = new Date();
        const tzTime = new Intl.DateTimeFormat('pt-BR', {
          timeZone: config.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          weekday: 'narrow' // Returns 1 letter, not useful directly, so we use logic below
        }).format(now);

        // Calculate Day of Week in Target Timezone (0 = Sunday, 1 = Monday, ...)
        const tzDateStr = new Intl.DateTimeFormat('en-US', {
          timeZone: config.timezone,
          weekday: 'short'
        }).format(now);
        
        const daysMap: Record<string, number> = {
          'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
        };
        const currentDayOfWeek = daysMap[tzDateStr];

        // Check if today is an active day
        if (!config.daysOfWeek.includes(currentDayOfWeek)) {
          continue;
        }

        // Check if current hour:minute matches any of the configured times
        const currentHourMinute = tzTime; // "HH:mm"
        if (config.times.includes(currentHourMinute)) {
          // Time matches! Let's enqueue jobs for all active clients of this tenant
          const clients = await prisma.client.findMany({
            where: {
              tenantId: config.tenantId,
              isActive: config.onlyActiveClients ? true : undefined
            }
          });

          console.log(`[SCHEDULER] Triggering sync for Tenant ${config.tenant.name} (${clients.length} clients) at ${currentHourMinute}`);

          for (const client of clients) {
            await addSyncJob(config.tenantId, client.id, 'system');
          }
        }
      }
    } catch (error) {
      console.error('[SCHEDULER] Error processing cron check:', error);
    }
  });

  console.log('✅ Sync Scheduler (cron) initialized.');
}
