import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_EMAIL || 'admin@juriswatch.com';
  const password = process.env.SUPERADMIN_PASSWORD || 'Admin123!';
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: {}, // Do nothing if it already exists
    create: {
      email,
      name: 'Super Administrador',
      passwordHash,
      role: 'super_admin',
      tenantId: null // Super admin is global
    }
  });

  console.log(`✅ Super Admin garantido no banco de dados!`);
  console.log(`📧 Email: ${superAdmin.email}`);
  console.log(`🔑 Senha: ${password}`);
}

main()
  .catch(e => {
    console.error('❌ Erro ao criar Super Admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
