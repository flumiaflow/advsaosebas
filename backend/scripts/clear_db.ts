import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deletando movimentos...');
  await prisma.movement.deleteMany({});
  
  console.log('Deletando process parties...');
  await prisma.processParty.deleteMany({});
  
  console.log('Deletando notificações...');
  await prisma.notification.deleteMany({});
  
  console.log('Deletando parties em cache...');
  await prisma.party.deleteMany({});
  
  console.log('Deletando processos...');
  await prisma.process.deleteMany({});

  console.log('Processos e tabelas relacionadas limpos com sucesso.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
