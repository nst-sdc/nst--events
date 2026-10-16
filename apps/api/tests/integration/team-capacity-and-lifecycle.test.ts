import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { createTeam, joinTeam, leaveTeam } from '../../src/modules/teams/teams.service';
import { getMyRegistrationStatus, registerEvent } from '../../src/modules/registrations/registrations.service';
import { validateFieldValue } from '../../src/utils/form-validation';

describe('Team Capacity, Concurrency & Lifecycle Edge Cases', () => {
  let organizerId: string;
  let leaderAId: string;
  let leaderBId: string;
  let member1Id: string;
  let member2Id: string;
  let clubId: string;
  let eventIds: string[] = [];

  before(async () => {
    const org = await adminPrisma.user.create({
      data: { email: `org_cap_${Date.now()}@test.com`, googleSub: `sub_cap_org_${Date.now()}`, fullName: 'Org Cap' },
    });
    organizerId = org.id;

    const lA = await adminPrisma.user.create({
      data: { email: `leaderA_cap_${Date.now()}@test.com`, googleSub: `sub_la_${Date.now()}`, fullName: 'Leader A' },
    });
    leaderAId = lA.id;

    const lB = await adminPrisma.user.create({
      data: { email: `leaderB_cap_${Date.now()}@test.com`, googleSub: `sub_lb_${Date.now()}`, fullName: 'Leader B' },
    });
    leaderBId = lB.id;

    const m1 = await adminPrisma.user.create({
      data: { email: `member1_cap_${Date.now()}@test.com`, googleSub: `sub_m1_${Date.now()}`, fullName: 'Member 1' },
    });
    member1Id = m1.id;

    const m2 = await adminPrisma.user.create({
      data: { email: `member2_cap_${Date.now()}@test.com`, googleSub: `sub_m2_${Date.now()}`, fullName: 'Member 2' },
    });
    member2Id = m2.id;

    const club = await adminPrisma.club.create({
      data: { name: `Cap Test Club ${Date.now()}` },
    });
    clubId = club.id;

    await adminPrisma.clubMembership.create({
      data: { userId: organizerId, clubId, role: 'CLUB_ADMIN' },
    });
  });

  after(async () => {
    if (eventIds.length > 0) {
      await adminPrisma.$executeRaw`DELETE FROM notification_jobs;`;
      await adminPrisma.notification.deleteMany({ where: { userId: { in: [organizerId, leaderAId, leaderBId, member1Id, member2Id] } } });
      await adminPrisma.eventRegistrationResponse.deleteMany({ where: { eventRegistration: { eventId: { in: eventIds } } } });
      await adminPrisma.eventRegistration.deleteMany({ where: { eventId: { in: eventIds } } });
      await adminPrisma.team.deleteMany({ where: { eventId: { in: eventIds } } });
      await adminPrisma.eventClub.deleteMany({ where: { eventId: { in: eventIds } } });
      await adminPrisma.event.deleteMany({ where: { id: { in: eventIds } } });
    }
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.delete({ where: { id: clubId } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [organizerId, leaderAId, leaderBId, member1Id, member2Id] } } });
  });

  async function createTeamEvent(overrides: {
    maxCapacity?: number | null;
    minimumTeamSize?: number;
    maximumTeamSize?: number;
  }) {
    const ev = await adminPrisma.event.create({
      data: {
        title: `Team Cap Event ${Date.now()}`,
        description: 'Testing team capacity and lifecycle',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        audience: 'ALL_STUDENTS',
        eventType: 'HACKATHON',
        registrationType: 'TEAM',
        maxCapacity: overrides.maxCapacity ?? null,
        registrationCount: 0,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 172800000),
        registrationStartTime: new Date(Date.now() - 3600000),
        registrationEndTime: new Date(Date.now() + 3600000),
        createdBy: organizerId,
        metadata: {
          minimum_team_size: overrides.minimumTeamSize ?? 2,
          maximum_team_size: overrides.maximumTeamSize ?? 3,
        },
      },
    });
    eventIds.push(ev.id);
    return ev;
  }

  it('1. Returns status FORMING and waitlist_position null for forming team members', async () => {
    const event = await createTeamEvent({ minimumTeamSize: 2 });
    const team = await createTeam(leaderAId, event.id, 'Alpha Squad');
    assert.strictEqual(team.status, 'FORMING');

    const status = await getMyRegistrationStatus(leaderAId, event.id);
    assert.strictEqual(status.status, 'FORMING', 'Forming team must return FORMING status');
    assert.strictEqual(status.waitlist_position, null, 'Forming team must NOT have a waitlist position');
  });

  it('2. Enforces team capacity: second team becomes WAITLISTED when capacity is 1', async () => {
    // minimum_team_size = 1 so team registers immediately on creation
    const event = await createTeamEvent({ maxCapacity: 1, minimumTeamSize: 1 });

    const team1 = await createTeam(leaderAId, event.id, 'Team 1');
    assert.strictEqual(team1.status, 'REGISTERED');

    const team2 = await createTeam(leaderBId, event.id, 'Team 2');
    assert.strictEqual(team2.status, 'WAITLISTED');

    const ev = await adminPrisma.event.findUnique({ where: { id: event.id } });
    assert.strictEqual(ev?.registrationCount, 1, 'registrationCount must not exceed 1');

    const status2 = await getMyRegistrationStatus(leaderBId, event.id);
    assert.strictEqual(status2.status, 'WAITLISTED');
    assert.strictEqual(status2.waitlist_position, 1, 'First waitlisted team has position 1');
  });

  it('3. Concurrent team join race for the last member slot (maximum_team_size: 2)', async () => {
    // Leader creates team (size 1)
    const event = await createTeamEvent({ minimumTeamSize: 1, maximumTeamSize: 2 });
    const team = await createTeam(leaderAId, event.id, 'Max Race Team');

    // Both member1 and member2 try to join concurrently for the single remaining slot
    const joinAttempts = await Promise.allSettled([
      joinTeam(member1Id, team.team_id),
      joinTeam(member2Id, team.team_id),
    ]);

    const successes = joinAttempts.filter((r) => r.status === 'fulfilled');
    const failures = joinAttempts.filter((r) => r.status === 'rejected');

    assert.strictEqual(successes.length, 1, 'Exactly 1 join attempt must succeed');
    assert.strictEqual(failures.length, 1, 'Exactly 1 join attempt must be rejected');

    const rejectedReason = (failures[0] as PromiseRejectedResult).reason;
    assert.match(rejectedReason.message, /Team is full/i);

    const membersInDb = await adminPrisma.eventRegistration.count({
      where: { teamId: team.team_id, deletedAt: null },
    });
    assert.strictEqual(membersInDb, 2, 'Total active members in DB must strictly equal maximum_team_size (2)');
  });

  it('4. Leader leaving dissolves the team, releases capacity, and promotes waitlisted team', async () => {
    const event = await createTeamEvent({ maxCapacity: 1, minimumTeamSize: 1 });

    const registeredTeam = await createTeam(leaderAId, event.id, 'Reg Team');
    assert.strictEqual(registeredTeam.status, 'REGISTERED');

    const waitlistedTeam = await createTeam(leaderBId, event.id, 'Wait Team');
    assert.strictEqual(waitlistedTeam.status, 'WAITLISTED');

    // Leader A leaves Reg Team -> dissolves team
    await leaveTeam(leaderAId, registeredTeam.team_id);

    // Verify Reg Team is cancelled in DB
    const dissolvedTeam = await adminPrisma.team.findUnique({ where: { id: registeredTeam.team_id } });
    assert.strictEqual(dissolvedTeam?.status, 'CANCELLED');

    // Verify Wait Team is promoted to REGISTERED
    const promotedTeam = await adminPrisma.team.findUnique({ where: { id: waitlistedTeam.team_id } });
    assert.strictEqual(promotedTeam?.status, 'REGISTERED');

    // Event capacity remains exactly 1
    const ev = await adminPrisma.event.findUnique({ where: { id: event.id } });
    assert.strictEqual(ev?.registrationCount, 1);
  });

  it('5. Rejects questionnaire responses exceeding 5,000 characters with BadRequestError', () => {
    const fieldDef = { fieldType: 'TEXT', label: 'Biography' };
    const oversizedValue = 'A'.repeat(5001);

    assert.throws(
      () => validateFieldValue(fieldDef, oversizedValue),
      /exceeds maximum allowed length of 5000 characters/i
    );
  });

  async function createIndividualEvent(overrides: { maxCapacity?: number | null } = {}) {
    const ev = await adminPrisma.event.create({
      data: {
        title: `Ind Cap Event ${Date.now()}`,
        description: 'Testing individual capacity race',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        audience: 'ALL_STUDENTS',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        maxCapacity: overrides.maxCapacity ?? 1,
        registrationCount: 0,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 172800000),
        registrationStartTime: new Date(Date.now() - 3600000),
        registrationEndTime: new Date(Date.now() + 3600000),
        createdBy: organizerId,
      },
    });
    eventIds.push(ev.id);
    return ev;
  }

  it('6. Two team creations competing for the last available team slot (concurrency)', async () => {
    // TEAM event with capacity: 1, minimum_team_size: 1 (so minimum met immediately on creation)
    const event = await createTeamEvent({ maxCapacity: 1, minimumTeamSize: 1 });

    // Both Leader A and Leader B attempt to create their teams concurrently
    const results = await Promise.allSettled([
      createTeam(leaderAId, event.id, 'Squad Alpha Race'),
      createTeam(leaderBId, event.id, 'Squad Beta Race'),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    assert.strictEqual(successes.length, 2, 'Both team creation calls succeed without database deadlock');

    const statuses = results.map((r) => ((r as PromiseFulfilledResult<any>).value as any).status);
    assert.ok(statuses.includes('REGISTERED'), 'Exactly one team must win the confirmed REGISTERED seat');
    assert.ok(statuses.includes('WAITLISTED'), 'The other team must be safely WAITLISTED');

    // Confirm authoritative database state
    const ev = await adminPrisma.event.findUnique({ where: { id: event.id } });
    assert.strictEqual(ev?.registrationCount, 1, 'Final database registrationCount must strictly equal 1 (capacity cap preserved)');
  });

  it('7. Two individual registrations competing for the last participant slot (concurrency)', async () => {
    // INDIVIDUAL event with capacity: 1
    const event = await createIndividualEvent({ maxCapacity: 1 });

    // Both Member 1 and Member 2 attempt to register concurrently for the single remaining seat
    const results = await Promise.allSettled([
      registerEvent(member1Id, event.id),
      registerEvent(member2Id, event.id),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    assert.strictEqual(successes.length, 2, 'Both registration transactions complete without deadlock');

    const regStatuses = results.map((r) => ((r as PromiseFulfilledResult<any>).value as any).status);
    assert.strictEqual(regStatuses.filter((s) => s === 'REGISTERED').length, 1, 'Exactly one student gets REGISTERED');
    assert.strictEqual(regStatuses.filter((s) => s === 'WAITLISTED').length, 1, 'Exactly one student gets WAITLISTED');

    // Confirm database state
    const ev = await adminPrisma.event.findUnique({ where: { id: event.id } });
    assert.strictEqual(ev?.registrationCount, 1, 'Final database registrationCount must strictly equal 1');

    const registeredRows = await adminPrisma.eventRegistration.count({
      where: { eventId: event.id, registrationStatus: 'REGISTERED', deletedAt: null },
    });
    assert.strictEqual(registeredRows, 1, 'Confirmed database registrations must not exceed 1');
  });

  it('8. Cross-flow concurrency: Individual registration racing with team creation', async () => {
    // Scenario A: On an INDIVIDUAL event with capacity 1, individual registration races with team creation
    const indEvent = await createIndividualEvent({ maxCapacity: 1 });
    const raceResultsInd = await Promise.allSettled([
      registerEvent(member1Id, indEvent.id),
      createTeam(leaderAId, indEvent.id, 'Illegal Team'),
    ]);

    const indSuccess = raceResultsInd[0];
    const teamFailure = raceResultsInd[1];

    assert.strictEqual(indSuccess.status, 'fulfilled');
    assert.strictEqual((indSuccess as PromiseFulfilledResult<any>).value.status, 'REGISTERED');

    assert.strictEqual(teamFailure.status, 'rejected');
    assert.match((teamFailure as PromiseRejectedResult).reason.message, /TEAM_NOT_SUPPORTED|Event does not support teams/i);

    const evInd = await adminPrisma.event.findUnique({ where: { id: indEvent.id } });
    assert.strictEqual(evInd?.registrationCount, 1, 'registrationCount remains exactly 1');

    // Scenario B: On a TEAM event with capacity 1, team creation races with individual registration
    const teamEvent = await createTeamEvent({ maxCapacity: 1, minimumTeamSize: 1 });
    const raceResultsTeam = await Promise.allSettled([
      createTeam(leaderAId, teamEvent.id, 'Valid Team'),
      registerEvent(member1Id, teamEvent.id),
    ]);

    const teamSuccess = raceResultsTeam[0];
    const indFailure = raceResultsTeam[1];

    assert.strictEqual(teamSuccess.status, 'fulfilled');
    assert.strictEqual((teamSuccess as PromiseFulfilledResult<any>).value.status, 'REGISTERED');

    assert.strictEqual(indFailure.status, 'rejected');
    assert.match((indFailure as PromiseRejectedResult).reason.message, /Individual registration is not permitted for team events/i);

    const evTeam = await adminPrisma.event.findUnique({ where: { id: teamEvent.id } });
    assert.strictEqual(evTeam?.registrationCount, 1, 'registrationCount remains exactly 1');
  });
});
