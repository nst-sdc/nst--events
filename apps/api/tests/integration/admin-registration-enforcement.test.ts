import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { createEvent, updateEvent } from '../../src/modules/events/events.service';
import { registerEvent } from '../../src/modules/registrations/registrations.service';
import { createTeam, joinTeam } from '../../src/modules/teams/teams.service';
import { ForbiddenError, UnprocessableEntityError } from '../../src/lib/errors';
import { randomUUID } from 'crypto';

describe('Admin Registration & Compulsory Registration Window Integration', () => {
  let platformAdminId: string;
  let facultyAdminId: string;
  let clubAdminId: string;
  let studentId: string;
  let studentLeaderId: string;
  let clubId: string;
  let individualEventId: string;
  let teamEventId: string;
  let existingTeamId: string;

  before(async () => {
    // 1. Create Club
    const club = await adminPrisma.club.create({
      data: { name: 'Admin Enforce Club ' + randomUUID(), description: 'Test Club' },
    });
    clubId = club.id;

    // 2. Create Platform Admin
    const pAdmin = await adminPrisma.user.create({
      data: {
        email: `platform_admin_${randomUUID()}@newtonschool.co`,
        googleSub: `sub_padmin_${randomUUID()}`,
        fullName: 'Platform Admin',
        globalRole: 'PLATFORM_ADMIN',
      },
    });
    platformAdminId = pAdmin.id;

    // 3. Create Faculty Admin
    const fAdmin = await adminPrisma.user.create({
      data: {
        email: `faculty_admin_${randomUUID()}@adypu.edu.in`,
        googleSub: `sub_fadmin_${randomUUID()}`,
        fullName: 'Faculty Admin',
        globalRole: 'FACULTY_ADMIN',
      },
    });
    facultyAdminId = fAdmin.id;

    // 4. Create Club Admin
    const cAdmin = await adminPrisma.user.create({
      data: {
        email: `club_admin_${randomUUID()}@adypu.edu.in`,
        googleSub: `sub_cadmin_${randomUUID()}`,
        fullName: 'Club Admin',
        globalRole: 'STUDENT',
      },
    });
    clubAdminId = cAdmin.id;
    await adminPrisma.clubMembership.create({
      data: { userId: clubAdminId, clubId, role: 'CLUB_ADMIN' },
    });

    // 5. Create Eligible Students
    const student = await adminPrisma.user.create({
      data: {
        email: `student_${randomUUID()}@adypu.edu.in`,
        googleSub: `sub_student_${randomUUID()}`,
        fullName: 'Eligible Student',
        globalRole: 'STUDENT',
      },
    });
    studentId = student.id;

    const leader = await adminPrisma.user.create({
      data: {
        email: `leader_${randomUUID()}@adypu.edu.in`,
        googleSub: `sub_leader_${randomUUID()}`,
        fullName: 'Team Leader Student',
        globalRole: 'STUDENT',
      },
    });
    studentLeaderId = leader.id;

    // 6. Create Individual Event (as Platform Admin to test unconstrained organizer workflow)
    const now = Date.now();
    const indEvent = await createEvent(platformAdminId, {
      title: 'Individual Open Event ' + randomUUID(),
      start_time: new Date(now + 3600000),
      end_time: new Date(now + 7200000),
      registration_start_time: new Date(now - 3600000),
      registration_end_time: new Date(now + 1800000),
      event_type: 'WORKSHOP',
      visibility: 'PUBLIC',
      registration_type: 'INDIVIDUAL',
      attendance_type: 'SINGLE',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    individualEventId = indEvent.id;
    await adminPrisma.$executeRaw`UPDATE events SET state = 'PUBLISHED' WHERE id = ${individualEventId}::uuid`;

    // 7. Create Team Event (with valid registration window)
    const tEvent = await createEvent(clubAdminId, {
      title: 'Team Tournament Event ' + randomUUID(),
      start_time: new Date(now + 3600000),
      end_time: new Date(now + 7200000),
      registration_start_time: new Date(now - 3600000),
      registration_end_time: new Date(now + 1800000),
      event_type: 'COMPETITION',
      visibility: 'PUBLIC',
      registration_type: 'TEAM',
      attendance_type: 'SINGLE',
      metadata: { minimum_team_size: 2, maximum_team_size: 4 },
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    teamEventId = tEvent.id;
    await adminPrisma.$executeRaw`UPDATE events SET state = 'PUBLISHED' WHERE id = ${teamEventId}::uuid`;

    // 8. Have student create a team on the team event
    const createdTeam = await createTeam(studentLeaderId, teamEventId, 'Alpha Squad');
    existingTeamId = createdTeam.team_id;
  });

  after(async () => {
    const userIds = [platformAdminId, facultyAdminId, clubAdminId, studentId, studentLeaderId].filter(Boolean);
    const eventIds = [individualEventId, teamEventId].filter(Boolean);

    await adminPrisma.eventRegistration.deleteMany({ where: { eventId: { in: eventIds } } });
    await adminPrisma.team.deleteMany({ where: { eventId: { in: eventIds } } });
    await adminPrisma.eventClub.deleteMany({ where: { eventId: { in: eventIds } } });
    await adminPrisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });
    await adminPrisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await adminPrisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  // -------------------------------------------------------------------------
  // Feature 1: Block administrator accounts from registering for events
  // -------------------------------------------------------------------------
  it('1a. Platform Admin registration attempt is blocked with ForbiddenError', async () => {
    await assert.rejects(
      async () => {
        await registerEvent(platformAdminId, individualEventId);
      },
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.strictEqual(err.message, 'Administrator accounts cannot register for events');
        return true;
      }
    );
  });

  it('1b. Faculty Admin registration attempt is blocked with ForbiddenError', async () => {
    await assert.rejects(
      async () => {
        await registerEvent(facultyAdminId, individualEventId);
      },
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.strictEqual(err.message, 'Administrator accounts cannot register for events');
        return true;
      }
    );
  });

  it('1c. Club Admin registration attempt is blocked with ForbiddenError', async () => {
    await assert.rejects(
      async () => {
        await registerEvent(clubAdminId, individualEventId);
      },
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.strictEqual(err.message, 'Administrator accounts cannot register for events');
        return true;
      }
    );
  });

  it('1d. Platform Admin cannot bypass restriction by creating a team', async () => {
    await assert.rejects(
      async () => {
        await createTeam(platformAdminId, teamEventId, 'Admin Squad');
      },
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.strictEqual(err.message, 'Administrator accounts cannot register for events');
        return true;
      }
    );
  });

  it('1e. Club Admin cannot bypass restriction by creating a team', async () => {
    await assert.rejects(
      async () => {
        await createTeam(clubAdminId, teamEventId, 'Club Admin Squad');
      },
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.strictEqual(err.message, 'Administrator accounts cannot register for events');
        return true;
      }
    );
  });

  it('1f. Platform Admin and Club Admin cannot bypass restriction by joining an existing team', async () => {
    await assert.rejects(
      async () => {
        await joinTeam(platformAdminId, existingTeamId);
      },
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.strictEqual(err.message, 'Administrator accounts cannot register for events');
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await joinTeam(clubAdminId, existingTeamId);
      },
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.strictEqual(err.message, 'Administrator accounts cannot register for events');
        return true;
      }
    );
  });

  it('1g. Normal eligible student account successfully registers for the event', async () => {
    const regResult = await registerEvent(studentId, individualEventId);
    assert.strictEqual(regResult.status, 'REGISTERED');
  });

  // -------------------------------------------------------------------------
  // Feature 2: Compulsory registration windows for Club Admins
  // -------------------------------------------------------------------------
  it('2a. Club Admin cannot create an event without opening time', async () => {
    const now = Date.now();
    await assert.rejects(
      async () => {
        await createEvent(clubAdminId, {
          title: 'Missing Start Reg Window ' + randomUUID(),
          start_time: new Date(now + 3600000),
          end_time: new Date(now + 7200000),
          registration_end_time: new Date(now + 1800000),
          event_type: 'WORKSHOP',
          visibility: 'PUBLIC',
          registration_type: 'INDIVIDUAL',
          attendance_type: 'SINGLE',
          club_ids: [{ club_id: clubId, is_primary: true }],
        });
      },
      (err: any) => {
        assert(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'Registration window (opening and closing date/time) is mandatory for Club Admins');
        return true;
      }
    );
  });

  it('2b. Club Admin cannot create an event without closing time', async () => {
    const now = Date.now();
    await assert.rejects(
      async () => {
        await createEvent(clubAdminId, {
          title: 'Missing End Reg Window ' + randomUUID(),
          start_time: new Date(now + 3600000),
          end_time: new Date(now + 7200000),
          registration_start_time: new Date(now - 3600000),
          event_type: 'WORKSHOP',
          visibility: 'PUBLIC',
          registration_type: 'INDIVIDUAL',
          attendance_type: 'SINGLE',
          club_ids: [{ club_id: clubId, is_primary: true }],
        });
      },
      (err: any) => {
        assert(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'Registration window (opening and closing date/time) is mandatory for Club Admins');
        return true;
      }
    );
  });

  it('2c. Club Admin cannot create an event with reversed registration window (close <= open)', async () => {
    const now = Date.now();
    await assert.rejects(
      async () => {
        await createEvent(clubAdminId, {
          title: 'Reversed Reg Window ' + randomUUID(),
          start_time: new Date(now + 3600000),
          end_time: new Date(now + 7200000),
          registration_start_time: new Date(now + 1800000),
          registration_end_time: new Date(now - 3600000),
          event_type: 'WORKSHOP',
          visibility: 'PUBLIC',
          registration_type: 'INDIVIDUAL',
          attendance_type: 'SINGLE',
          club_ids: [{ club_id: clubId, is_primary: true }],
        });
      },
      (err: any) => {
        assert(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'Registration closing time must be later than opening time');
        return true;
      }
    );
  });

  it('2d. Club Admin cannot edit an event to clear registration window', async () => {
    await assert.rejects(
      async () => {
        await updateEvent(clubAdminId, teamEventId, {
          registration_start_time: null as any,
          registration_end_time: null as any,
        });
      },
      (err: any) => {
        assert(err instanceof UnprocessableEntityError);
        assert(
          err.message === 'Registration window (opening and closing date/time) is mandatory for Club Admins' ||
          err.message === 'Published events in REQUIRED registration mode must have a valid registration window'
        );
        return true;
      }
    );
  });

  it('2e. Platform Admin can create an event without registration window (organizer workflows preserved)', async () => {
    const now = Date.now();
    const adminEvent = await createEvent(platformAdminId, {
      title: 'Platform Internal Assembly ' + randomUUID(),
      start_time: new Date(now + 86400000),
      end_time: new Date(now + 90000000),
      event_type: 'SEMINAR',
      visibility: 'PUBLIC',
      registration_type: 'INDIVIDUAL',
      attendance_type: 'SINGLE',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    assert(adminEvent.id);
    await adminPrisma.eventClub.deleteMany({ where: { eventId: adminEvent.id } });
    await adminPrisma.event.delete({ where: { id: adminEvent.id } });
  });
});
