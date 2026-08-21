import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  await prisma.$executeRaw`DELETE FROM process_parties WHERE party_id IS NOT NULL AND party_id NOT IN (SELECT id FROM parties)`;
  console.log('Cleaned bad process_parties');
}
run().finally(() => prisma.$disconnect());
