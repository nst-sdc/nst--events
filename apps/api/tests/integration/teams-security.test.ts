import { describe, it, before } from 'node:test';
import * as assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import { createTeam, getSentTeamInvitations } from '../../src/modules/teams/teams.service';

describe('SECURITY DEFINER Helpers BOLA & Validation Tests', () => {
  let eventId: string;
  let leaderAId: string;
  let leaderBId: string;
  let memberId: string;
  let teamAId: string;
  let teamBId: string;

  before(async () => {
    // Basic setup
    await adminPrisma.eventRegistration.deleteMany({});
    await adminPrisma.team.deleteMany({});
    await adminPrisma.eventAudienceBatch.deleteMany({});
    await adminPrisma.userAcademicProfile.deleteMany({});
    await adminPrisma.academicBatch.deleteMany({});
    await adminPrisma.academicProgram.deleteMany({});
    await adminPrisma.attendanceDispute.deleteMany({});
    await adminPrisma.attendanceRecord.deleteMany({});
    await adminPrisma.attendanceSession.deleteMany({});
    await adminPrisma.eventRegistration.deleteMany({});
    await adminPrisma.eventClub.deleteMany({});
    await adminPrisma.event.deleteMany({ where: { id: '00000000-0000-0000-0000-0000000000e1' } });
    await adminPrisma.user.deleteMany({
      where: { email: { in: ['leaderA@nst.com', 'leaderB@nst.com', 'member@nst.com'] } }
    });

    const leaderA = await adminPrisma.user.create({ data: { id: '00000000-0000-0000-0000-0000000000a1', email: 'leaderA@nst.com', fullName: 'Leader A', globalRole: 'STUDENT', googleSub: 'subA' } });
    const leaderB = await adminPrisma.user.create({ data: { id: '00000000-0000-0000-0000-0000000000b1', email: 'leaderB@nst.com', fullName: 'Leader B', globalRole: 'STUDENT', googleSub: 'subB' } });
    const member = await adminPrisma.user.create({ data: { id: '00000000-0000-0000-0000-0000000000c1', email: 'member@nst.com', fullName: 'Member', globalRole: 'STUDENT', googleSub: 'subM' } });

    leaderAId = leaderA.id;
    leaderBId = leaderB.id;
    memberId = member.id;

    const event = await adminPrisma.event.create({
      data: {
        id: '00000000-0000-0000-0000-0000000000e1',
        title: 'Security Event',
        description: 'Test',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        registrationType: 'TEAM',
        attendanceType: 'SINGLE',
        audience: 'ALL_STUDENTS',
        eventType: 'MEETUP',
        createdBy: leaderAId,
        startTime: new Date(Date.now() + 100000),
        endTime: new Date(Date.now() + 200000),
        registrationStartTime: new Date(Date.now() - 3600000),
        registrationEndTime: new Date(Date.now() + 3600000),
        metadata: { maximum_team_size: 2 }
      }
    });
    eventId = event.id;

    const resA = await createTeam(leaderAId, eventId, 'Team A');
    teamAId = resA.team_id;

    const resB = await createTeam(leaderBId, eventId, 'Team B');
    teamBId = resB.team_id;
  });

  it('Leader A can query their own team members', async () => {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${leaderAId}, true)`;
      return tx.$queryRaw<{ user_id: string }[]>`SELECT * FROM get_team_member_ids(${eventId}::uuid, ${teamAId}::uuid)`;
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].user_id, leaderAId);
  });

  it('BOLA: Leader B cannot query Team A members', async () => {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${leaderBId}, true)`;
      return tx.$queryRaw<{ user_id: string }[]>`SELECT * FROM get_team_member_ids(${eventId}::uuid, ${teamAId}::uuid)`;
    });
    assert.strictEqual(result.length, 0);
  });

  it('Leader A can view sent invitations for Team A', async () => {
    const invitations = await getSentTeamInvitations(leaderAId, teamAId);
    assert.deepStrictEqual(invitations, []);
  });

  it('BOLA: Leader B cannot view sent invitations for Team A', async () => {
    await assert.rejects(
      async () => {
        await getSentTeamInvitations(leaderBId, teamAId);
      },
      (err: any) => err.message === 'Only the team leader can view sent invitations'
    );
  });

  it('Cannot view sent invitations for non-existent team', async () => {
    await assert.rejects(
      async () => {
        await getSentTeamInvitations(leaderAId, '00000000-0000-0000-0000-000000000999');
      },
      (err: any) => err.message === 'Team not found'
    );
  });

});
