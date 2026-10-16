# Local Test Data & Seeding Guide

This guide describes how to inspect, seed, and manipulate local test data in NST Events without having to reverse-engineer or scan Prisma schema files.

---

## 1. Quick Cheatsheet

| Task | Command / Script |
|---|---|
| **Ensure dev roles on startup** | Automatically run on `pnpm dev` (or `pnpm ensure-dev-roles`) |
| **Promote a user to `PLATFORM_ADMIN`** | `pnpm --filter @nst/database bootstrap-admin -- <email> --yes` |
| **Run full demo seed** (users, clubs, events, registrations) | `pnpm --filter @nst/database db:seed` |
| **Seed rich calendar events** | `pnpm exec ts-node scripts/seed-local-calendar-events.ts` |
| **Add email to Student Directory** | See [One-Liner Scripts](#3-common-one-liner-prisma-scripts) below |
| **Assign Club Admin / Core Member** | See [One-Liner Scripts](#3-common-one-liner-prisma-scripts) below |

---

## 2. Pre-Built CLI & Helper Scripts

### A. Promote a User to Platform Admin
The repository includes a dedicated bootstrap script in `packages/database/scripts/bootstrap-platform-admin.ts`:
```bash
pnpm --filter @nst/database bootstrap-admin -- <email> --yes
```
*Note: The user must exist in the database (or have logged in via Google OAuth once).*

### B. Full Database Re-Seed
Seeds default test users (Arjun, Priya, Dr. Sunita Kapoor, etc.), clubs, memberships, and events:
```bash
pnpm --filter @nst/database db:seed
```

### C. Seed Interactive Calendar Events
Generates realistic upcoming/past events across multiple campus clubs:
```bash
pnpm exec ts-node scripts/seed-local-calendar-events.ts
```

---

## 3. Common One-Liner Prisma Scripts

You can execute targeted modifications against the local database (`localhost:5440`) using quick Node one-liners with `@prisma/client`.

### Add an Email to Student Directory (`authorized_students`)
Allows a student with an institutional `@adypu.edu.in` email to log in and access events:
```bash
node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const email = "student@adypu.edu.in".trim().toLowerCase();
  const res = await prisma.authorizedStudent.upsert({
    where: { normalizedEmail: email },
    update: { status: "ACTIVE" },
    create: { normalizedEmail: email, status: "ACTIVE" },
  });
  console.log("Authorized Student:", res);
  await prisma.$disconnect();
}
run();
'
```

### Pre-Provision a Local User Account
Creates a user account directly without needing a manual Google OAuth sign-in first:
```bash
node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const email = "student@adypu.edu.in";
  const user = await prisma.user.upsert({
    where: { email },
    update: { globalRole: "STUDENT" },
    create: {
      email,
      fullName: "Test Student",
      googleSub: "mock-google-sub-" + Date.now(),
      globalRole: "STUDENT"
    }
  });
  console.log("User provisioned:", user);
  await prisma.$disconnect();
}
run();
'
```

### Assign a User as Club Admin / Core Member
Grants a user management rights over a club and its events:
```bash
node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const userEmail = "student@adypu.edu.in";
  const clubName = "NST Developers Club"; // or any club name
  const role = "CLUB_ADMIN"; // "CLUB_ADMIN" | "CORE_MEMBER" | "MEMBER" | "FACULTY_MENTOR"

  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  const club = await prisma.club.findUnique({ where: { name: clubName } });

  if (!user || !club) {
    console.error("User or club not found");
    return;
  }

  const existing = await prisma.clubMembership.findFirst({
    where: { userId: user.id, clubId: club.id, deletedAt: null }
  });

  if (existing) {
    await prisma.clubMembership.update({ where: { id: existing.id }, data: { role } });
  } else {
    await prisma.clubMembership.create({ data: { userId: user.id, clubId: club.id, role } });
  }

  console.log(`Assigned ${userEmail} as ${role} for ${clubName}`);
  await prisma.$disconnect();
}
run();
'
```

### Register a User for an Event
Registers a student directly into an event:
```bash
node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const userEmail = "student@adypu.edu.in";
  const eventTitle = "Full-Stack Next.js 16 & Turbopack Workshop";

  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  const event = await prisma.event.findFirst({ where: { title: eventTitle, deletedAt: null } });

  if (!user || !event) {
    console.error("User or event not found");
    return;
  }

  const reg = await prisma.eventRegistration.upsert({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    update: { registrationStatus: "REGISTERED", deletedAt: null },
    create: { eventId: event.id, userId: user.id, registrationStatus: "REGISTERED" }
  });

  console.log("Registered user:", reg);
  await prisma.$disconnect();
}
run();
'
```

---

## 4. Key Entities & Enums Reference

| Model | Table | Key Fields | Valid Enum Values |
|---|---|---|---|
| **`AuthorizedStudent`** | `authorized_students` | `normalizedEmail`, `status` | `status`: `'ACTIVE'`, `'REVOKED'` |
| **`User`** | `users` | `email`, `fullName`, `googleSub`, `globalRole` | `globalRole`: `'STUDENT'`, `'FACULTY_MENTOR'`, `'FACULTY_ADMIN'`, `'PLATFORM_ADMIN'` |
| **`Club`** | `clubs` | `name`, `description`, `status` | `status`: `'ACTIVE'`, `'INACTIVE'`, `'DISSOLVED'` |
| **`ClubMembership`** | `club_memberships` | `userId`, `clubId`, `role` | `role`: `'MEMBER'`, `'CORE_MEMBER'`, `'CLUB_ADMIN'`, `'FACULTY_MENTOR'` |
| **`Event`** | `events` | `title`, `startTime`, `endTime`, `state`, `visibility`, `registrationType` | `state`: `'DRAFT'`, `'PENDING_APPROVAL'`, `'PUBLISHED'`, `'ARCHIVED'`, `'CANCELLED'`<br>`visibility`: `'PUBLIC'`, `'RESTRICTED'`<br>`registrationType`: `'INDIVIDUAL'`, `'TEAM'` |
| **`EventRegistration`**| `event_registrations` | `eventId`, `userId`, `registrationStatus` | `registrationStatus`: `'REGISTERED'`, `'WAITLISTED'`, `'CANCELLED'` |
| **`EventForm`** | `event_forms` | `eventId`, `title`, `purpose`, `releaseAt`, `closeAt` | `purpose`: `'REGISTRATION'`, `'SUBMISSION'`, `'FEEDBACK'`, `'CUSTOM'` |
| **`FieldDefinition`** | `field_definitions` | `key`, `label`, `fieldType`, `isReusable` | `fieldType`: `'TEXT'`, `'NUMBER'`, `'EMAIL'`, `'URL'`, `'PHONE'`, `'SELECT'`, `'RADIO'`, `'MULTI_SELECT'` |

---

## 5. Team / Squad Management & Row-Level Security (RLS)

When testing team registration flows, the backend enforces Row-Level Security (`withUserContext(userId)`) on `teams`, `event_registrations`, and `users`.

- Squad members are visible on team rosters (`/student/events/:id/team`) via `event_registrations` with `team_id IS NOT NULL`.
- Teammate names and avatars are visible to fellow squad members and event participants through the `can_see_user_in_team(id)` PostgreSQL security helper function.
- If manual registration of a teammate is needed directly in Postgres for testing:
  ```sql
  -- Add an existing user directly to a squad:
  INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status, participation_role, registered_at)
  VALUES (gen_random_uuid(), '<event_id>', '<user_id>', '<team_id>', 'REGISTERED', 'ATTENDEE', now());
  ```

---

## 6. Non-Negotiable Operational Rules

1. **Database Access**: PostgreSQL runs locally in container `nst-postgres` at `127.0.0.1:5440`. Default connection string:
   ```
   postgresql://postgres:postgres@localhost:5440/nst_events?schema=public
   ```
2. **Never Run Schema Alterations**: Do **not** execute `prisma migrate dev` or `prisma db push`. All migrations and schema definitions are strictly frozen.
3. **Use Prisma Client for Scripts**: Always use `@prisma/client` in temporary scripts or CLI invocations so types and foreign keys are safely validated.
