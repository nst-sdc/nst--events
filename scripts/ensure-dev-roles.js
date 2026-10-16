const { PrismaClient } = require('@prisma/client');

async function ensureDevRoles() {
  const prisma = new PrismaClient();
  try {
    const devUsers = [
      {
        email: 'e25b070564@adypu.edu.in',
        role: 'STUDENT',
        defaultName: 'Student User',
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

      if (existingUser) {
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
        await prisma.user.create({
          data: {
            email,
            fullName: target.defaultName,
            googleSub: `pending-oauth-${email}`,
            globalRole: target.role,
          },
        });
        console.log(`[dev-roles] Pre-provisioned ${email} -> globalRole: ${target.role}`);
      }
    }
  } catch (err) {
    console.warn(`[dev-roles] Warning: Could not configure dev roles: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  ensureDevRoles();
}

module.exports = { ensureDevRoles };
