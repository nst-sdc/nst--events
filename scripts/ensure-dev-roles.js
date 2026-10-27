const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const ALLOWED_DEV_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  'nst-postgres',
  'nst-postgres-service',
  'postgres',
  'host.docker.internal',
]);

function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return '';
  return msg.replace(/:\/\/([^:@]+):([^@]+)@/g, '://$1:***@');
}

function getDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return process.env.DATABASE_URL.trim();
  }
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../packages/database/.env'),
  ];
  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^DATABASE_URL=(.+)$/m);
        if (match) {
          let url = match[1].trim();
          if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
            url = url.slice(1, -1);
          }
          return url.trim();
        }
      } catch {
        // ignore read error
      }
    }
  }
  return null;
}

function validateDatabaseUrl(rawUrl, allowRemote = false) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('DATABASE_URL is missing or empty. Development role seeding requires a valid database URL.');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }

  const hostname = (parsed.hostname || '').toLowerCase();
  const isAllowedHost = ALLOWED_DEV_HOSTS.has(hostname) || hostname.endsWith('.local');

  if (!isAllowedHost) {
    if (allowRemote) {
      console.warn(
        `[dev-roles] WARNING: Seeding roles against remote host "${hostname}" because ALLOW_REMOTE_DEV_ROLE_SEEDING=true is set.`
      );
      return hostname;
    }
    throw new Error(
      `Refusing to seed dev roles against non-allowlisted host "${hostname}". Development role seeding is restricted to local databases (localhost, 127.0.0.1, nst-postgres). To override, set ALLOW_REMOTE_DEV_ROLE_SEEDING=true.`
    );
  }

  return hostname;
}

async function ensureDevRoles() {
  const rawUrl = getDatabaseUrl();
  const allowRemote = process.env.ALLOW_REMOTE_DEV_ROLE_SEEDING === 'true';

  // 1. Fail-closed safety validation
  validateDatabaseUrl(rawUrl, allowRemote);

  const prisma = new PrismaClient();
  try {
    const devUsers = [
      {
        email: 'e25b070564@adypu.edu.in',
        role: 'STUDENT',
        defaultName: 'Soham Dhande',
        clubAdmin: true,
      },
      {
        email: 'e25b070901@adypu.edu.in',
        role: 'PLATFORM_ADMIN',
        defaultName: 'Platform Administrator',
      },
    ];

    for (const target of devUsers) {
      const email = target.email.trim().toLowerCase();

      // 1. Ensure authorized student directory entry is ACTIVE
      await prisma.authorizedStudent.upsert({
        where: { normalizedEmail: email },
        update: { status: 'ACTIVE' },
        create: {
          normalizedEmail: email,
          status: 'ACTIVE',
        },
      });

      // 2. Ensure user exists and has the designated globalRole
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      let userId;
      if (existingUser) {
        userId = existingUser.id;
        if (existingUser.globalRole !== target.role || existingUser.deletedAt !== null) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              globalRole: target.role,
              deletedAt: null,
              securityVersion: { increment: 1 },
            },
          });
          console.log(`[dev-roles] Updated ${email} -> globalRole: ${target.role}`);
        } else {
          console.log(`[dev-roles] Verified ${email} -> globalRole: ${target.role}`);
        }
      } else {
        const createdUser = await prisma.user.create({
          data: {
            email,
            fullName: target.defaultName,
            googleSub: `pending-oauth-${email}`,
            globalRole: target.role,
          },
        });
        userId = createdUser.id;
        console.log(`[dev-roles] Pre-provisioned ${email} -> globalRole: ${target.role}`);
      }

      // 3. Ensure Club Admin memberships if specified
      if (target.clubAdmin && userId) {
        let clubs = await prisma.club.findMany({ where: { status: 'ACTIVE', deletedAt: null } });
        if (clubs.length === 0) {
          const defaultClub = await prisma.club.create({
            data: {
              name: 'NST Developers Club',
              description: 'Default local development club',
              status: 'ACTIVE',
            },
          });
          clubs = [defaultClub];
        }

        for (const club of clubs) {
          const membership = await prisma.clubMembership.findFirst({
            where: { userId, clubId: club.id },
          });
          if (!membership) {
            await prisma.clubMembership.create({
              data: {
                userId,
                clubId: club.id,
                role: 'CLUB_ADMIN',
              },
            });
            console.log(`[dev-roles] Created CLUB_ADMIN on ${club.name} -> ${email}`);
          } else if (membership.role !== 'CLUB_ADMIN' || membership.deletedAt !== null) {
            await prisma.clubMembership.update({
              where: { id: membership.id },
              data: { role: 'CLUB_ADMIN', deletedAt: null },
            });
            console.log(`[dev-roles] Restored CLUB_ADMIN on ${club.name} -> ${email}`);
          }
        }
        console.log(`[dev-roles] Verified CLUB_ADMIN on ${clubs.length} clubs -> ${email}`);
      }
    }
  } catch (err) {
    const safeMsg = sanitizeErrorMessage(err.message);
    console.error(`[dev-roles] Error: Could not configure dev roles: ${safeMsg}`);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  ensureDevRoles().catch((err) => {
    const safeMsg = sanitizeErrorMessage(err.message);
    console.error(`[dev-roles] Fatal: ${safeMsg}`);
    process.exit(1);
  });
}

module.exports = {
  ensureDevRoles,
  validateDatabaseUrl,
  sanitizeErrorMessage,
  getDatabaseUrl,
  ALLOWED_DEV_HOSTS,
};
