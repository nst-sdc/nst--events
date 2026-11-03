import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Creating Rich Event with Registration Form ---');

  // 1. Get or create Admin creator
  let admin = await prisma.user.findFirst({
    where: { globalRole: 'PLATFORM_ADMIN' },
  });

  if (!admin) {
    admin = await prisma.user.findFirst({
      where: { globalRole: 'STUDENT' },
    });
  }

  if (!admin) {
    throw new Error('No admin or user found in database');
  }

  // 2. Get Club
  let club = await prisma.club.findFirst({
    where: { name: 'NST Developers Club' },
  });

  if (!club) {
    club = await prisma.club.findFirst({
      where: { status: 'ACTIVE' },
    });
  }

  if (!club) {
    throw new Error('No active club found in database');
  }

  console.log(`Using Creator: ${admin.fullName} (${admin.email})`);
  console.log(`Using Club: ${club.name} (${club.id})`);

  // 3. Define Field Definitions for Questionnaire
  const fieldDefsData = [
    {
      key: 'summit_github_portfolio',
      label: 'GitHub Profile or Portfolio Link',
      fieldType: 'URL' as const,
      options: null,
      isReusable: true,
      isRequired: true,
      order: 1,
    },
    {
      key: 'summit_primary_stack',
      label: 'Primary Tech Stack & Track',
      fieldType: 'SELECT' as const,
      options: [
        'TypeScript / Next.js',
        'Python / FastAPI / PyTorch',
        'Go / Distributed Systems',
        'Rust / Systems Programming',
        'UI/UX & Product Design',
      ],
      isReusable: true,
      isRequired: true,
      order: 2,
    },
    {
      key: 'summit_ai_experience',
      label: 'Current Experience with AI / LLMs',
      fieldType: 'RADIO' as const,
      options: [
        'Beginner (Eager to learn)',
        'Intermediate (Built apps with LLM APIs)',
        'Advanced (Agent frameworks / Fine-tuning)',
      ],
      isReusable: true,
      isRequired: true,
      order: 3,
    },
    {
      key: 'summit_learning_goal',
      label: 'What specific system or agent do you plan to build?',
      fieldType: 'TEXT' as const,
      options: null,
      isReusable: false,
      isRequired: false,
      order: 4,
    },
  ];

  const fieldDefinitionIds: { id: string; isRequired: boolean; order: number }[] = [];

  for (const def of fieldDefsData) {
    const existing = await prisma.fieldDefinition.findUnique({
      where: { key: def.key },
    });

    let id = existing?.id;
    if (!existing) {
      const created = await prisma.fieldDefinition.create({
        data: {
          key: def.key,
          label: def.label,
          fieldType: def.fieldType,
          options: def.options ? def.options : undefined,
          isReusable: def.isReusable,
          createdByClubId: club.id,
        },
      });
      id = created.id;
      console.log(` Created FieldDefinition: [${def.fieldType}] ${def.label}`);
    } else {
      console.log(` Found existing FieldDefinition: [${def.fieldType}] ${def.label}`);
    }

    fieldDefinitionIds.push({
      id: id!,
      isRequired: def.isRequired,
      order: def.order,
    });
  }

  // 4. Calculate Timestamps
  const now = Date.now();
  const registrationStartTime = new Date(now - 2 * 24 * 60 * 60 * 1000); // 2 days ago (open right now!)
  const registrationEndTime = new Date(now + 14 * 24 * 60 * 60 * 1000); // 14 days in the future
  const eventStartTime = new Date(now + 2 * 24 * 60 * 60 * 1000); // 2 days from now at 10:00 AM
  eventStartTime.setHours(10, 0, 0, 0);
  const eventEndTime = new Date(eventStartTime.getTime() + 8 * 60 * 60 * 1000); // 18:00 PM

  const slug = 'autonomous-ai-summit-2026';
  const title = 'Autonomous AI Systems & Multi-Agent Architecture Summit 2026';

  // Check if event already exists
  let event = await prisma.event.findFirst({
    where: {
      OR: [{ slug }, { title }],
    },
  });

  const description = `### 🚀 Autonomous AI Systems & Multi-Agent Architecture Summit 2026

Join the flagship **NST Developers Club** engineering summit dedicated to building, benchmarking, and operating production-grade Autonomous AI Systems, Multi-Agent Orchestration, and Self-Healing Pipelines.

---

### 📌 Summit Tracks & Architecture Focus
1. **Track 1: Foundations of Agentic Runtime**
   - Formal state machines, deterministic replay, and tool-calling execution loops.
   - Long-term memory stores, episodic context compaction, and multi-tier vector caching.
2. **Track 2: Multi-Agent Teams & Protocol Design**
   - Inter-agent messaging protocols and context boundaries.
   - Guardrails, schema validation, and defensive tool sandbox constraints.
3. **Track 3: Real-Time Hackathon Sprint**
   - 4-hour hands-on challenge: Deploy a full-stack multi-agent system from scratch.
   - Live automated benchmarking, scoring rubrics, and jury evaluation.

---

### 💻 Participant Prerequisites
- Bring your laptop with **Node.js 20+**, **Python 3.11+**, and **Git** installed.
- Active GitHub account with SSH access configured.
- Recommended: Docker Desktop or local PostgreSQL instance.

---

### 🏆 Rewards & Institutional Recognition
- **Official NST Certificate of Excellence** for all verified attendees.
- Top 3 Hackathon projects receive computing credits and automatic inclusion in the **NST Campus Showcase**.
- Fast-track interview access with sponsoring technology partners.`;

  const metadata = {
    banner_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
    short_description: 'Flagship engineering summit on autonomous multi-agent orchestration, resilient tooling, and production LLM workflows.',
    tags: ['AI Agents', 'Autonomous Systems', 'Full-Stack', 'Next.js', 'TypeScript', 'Distributed Systems'],
    speaker: {
      name: 'Dr. Vikramaditya Sen & Senior Staff Engineers',
      title: 'Principal Systems Architect, NST Innovation Labs',
    },
    schedule: [
      { time: '10:00 AM', title: 'Keynote: Architecture of Production Multi-Agent Systems' },
      { time: '11:15 AM', title: 'Deep Dive: Reactive State Machines & Isomorphic Sandbox Safety' },
      { time: '12:30 PM', title: 'Interactive Demo: Tool Calling, Error Trapping & Compaction' },
      { time: '01:30 PM', title: 'Networking Luncheon & Hardware Showcase' },
      { time: '02:30 PM', title: 'Hands-on Hackathon: Deploying Resilient Tool Calling Systems' },
      { time: '05:30 PM', title: 'Live Project Demos, Jury Review & Awards Ceremony' },
    ],
    prerequisites: 'Laptop with Node.js 20+, Python 3.11+, and Git. Open to all students.',
  };

  if (!event) {
    event = await prisma.event.create({
      data: {
        title,
        slug,
        description,
        startTime: eventStartTime,
        endTime: eventEndTime,
        registrationStartTime,
        registrationEndTime,
        locationName: 'Alan Turing Innovation Auditorium, Tech Tower 4, Main Campus',
        state: 'PUBLISHED',
        eventType: 'WORKSHOP',
        visibility: 'PUBLIC',
        isLocked: false,
        registrationType: 'INDIVIDUAL',
        registrationMode: 'REQUIRED',
        registrationCount: 0,
        maxCapacity: 120,
        audience: 'ALL_STUDENTS',
        attendanceType: 'SINGLE',
        metadata,
        creator: { connect: { id: admin.id } },
        eventClubs: {
          create: {
            clubId: club.id,
            isPrimary: true,
          },
        },
      },
    });
    console.log(` Created Event: "${event.title}" (ID: ${event.id})`);
  } else {
    // Update existing event to ensure it has all latest fields and open registration window
    event = await prisma.event.update({
      where: { id: event.id },
      data: {
        title,
        slug,
        description,
        startTime: eventStartTime,
        endTime: eventEndTime,
        registrationStartTime,
        registrationEndTime,
        locationName: 'Alan Turing Innovation Auditorium, Tech Tower 4, Main Campus',
        state: 'PUBLISHED',
        eventType: 'WORKSHOP',
        visibility: 'PUBLIC',
        isLocked: false,
        registrationType: 'INDIVIDUAL',
        registrationMode: 'REQUIRED',
        maxCapacity: 120,
        audience: 'ALL_STUDENTS',
        attendanceType: 'SINGLE',
        metadata,
      },
    });
    console.log(` Updated Event: "${event.title}" (ID: ${event.id})`);
  }

  // 5. Attach Registration Form Fields (formId: null)
  for (const field of fieldDefinitionIds) {
    const existingEff = await prisma.eventFormField.findFirst({
      where: {
        eventId: event.id,
        formId: null,
        fieldDefinitionId: field.id,
      },
    });

    if (!existingEff) {
      await prisma.eventFormField.create({
        data: {
          eventId: event.id,
          formId: null,
          fieldDefinitionId: field.id,
          isRequired: field.isRequired,
          order: field.order,
        },
      });
      console.log(` Attached form field (Order ${field.order}, Required: ${field.isRequired})`);
    } else {
      await prisma.eventFormField.update({
        where: { id: existingEff.id },
        data: {
          isRequired: field.isRequired,
          order: field.order,
        },
      });
      console.log(` Updated form field (Order ${field.order}, Required: ${field.isRequired})`);
    }
  }

  // 6. Also create a post-registration submission EventForm for comprehensive coverage
  let existingForm = await prisma.eventForm.findFirst({
    where: {
      eventId: event.id,
      purpose: 'SUBMISSION',
    },
  });

  if (!existingForm) {
    existingForm = await prisma.eventForm.create({
      data: {
        eventId: event.id,
        title: 'Summit Project Artifact & Repo Submission',
        purpose: 'SUBMISSION',
        releaseAt: new Date(eventStartTime.getTime() + 4 * 60 * 60 * 1000), // releases midway through event
        closeAt: new Date(eventEndTime.getTime() + 2 * 60 * 60 * 1000), // closes 2 hours after event
        publishedAt: new Date(),
      },
    });
    console.log(` Created In-Event Form: "${existingForm.title}" (ID: ${existingForm.id})`);
  }

  console.log('--- Event Creation & Configuration Successfully Completed! ---');
  console.log(`Event ID:   ${event.id}`);
  console.log(`Event Slug: ${event.slug}`);
  console.log(`Web URL:    http://localhost:3000/student/events/${event.id}`);
  console.log(`Public URL: http://localhost:3000/event/${event.slug}`);
  console.log(`Mobile Screen: /(app)/events/${event.id}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error seeding event:', err);
  process.exit(1);
});
