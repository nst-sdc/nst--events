import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function run() {
  const targetEmail = (process.argv[2] || process.env.TEST_USER_EMAIL || '').trim().toLowerCase();
  if (!targetEmail) {
    console.error('Error: Email argument is required.\nUsage: npx ts-node test_api.ts <user-email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!user) throw new Error(`No user found with email: ${targetEmail}`);

  console.log(`Testing API endpoints as: ${user.email} (${user.fullName || 'No Name'}, Role: ${user.globalRole})`);
  
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET environment variable is required");

  const token = jwt.sign(
    { sub: user.id, email: user.email, globalRole: user.globalRole },
    jwtSecret,
    { expiresIn: '1h' }
  );
  
  const endpoints = [
    '/v1/dashboard/summary',
    '/v1/events',
    '/v1/clubs',
    '/v1/notifications',
    '/users/me',
    '/v1/admin/users',
    '/v1/admin/audit-logs',
    '/v1/admin/queue/monitoring',
    '/v1/admin/queue/dead-letters',
  ];
  
  for (const ep of endpoints) {
    const res = await fetch(`http://localhost:3001${ep}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text = await res.text();
    console.log(`\n--- ${ep} [${res.status}] ---`);
    console.log(text.slice(0, 300) + (text.length > 300 ? "..." : ""));
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
