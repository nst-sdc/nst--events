import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Configuring Event Organizer & Student Role for Soham ---');

  const sohamEmail = 'e25b070564@adypu.edu.in';
  const soham = await prisma.user.findUnique({
    where: { email: sohamEmail },
  });

  if (!soham) {
    throw new Error(`User with email ${sohamEmail} not found!`);
  }

  // 1. Get or create a dedicated Organizer User (Leader A / Devs Club Lead)
  let organizer = await prisma.user.findFirst({
    where: { email: 'leaderA@nst.com' },
  });

  if (!organizer) {
    organizer = await prisma.user.create({
      data: {
        email: 'leaderA@nst.com',
        fullName: 'Arjun Verma (Dev Club Lead)',
        googleSub: 'google-sub-leader-arjun',
        globalRole: 'STUDENT',
      },
    });
  }

  console.log(`Dedicated Event Organizer: ${organizer.fullName} (${organizer.email})`);

  // 2. Assign organizer as CLUB_ADMIN of NST Developers Club
  const club = await prisma.club.findFirst({
    where: { name: 'NST Developers Club' },
  });

  if (!club) {
    throw new Error('NST Developers Club not found');
  }

  const existingMem = await prisma.clubMembership.findFirst({
    where: { userId: organizer.id, clubId: club.id },
  });

  if (existingMem) {
    await prisma.clubMembership.update({
      where: { id: existingMem.id },
      data: { role: 'CLUB_ADMIN', deletedAt: null },
    });
  } else {
    await prisma.clubMembership.create({
      data: { userId: organizer.id, clubId: club.id, role: 'CLUB_ADMIN' },
    });
  }
  console.log(`Assigned ${organizer.fullName} as CLUB_ADMIN of ${club.name}`);

  // 3. Update the event createdBy to organizer
  const eventSlug = 'autonomous-ai-summit-2026';
  const event = await prisma.event.findFirst({
    where: { slug: eventSlug },
  });

  if (!event) {
    throw new Error(`Event with slug ${eventSlug} not found!`);
  }

  await prisma.event.update({
    where: { id: event.id },
    data: {
      createdBy: organizer.id,
    },
  });
  console.log(`Updated Event creator to: ${organizer.fullName}`);

  // 4. Demote Soham to standard MEMBER in all clubs
  const updatedCount = await prisma.clubMembership.updateMany({
    where: {
      userId: soham.id,
      role: 'CLUB_ADMIN',
    },
    data: {
      role: 'MEMBER',
    },
  });
  console.log(`Demoted Soham from CLUB_ADMIN to MEMBER across ${updatedCount.count} club(s)`);

  // 5. Ensure Soham is verified institutional student
  await prisma.user.update({
    where: { id: soham.id },
    data: {
      globalRole: 'STUDENT',
      googleSub: soham.googleSub || 'google-sub-soham-verified',
    },
  });

  // Also ensure authorized_students entry is active
  await prisma.authorizedStudent.upsert({
    where: { normalizedEmail: sohamEmail.toLowerCase().trim() },
    update: { status: 'ACTIVE' },
    create: { normalizedEmail: sohamEmail.toLowerCase().trim(), status: 'ACTIVE' },
  });

  // 6. Delete any pre-existing registration for Soham so he can fresh register
  const deletedRegs = await prisma.eventRegistration.deleteMany({
    where: {
      eventId: event.id,
      userId: soham.id,
    },
  });
  if (deletedRegs.count > 0) {
    console.log(`Cleared previous registration (${deletedRegs.count}) for Soham to allow fresh registration`);
  }

  // 7. Verify Soham's memberships and eligibility
  const freshSoham = await prisma.user.findUnique({
    where: { id: soham.id },
    include: {
      clubMemberships: {
        where: { deletedAt: null },
        include: { club: { select: { name: true } } },
      },
    },
  });

  const isClubAdmin = freshSoham?.clubMemberships.some((m) => m.role === 'CLUB_ADMIN');
  console.log(`Verification: Soham is CLUB_ADMIN of any club: ${isClubAdmin ? 'YES (BLOCKED)' : 'NO (ELIGIBLE TO REGISTER)'}`);
  console.log(`Soham Global Role: ${freshSoham?.globalRole}`);
  console.log(`Total Memberships for Soham: ${freshSoham?.clubMemberships.length}`);

  console.log('--- Configuration Complete! ---');
  console.log(`Event Web URL:    http://localhost:3000/student/events/${event.id}`);
  console.log(`Event Public URL: http://localhost:3000/event/${event.slug}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
