import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding rich local calendar events for NST Events...');

  // 1. Get or create Admin user
  let admin = await prisma.user.findFirst({
    where: { globalRole: 'PLATFORM_ADMIN' }
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@nst.edu',
        fullName: 'Platform Administrator',
        googleSub: 'google-sub-admin-local',
        globalRole: 'PLATFORM_ADMIN'
      }
    });
  }

  // 2. Get student users
  const students = await prisma.user.findMany({
    where: { globalRole: 'STUDENT' }
  });
  console.log(`Found ${students.length} student users in database.`);

  // 3. Clubs Setup
  const clubsData = [
    { name: 'GDG on Campus NST', description: 'Google Developer Group student community.' },
    { name: 'ACM Student Chapter', description: 'Association for Computing Machinery chapter at NST.' },
    { name: 'NST Robotics Society', description: 'Hardware, drones, and autonomous robotics club.' },
    { name: 'NST Design & UI/UX Collective', description: 'Product design, typography, and creative media.' },
    { name: 'NST Cultural & Arts League', description: 'Music, theater, gaming, and campus lifestyle.' },
  ];

  const clubs: Record<string, string> = {};
  for (const c of clubsData) {
    let club = await prisma.club.findFirst({ where: { name: c.name } });
    if (!club) {
      club = await prisma.club.create({
        data: {
          name: c.name,
          description: c.description,
          status: 'ACTIVE'
        }
      });
    }
    clubs[c.name] = club.id;
  }

  // Current anchor date (September 2026)
  const baseYear = 2026;
  const baseMonth = 8; // September is month 8 (0-indexed)

  const eventsToSeed = [
    {
      title: 'Full-Stack Next.js 16 & Turbopack Workshop',
      description: 'Hands-on intensive masterclass on Server Components, Turbopack optimizations, and Tailwind v4 architecture.',
      eventType: 'WORKSHOP' as const,
      startTime: new Date(baseYear, baseMonth, 15, 10, 0, 0),
      endTime: new Date(baseYear, baseMonth, 15, 13, 0, 0),
      locationName: 'Computer Lab 3 (Turing Hall)',
      clubName: 'GDG on Campus NST',
      bannerUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80',
      maxCapacity: 60,
      registrationType: 'INDIVIDUAL' as const,
      userRegistrations: ['REGISTERED']
    },
    {
      title: 'NST Hackathon 2026: Code for Impact',
      description: '48-hour flagship hackathon building AI, systems, and open-source applications with campus mentors.',
      eventType: 'HACKATHON' as const,
      startTime: new Date(baseYear, baseMonth, 18, 9, 0, 0),
      endTime: new Date(baseYear, baseMonth, 20, 18, 0, 0),
      locationName: 'Main Campus Auditorium & Innovation Hub',
      clubName: 'ACM Student Chapter',
      bannerUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&q=80',
      maxCapacity: 300,
      registrationType: 'INDIVIDUAL' as const,
      userRegistrations: ['REGISTERED']
    },
    {
      title: 'Autonomous Rover Maze Race',
      description: 'High-speed autonomous maze navigation and obstacle avoidance competition by NST Robotics.',
      eventType: 'COMPETITION' as const,
      startTime: new Date(baseYear, baseMonth, 22, 14, 0, 0),
      endTime: new Date(baseYear, baseMonth, 22, 17, 0, 0),
      locationName: 'Robotics Outdoor Arena',
      clubName: 'NST Robotics Society',
      bannerUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&q=80',
      maxCapacity: 40,
      registrationType: 'INDIVIDUAL' as const,
      userRegistrations: ['WAITLISTED']
    },
    {
      title: 'Scaling Distributed Systems with Kafka',
      description: 'Tech talk by senior engineering guests on event sourcing, distributed brokers, and zero-data-loss pipelines.',
      eventType: 'SEMINAR' as const,
      startTime: new Date(baseYear, baseMonth, 25, 16, 0, 0),
      endTime: new Date(baseYear, baseMonth, 25, 18, 30, 0),
      locationName: 'Seminar Hall A',
      clubName: 'ACM Student Chapter',
      bannerUrl: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&q=80',
      maxCapacity: 120,
      registrationType: 'INDIVIDUAL' as const,
      userRegistrations: [] // Open campus event
    },
    {
      title: 'FOSS & Open Source Contribution Sprint',
      description: 'Collaborative sprint fixing first-time issues on popular open source repositories and documentation.',
      eventType: 'MEETUP' as const,
      startTime: new Date(baseYear, baseMonth, 28, 11, 0, 0),
      endTime: new Date(baseYear, baseMonth, 28, 15, 0, 0),
      locationName: 'Innovation Hub Lounge',
      clubName: 'GDG on Campus NST',
      bannerUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80',
      maxCapacity: 50,
      registrationType: 'INDIVIDUAL' as const,
      userRegistrations: [] // Open campus event
    },
    {
      title: 'Campus Cultural & Gaming Night',
      description: 'Annual autumn esports tournament, acoustic music jams, and campus club showcase.',
      eventType: 'CULTURAL' as const,
      startTime: new Date(baseYear, baseMonth + 1, 2, 18, 0, 0), // Oct 2
      endTime: new Date(baseYear, baseMonth + 1, 2, 22, 0, 0),
      locationName: 'Open Air Amphitheatre',
      clubName: 'NST Cultural & Arts League',
      bannerUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80',
      maxCapacity: 500,
      registrationType: 'INDIVIDUAL' as const,
      userRegistrations: [] // Open event in October
    },
    {
      title: 'Intro to Git, GitHub & CLI Workflows',
      description: 'Foundational bootcamp for first-year batches covering terminal mastery, commit hygiene, and branching.',
      eventType: 'WORKSHOP' as const,
      startTime: new Date(baseYear, baseMonth, 5, 14, 0, 0), // Sep 5 (Past)
      endTime: new Date(baseYear, baseMonth, 5, 17, 0, 0),
      locationName: 'Lab 1',
      clubName: 'GDG on Campus NST',
      bannerUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=80',
      maxCapacity: 80,
      registrationType: 'INDIVIDUAL' as const,
      userRegistrations: ['REGISTERED'] // Past attended
    },
    {
      title: 'Academic Orientation & Campus Clubs Fair',
      description: 'Welcome fair showcasing 20+ student clubs, academic societies, and hackathon teams.',
      eventType: 'OTHER' as const,
      startTime: new Date(baseYear, baseMonth, 1, 10, 0, 0), // Sep 1 (Past)
      endTime: new Date(baseYear, baseMonth, 1, 16, 0, 0),
      locationName: 'Main Campus Quad',
      clubName: 'ACM Student Chapter',
      bannerUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1200&q=80',
      maxCapacity: 1000,
      registrationType: 'INDIVIDUAL' as const,
      userRegistrations: [] // Past open
    }
  ];

  for (const item of eventsToSeed) {
    const clubId = clubs[item.clubName];
    
    // Check if event already exists
    let existingEvent = await prisma.event.findFirst({
      where: { title: item.title }
    });

    if (!existingEvent) {
      existingEvent = await prisma.event.create({
        data: {
          title: item.title,
          description: item.description,
          startTime: item.startTime,
          endTime: item.endTime,
          locationName: item.locationName,
          state: 'PUBLISHED',
          eventType: item.eventType,
          visibility: 'PUBLIC',
          isLocked: item.endTime < new Date(),
          registrationType: item.registrationType,
          registrationCount: 0,
          maxCapacity: item.maxCapacity,
          audience: 'ALL_STUDENTS',
          attendanceType: 'SINGLE',
          metadata: {
            banner_url: item.bannerUrl
          },
          creator: {
            connect: { id: admin.id }
          },
          eventClubs: {
            create: {
              clubId: clubId,
              isPrimary: true
            }
          }
        }
      });
      console.log(` Created event: "${item.title}"`);
    } else {
      console.log(` Event already exists: "${item.title}"`);
    }

    // Connect user registrations
    if (item.userRegistrations.length > 0) {
      for (const student of students) {
        const status = item.userRegistrations[0] as 'REGISTERED' | 'WAITLISTED';
        
        const existingReg = await prisma.eventRegistration.findFirst({
          where: {
            eventId: existingEvent.id,
            userId: student.id
          }
        });

        if (!existingReg) {
          await prisma.eventRegistration.create({
            data: {
              eventId: existingEvent.id,
              userId: student.id,
              registrationStatus: status,
              participationRole: 'ATTENDEE',
            }
          });
          
          // Increment registration count
          await prisma.event.update({
            where: { id: existingEvent.id },
            data: { registrationCount: { increment: 1 } }
          });

          console.log(`   -> Registered student ${student.email} as [${status}]`);
        }
      }
    }
  }

  console.log('Finished seeding local calendar events successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
