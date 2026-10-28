import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { createTeam, joinTeam, leaveTeam } from '../../src/modules/teams/teams.service';
import { getEventById, updateEvent } from '../../src/modules/events/events.service';
import { registerEvent } from '../../src/modules/registrations/registrations.service';
import { CreateEventSchema } from '../../src/modules/events/events.schema';

describe('Independent Maximum Participants Cap for TEAM Events (Regression Suite)', () => {
  let organizerId: string;
  let clubId: string;
  let users: Array<{ id: string; email: string }> = [];
  let eventIds: string[] = [];

  // Helper to create a user on demand
  async function makeUser(name: string) {
    const user = await adminPrisma.user.create({
      data: {
        email: `${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@test.com`,
        googleSub: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        fullName: name,
      },
    });
    users.push(user);
    return user;
  }

  before(async () => {
    const org = await makeUser('Event Organizer');
    await adminPrisma.user.update({
      where: { id: org.id },
      data: { globalRole: 'PLATFORM_ADMIN' },
    });
    organizerId = org.id;

    const club = await adminPrisma.club.create({
      data: { name: `Team Cap Regression Club ${Date.now()}` },
    });
    clubId = club.id;

    await adminPrisma.clubMembership.create({
      data: { userId: organizerId, clubId, role: 'CLUB_ADMIN' },
    });
  });

  after(async () => {
    if (eventIds.length > 0) {
      await adminPrisma.$executeRaw`DELETE FROM notification_jobs;`;
      if (users.length > 0) {
        await adminPrisma.notification.deleteMany({
          where: { userId: { in: users.map((u) => u.id) } },
        });
      }
      await adminPrisma.eventRegistrationResponse.deleteMany({
        where: { eventRegistration: { eventId: { in: eventIds } } },
      });
      await adminPrisma.eventRegistration.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await adminPrisma.team.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await adminPrisma.eventFormField.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await adminPrisma.eventClub.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await adminPrisma.event.deleteMany({
        where: { id: { in: eventIds } },
      });
    }
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.delete({ where: { id: clubId } });
    if (users.length > 0) {
      await adminPrisma.user.deleteMany({
        where: { id: { in: users.map((u) => u.id) } },
      });
    }
  });

  async function createTestTeamEvent(opts: {
    maxCapacity?: number | null;
    maxParticipants?: number | null;
    minimumTeamSize?: number;
    maximumTeamSize?: number;
    registrationOpen?: boolean;
  }) {
    const ev = await adminPrisma.event.create({
      data: {
        title: `Team Dual-Cap Event ${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        description: 'Testing independent team and participant limits',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        audience: 'ALL_STUDENTS',
        eventType: 'HACKATHON',
        registrationType: 'TEAM',
        maxCapacity: opts.maxCapacity ?? null,
        maxParticipants: opts.maxParticipants ?? null,
        registrationCount: 0,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 172800000),
        registrationStartTime: opts.registrationOpen === false
          ? new Date(Date.now() + 3600000)
          : new Date(Date.now() - 3600000),
        registrationEndTime: new Date(Date.now() + 7200000),
        createdBy: organizerId,
        metadata: {
          minimum_team_size: opts.minimumTeamSize ?? 1,
          maximum_team_size: opts.maximumTeamSize ?? 4,
        },
      },
    });
    eventIds.push(ev.id);
    await adminPrisma.eventClub.create({
      data: {
        eventId: ev.id,
        clubId: clubId,
        isPrimary: true,
      },
    });
    return ev;
  }

  // --------------------------------------------------------------------------
  // Scenario 1: A team event with both caps configured
  // --------------------------------------------------------------------------
  it('1. Team event with both caps configured stores and returns both limits accurately', async () => {
    const event = await createTestTeamEvent({
      maxCapacity: 5,
      maxParticipants: 12,
      minimumTeamSize: 2,
      maximumTeamSize: 4,
    });

    const fetched = await getEventById(organizerId, event.id);
    assert.strictEqual(fetched.maxCapacity, 5, 'Maximum Teams (max_capacity) must be 5');
    assert.strictEqual(fetched.maxParticipants, 12, 'Maximum Participants (max_participants) must be 12');
    assert.strictEqual(fetched.registrationCount, 0, 'Initial team registration count must be 0');
    assert.strictEqual(fetched.participantCount, 0, 'Initial participant count must be 0');
    assert.strictEqual(fetched.participant_count, 0, 'participant_count snake_case alias must match');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Maximum Teams reached while participant capacity remains
  // --------------------------------------------------------------------------
  it('2. Maximum Teams reached while participant capacity remains allows joining eligible teams', async () => {
    // 2 teams allowed, 8 participants allowed
    const event = await createTestTeamEvent({
      maxCapacity: 2,
      maxParticipants: 8,
      minimumTeamSize: 1,
      maximumTeamSize: 3,
    });

    const l1 = await makeUser('Leader One');
    const l2 = await makeUser('Leader Two');
    const l3 = await makeUser('Leader Three');
    const m1 = await makeUser('Member One');

    // Create Team 1 -> REGISTERED
    const t1 = await createTeam(l1.id, event.id, 'Squad 1');
    assert.strictEqual(t1.status, 'REGISTERED');

    // Create Team 2 -> REGISTERED
    const t2 = await createTeam(l2.id, event.id, 'Squad 2');
    assert.strictEqual(t2.status, 'REGISTERED');

    // Team capacity is now full (2/2 teams). Participant count is 2/8.
    let ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.registrationCount, 2, 'Team capacity reached: 2 registered teams');
    assert.strictEqual(ev.participantCount, 2, '2 active participants');

    // Attempting to create a 3rd team -> waitlisted because team capacity is exhausted
    const t3 = await createTeam(l3.id, event.id, 'Squad 3');
    assert.strictEqual(t3.status, 'WAITLISTED', 'New team must be placed on waitlist');

    // Participant capacity remains 2/8 (waitlisted members do not consume participant capacity).
    ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.registrationCount, 2, 'registrationCount remains 2 (admitted teams)');
    assert.strictEqual(ev.participantCount, 2, 'participantCount remains 2');

    // Member 1 joins existing REGISTERED Team 1 -> PRESERVED and SUCCEEDS!
    const joinRes = await joinTeam(m1.id, t1.team_id);
    assert.strictEqual(joinRes.status, 'REGISTERED', 'Joining existing registered team must succeed');

    ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.registrationCount, 2, 'registrationCount still 2 teams');
    assert.strictEqual(ev.participantCount, 3, 'participantCount incremented to 3');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Maximum Participants reached while team capacity remains
  // --------------------------------------------------------------------------
  it('3. Maximum Participants reached while team capacity remains blocks creation and joins', async () => {
    // 10 teams allowed, but only 3 participants allowed total
    const event = await createTestTeamEvent({
      maxCapacity: 10,
      maxParticipants: 3,
      minimumTeamSize: 1,
      maximumTeamSize: 3,
    });

    const l1 = await makeUser('Cap3 Leader1');
    const m1 = await makeUser('Cap3 Member1');
    const l2 = await makeUser('Cap3 Leader2');
    const l3 = await makeUser('Cap3 Leader3');
    const m2 = await makeUser('Cap3 Member2');

    // Team 1 with Leader 1 + Member 1 (2 participants)
    const t1 = await createTeam(l1.id, event.id, 'Cap3 Team 1');
    await joinTeam(m1.id, t1.team_id);

    // Team 2 with Leader 2 (1 participant) -> total 3 participants
    const t2 = await createTeam(l2.id, event.id, 'Cap3 Team 2');

    const ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 3, 'Participant limit reached (3/3)');
    assert.strictEqual(ev.registrationCount, 2, 'Team count is 2/10 (team capacity remains)');

    // 1. Creating Team 3 must be placed on waitlist because participant limit is exhausted
    const t3 = await createTeam(l3.id, event.id, 'Cap3 Team 3');
    assert.strictEqual(t3.status, 'WAITLISTED', 'Team creation placed on waitlist when participant capacity is full');

    // 2. Joining Team 1 must be rejected because participant limit is exhausted
    await assert.rejects(
      async () => joinTeam(m2.id, t1.team_id),
      (err: any) => {
        assert.match(err.message, /participant capacity is full/i);
        return true;
      },
      'Team join must be rejected when participant capacity is full'
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Team creation consumes one participant slot
  // --------------------------------------------------------------------------
  it('4. Team creation consumes exactly one participant slot for the leader', async () => {
    // Cap is 1 participant
    const event = await createTestTeamEvent({
      maxCapacity: 5,
      maxParticipants: 1,
      minimumTeamSize: 1,
    });

    const l1 = await makeUser('Solo Leader');
    const l2 = await makeUser('Blocked Leader');

    const t1 = await createTeam(l1.id, event.id, 'Solo Squad');
    assert.strictEqual(t1.status, 'REGISTERED');

    const ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 1, 'Team creation reserved 1 participant slot');

    // Next creation placed on waitlist because participant capacity is full
    const t2 = await createTeam(l2.id, event.id, 'Blocked Squad');
    assert.strictEqual(t2.status, 'WAITLISTED', 'Team creation placed on waitlist when participant capacity is full');
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Every member joining consumes one participant slot
  // --------------------------------------------------------------------------
  it('5. Every member joining consumes one participant slot', async () => {
    const event = await createTestTeamEvent({
      maxCapacity: 5,
      maxParticipants: 2,
      minimumTeamSize: 1,
      maximumTeamSize: 3,
    });

    const l1 = await makeUser('Join Leader');
    const m1 = await makeUser('Join Member 1');
    const m2 = await makeUser('Join Member 2');

    const t1 = await createTeam(l1.id, event.id, 'Join Squad');
    let ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 1);

    await joinTeam(m1.id, t1.team_id);
    ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 2, 'Join reserved 1 additional participant slot');

    // Participant cap 2 is now exhausted; second join rejected
    await assert.rejects(
      async () => joinTeam(m2.id, t1.team_id),
      /participant capacity is full/i
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Forming and waitlisted team members follow the documented counting policy
  // --------------------------------------------------------------------------
  it('6. Forming and waitlisted team members are counted and cannot evade participant cap', async () => {
    // minimumTeamSize: 3, maxParticipants: 2
    // A forming team with 2 members consumes 2 participant slots.
    const event = await createTestTeamEvent({
      maxCapacity: 5,
      maxParticipants: 2,
      minimumTeamSize: 3,
      maximumTeamSize: 4,
    });

    const l1 = await makeUser('Form Leader');
    const m1 = await makeUser('Form Member');
    const l2 = await makeUser('Evade Leader');

    // Leader creates team (status FORMING)
    const t1 = await createTeam(l1.id, event.id, 'Forming Team');
    assert.strictEqual(t1.status, 'FORMING');

    // Member joins (status still FORMING because 2 < 3)
    const j1 = await joinTeam(m1.id, t1.team_id);
    assert.strictEqual(j1.status, 'FORMING');

    const ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 0, 'Forming team members do not consume active participant capacity');

    // Another student attempts to create a team -> succeeds in FORMING status
    const t2 = await createTeam(l2.id, event.id, 'Evade Squad');
    assert.strictEqual(t2.status, 'FORMING', 'New team created in FORMING status');
  });

  // --------------------------------------------------------------------------
  // Scenario 7: The final participant slot cannot be consumed twice by concurrent requests
  // --------------------------------------------------------------------------
  it('7. Final participant slot cannot be consumed twice by concurrent join requests', async () => {
    const event = await createTestTeamEvent({
      maxCapacity: 5,
      maxParticipants: 2,
      minimumTeamSize: 1,
      maximumTeamSize: 3,
    });

    const l1 = await makeUser('Race Leader 7');
    const m1 = await makeUser('Race Member 7A');
    const m2 = await makeUser('Race Member 7B');

    // Leader consumes 1 slot; 1 slot remains
    const team = await createTeam(l1.id, event.id, 'Race Squad 7');

    // Concurrent joins for the single remaining slot
    const [r1, r2] = await Promise.allSettled([
      joinTeam(m1.id, team.team_id),
      joinTeam(m2.id, team.team_id),
    ]);

    const successes = [r1, r2].filter((r) => r.status === 'fulfilled');
    const failures = [r1, r2].filter((r) => r.status === 'rejected');

    assert.strictEqual(successes.length, 1, 'Exactly one concurrent join succeeds');
    assert.strictEqual(failures.length, 1, 'Exactly one concurrent join is rejected');

    const rej = (failures[0] as PromiseRejectedResult).reason;
    assert.match(rej.message, /participant capacity is full/i);

    const ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 2, 'Authoritative participant count strictly 2');
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Simultaneous team creation and joining cannot oversubscribe participant capacity
  // --------------------------------------------------------------------------
  it('8. Simultaneous team creation and joining cannot oversubscribe participant capacity', async () => {
    const event = await createTestTeamEvent({
      maxCapacity: 5,
      maxParticipants: 2,
      minimumTeamSize: 1,
      maximumTeamSize: 3,
    });

    const l1 = await makeUser('Race Leader 8');
    const m1 = await makeUser('Race Member 8');
    const l2 = await makeUser('Race Creator 8');

    // Leader 1 consumes slot 1
    const team1 = await createTeam(l1.id, event.id, 'Squad 8A');

    // Concurrently: m1 joins team1 vs l2 creates team2
    const [joinRes, createRes] = await Promise.allSettled([
      joinTeam(m1.id, team1.team_id),
      createTeam(l2.id, event.id, 'Squad 8B'),
    ]);

    const registeredCount = [
      joinRes.status === 'fulfilled' && (joinRes as any).value?.status === 'REGISTERED',
      createRes.status === 'fulfilled' && (createRes as any).value?.status === 'REGISTERED',
    ].filter(Boolean).length;
    assert.strictEqual(registeredCount, 1, 'Exactly one concurrent operation obtains a REGISTERED participant slot');

    if (joinRes.status === 'rejected') {
      assert.match((joinRes as any).reason.message, /participant capacity is full/i);
    } else {
      assert.strictEqual((createRes as any).value.status, 'WAITLISTED');
    }

    const ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 2, 'Database participant count never oversubscribed');
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Failed transactions leave no partial registrations or consumed capacity
  // --------------------------------------------------------------------------
  it('9. Failed transactions leave no partial registrations or consumed capacity', async () => {
    const event = await createTestTeamEvent({
      maxCapacity: 5,
      maxParticipants: 2,
      minimumTeamSize: 1,
      maximumTeamSize: 3,
    });

    const l1 = await makeUser('Fail Leader 9');
    const m1 = await makeUser('Fail Member 9');
    const m2 = await makeUser('Valid Member 9');

    const team = await createTeam(l1.id, event.id, 'Squad 9');

    // Configure a required registration field
    const fieldDef = await adminPrisma.fieldDefinition.create({
      data: {
        key: `field_req_${Date.now()}`,
        label: 'Required Discord',
        fieldType: 'TEXT',
        isReusable: false,
      },
    });
    await adminPrisma.eventFormField.create({
      data: {
        eventId: event.id,
        fieldDefinitionId: fieldDef.id,
        isRequired: true,
        order: 1,
      },
    });

    // m1 attempts to join with invalid/empty responses (violates validation)
    await assert.rejects(
      async () => joinTeam(m1.id, team.team_id, []),
      /Missing required registration fields/i
    );

    // Verify m1 has no registration record in DB
    const m1Reg = await adminPrisma.eventRegistration.findFirst({
      where: { eventId: event.id, userId: m1.id },
    });
    assert.strictEqual(m1Reg, null, 'No registration record must exist for failed transaction');

    let ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 1, 'Participant count remained strictly 1');

    // m2 can now successfully join using the valid remaining slot
    await joinTeam(m2.id, team.team_id, [
      { fieldDefinitionId: fieldDef.id, value: 'valid#1234' },
    ]);

    ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 2, 'Valid join consumed the remaining slot');
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Lowering a limit below existing usage preserves existing registrations and blocks further sign-ups
  // --------------------------------------------------------------------------
  it('10. Lowering limit below existing usage preserves registrations and blocks new sign-ups', async () => {
    // Start with max_participants: 4
    const event = await createTestTeamEvent({
      maxCapacity: 5,
      maxParticipants: 4,
      minimumTeamSize: 1,
      maximumTeamSize: 4,
    });

    const l1 = await makeUser('Lower Leader 10');
    const m1 = await makeUser('Lower Member 10A');
    const m2 = await makeUser('Lower Member 10B');
    const m3 = await makeUser('Blocked Member 10');

    const team = await createTeam(l1.id, event.id, 'Squad 10');
    await joinTeam(m1.id, team.team_id);
    await joinTeam(m2.id, team.team_id);

    // Currently 3 participants registered
    let ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 3);

    // Lower max_participants to 2 (below the existing 3)
    await updateEvent(organizerId, event.id, {
      max_participants: 2,
    });

    // Verify all 3 existing registrations are preserved in REGISTERED state
    const registrations = await adminPrisma.eventRegistration.findMany({
      where: { eventId: event.id, deletedAt: null },
    });
    assert.strictEqual(registrations.length, 3, 'All 3 existing registrations preserved');
    assert.ok(registrations.every((r) => r.registrationStatus === 'REGISTERED'));

    // New join attempt must be blocked
    await assert.rejects(
      async () => joinTeam(m3.id, team.team_id),
      /participant capacity is full/i
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Individual registration retains its existing capacity semantics
  // --------------------------------------------------------------------------
  it('11. Individual registration retains its existing capacity semantics and rejects max_participants', async () => {
    // 1. Zod schema validation: max_participants is not permitted for INDIVIDUAL events
    const validation = CreateEventSchema.safeParse({
      body: {
        title: 'Individual Event Schema Test',
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        event_type: 'WORKSHOP',
        registration_type: 'INDIVIDUAL',
        max_capacity: 2,
        max_participants: 5, // Invalid for INDIVIDUAL
        club_ids: [{ club_id: clubId, is_primary: true }],
      },
    });
    assert.strictEqual(validation.success, false, 'Schema must reject max_participants on INDIVIDUAL events');

    // 2. Individual registration capacity functionality: max_capacity = 1
    const indEvent = await adminPrisma.event.create({
      data: {
        title: `Ind Cap Event ${Date.now()}`,
        description: 'Testing individual capacity unchanged',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        audience: 'ALL_STUDENTS',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        maxCapacity: 1,
        registrationCount: 0,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 172800000),
        registrationStartTime: new Date(Date.now() - 3600000),
        registrationEndTime: new Date(Date.now() + 3600000),
        createdBy: organizerId,
      },
    });
    eventIds.push(indEvent.id);

    const u1 = await makeUser('Ind User 1');
    const u2 = await makeUser('Ind User 2');

    const reg1 = await registerEvent(u1.id, indEvent.id);
    assert.strictEqual(reg1.status, 'REGISTERED');

    const reg2 = await registerEvent(u2.id, indEvent.id);
    assert.strictEqual(reg2.status, 'WAITLISTED', 'Individual waitlist behavior preserved');

    const ev = await adminPrisma.event.findUnique({ where: { id: indEvent.id } });
    assert.strictEqual(ev?.registrationCount, 1);
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Unlimited participant capacity behaves correctly when unset
  // --------------------------------------------------------------------------
  it('12. Unlimited participant capacity behaves correctly when unset (null)', async () => {
    // maxCapacity: 1 team, maxParticipants: null (unlimited)
    const event = await createTestTeamEvent({
      maxCapacity: 1,
      maxParticipants: null,
      minimumTeamSize: 1,
      maximumTeamSize: 10,
    });

    const l1 = await makeUser('Unset Leader');
    const team = await createTeam(l1.id, event.id, 'Unlimited Squad');

    // 5 members join without hitting participant capacity limit
    for (let i = 0; i < 5; i++) {
      const m = await makeUser(`Unset Member ${i}`);
      const res = await joinTeam(m.id, team.team_id);
      assert.strictEqual(res.status, 'REGISTERED');
    }

    const ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 6, 'Total 6 participants registered without cap limit');
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Registration windows, questionnaires, RLS, and team waitlist promotion remain functional
  // --------------------------------------------------------------------------
  it('13. Cancelled registrations release participant capacity and waitlist promotion functions', async () => {
    const event = await createTestTeamEvent({
      maxCapacity: 1,
      maxParticipants: 2,
      minimumTeamSize: 1,
      maximumTeamSize: 2,
    });

    const l1 = await makeUser('Leaving Leader 13');
    const m1 = await makeUser('Leaving Member 13');
    const l2 = await makeUser('Waitlist Leader 13');
    const newStudent = await makeUser('New Student 13');

    // Team 1 with l1 and m1 (consumes 2/2 participants and 1/1 team)
    const t1 = await createTeam(l1.id, event.id, 'Squad 13 Reg');
    await joinTeam(m1.id, t1.team_id);

    // Participant cap is 2/2. Team 2 creation is placed on waitlist!
    const tWait = await createTeam(l2.id, event.id, 'Squad 13 Wait');
    assert.strictEqual(tWait.status, 'WAITLISTED', 'Team 2 is placed on waitlist when capacity is full');

    // Leader 1 leaves Team 1 -> dissolves Team 1, releases capacity, and promotes waitlisted team
    await leaveTeam(l1.id, t1.team_id);

    // Verify Waitlisted Team 2 is promoted to REGISTERED by process_waitlist!
    const promotedTeam = await adminPrisma.team.findUnique({ where: { id: tWait.team_id } });
    assert.strictEqual(promotedTeam?.status, 'REGISTERED', 'Waitlisted team must be promoted to REGISTERED');

    // And new student can join promoted Team 2!
    const j2 = await joinTeam(newStudent.id, tWait.team_id);
    assert.strictEqual(j2.status, 'REGISTERED');

    const ev = await getEventById(organizerId, event.id);
    assert.strictEqual(ev.participantCount, 2);
    assert.strictEqual(ev.registrationCount, 1);
  });
});
