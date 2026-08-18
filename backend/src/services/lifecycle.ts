import cron from 'node-cron';
import { prisma } from '../config/db';

export function startLifecycleJobs() {
  // Run every night at 00:00 (UTC)
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[LIFECYCLE] Running daily tenant trial check...');
      const now = new Date();
      
      const expiredTenants = await prisma.tenant.updateMany({
        where: {
          status: 'active',
          trialEndsAt: { lt: now }
        },
        data: {
          status: 'suspended'
        }
      });

      if (expiredTenants.count > 0) {
        console.log(`[LIFECYCLE] Suspended ${expiredTenants.count} tenants due to trial expiration.`);
      }

      // Hard delete tenants that were cancelled > 90 days ago
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const deletedTenants = await prisma.tenant.deleteMany({
        where: {
          status: 'cancelled',
          cancelledAt: { lt: ninetyDaysAgo }
        }
      });

      if (deletedTenants.count > 0) {
        console.log(`[LIFECYCLE] Hard-deleted ${deletedTenants.count} cancelled tenants (past 90 days).`);
      }
    } catch (error) {
      console.error('[LIFECYCLE] Error checking tenant expirations:', error);
    }
  });

  console.log('✅ Lifecycle Jobs (cron) initialized.');
}
