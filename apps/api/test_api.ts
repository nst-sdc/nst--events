import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({ where: { email: 'e25b070564@adypu.edu.in' } });
  if (!user) throw new Error("No user");
  
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
