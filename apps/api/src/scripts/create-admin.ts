import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function createAdmin() {
  const password = 'Admin@123456'; // غيّر هذا كلمة المرور
  const passwordHash = await argon2.hash(password);

  const admin = await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@elmasaif.com',
      fullName: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Admin account created/updated:');
  console.log('Username:', admin.username);
  console.log('Email:', admin.email);
  console.log('Password:', password);
  console.log('Role:', admin.role);
}

createAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
