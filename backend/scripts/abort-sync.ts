import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Abortando sincronizações em andamento no banco de dados...');

  const updatedJobs = await prisma.syncJob.updateMany({
    where: {
      status: 'running'
    },
    data: {
      status: 'error',
      errorMessage: 'Sincronização cancelada manualmente pelo administrador.',
      finishedAt: new Date()
    }
  });

  console.log(`Foram cancelados ${updatedJobs.count} trabalhos de sincronização.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
