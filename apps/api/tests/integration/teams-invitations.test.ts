import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { createTeam, joinTeam } from '../../src/modules/teams/teams.service';
import { searchEligibleInvitees } from '../../src/modules/registrations/registrations.service';
import { ForbiddenError } from '../../src/lib/errors';
import { AssignmentSource } from '@nst/database';

describe('Team Discovery & Member Lookup Integration Tests', () => {
  let eventId: string;
  let batchId: string;
  let leaderId: string;
  let member1Id: string; // Eligible
  let member2Id: string; // Not eligible
  let member3Id: string; // Eligible
  let teamId: string;

  beforeAll(async () => {
    // Cleanup first just in case
    await prisma.eventRegistration.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.notificationJob.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.eventAudienceBatch.deleteMany({});
    await prisma.userAcademicProfile.deleteMany({});
    await prisma.academicBatch.deleteMany({});
    await prisma.academicProgram.deleteMany({});
    await prisma.eventClub.deleteMany({});
    await prisma.event.deleteMany({ where: { id: '00000000-0000-0000-0000-000000000010' } });
    await prisma.club.deleteMany({ where: { id: '00000000-0000-0000-0000-000000000010' } });
    await prisma.user.deleteMany({ where: { id: { in: ['00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000014'] } } });

    // Create users
    const leader = await prisma.user.create({ data: { id: '00000000-0000-0000-0000-000000000011', email: 'leader@nst.com', fullName: 'Leader Invite', globalRole: "STUDENT", googleSub: "sub11" } });
    const member1 = await prisma.user.create({ data: { id: '00000000-0000-0000-0000-000000000012', email: 'member1@nst.com', fullName: 'Member One', globalRole: "STUDENT", googleSub: "sub12" } });
    const member2 = await prisma.user.create({ data: { id: '00000000-0000-0000-0000-000000000013', email: 'member2@nst.com', fullName: 'Member Two', globalRole: "STUDENT", googleSub: "sub13" } });
    const member3 = await prisma.user.create({ data: { id: '00000000-0000-0000-0000-000000000014', email: 'member3@nst.com', fullName: 'Member Three', globalRole: "STUDENT", googleSub: "sub14" } });

    leaderId = leader.id;
    member1Id = member1.id;
    member2Id = member2.id;
    member3Id = member3.id;

    // Create batch & program
    const program = await prisma.academicProgram.create({ data: { name: 'BTech', code: 'BT' } });
    const batch = await prisma.academicBatch.create({ data: { programId: program.id, admissionYear: 2024, graduationYear: 2028 } });
    batchId = batch.id;

    const batch2 = await prisma.academicBatch.create({ data: { programId: program.id, admissionYear: 2023, graduationYear: 2027 } });

    // Profiles: leader, m1, m3 in batch 1; m2 in batch 2
    await prisma.userAcademicProfile.create({ data: { userId: leaderId, batchId: batchId, assignmentSource: AssignmentSource.INSTITUTIONAL_EMAIL_INFERENCE } });
    await prisma.userAcademicProfile.create({ data: { userId: member1Id, batchId: batchId, assignmentSource: AssignmentSource.INSTITUTIONAL_EMAIL_INFERENCE } });
    await prisma.userAcademicProfile.create({ data: { userId: member2Id, batchId: batch2.id, assignmentSource: AssignmentSource.INSTITUTIONAL_EMAIL_INFERENCE } });
    await prisma.userAcademicProfile.create({ data: { userId: member3Id, batchId: batchId, assignmentSource: AssignmentSource.INSTITUTIONAL_EMAIL_INFERENCE } });

    // Create event targeted at batch 1
    const event = await prisma.event.create({
      data: {
        id: '00000000-0000-0000-0000-000000000010',
        title: 'Team Discovery Event',
        description: 'Integration test',
        state: 'PUBLISHED',
        registrationType: 'TEAM',
        maxCapacity: 10,
        metadata: { minimum_team_size: 2, maximum_team_size: 3 },
        startTime: new Date('2027-01-01T00:00:00Z'),
        endTime: new Date('2027-01-02T00:00:00Z'),
        audience: 'SPECIFIC_BATCHES',
        eventType: 'WORKSHOP',
        createdBy: leaderId
      }
    });
    eventId = event.id;

    await prisma.eventAudienceBatch.create({ data: { eventId, batchId } });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.eventRegistration.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.notificationJob.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.eventAudienceBatch.deleteMany({});
    await prisma.userAcademicProfile.deleteMany({});
    await prisma.academicBatch.deleteMany({});
    await prisma.academicProgram.deleteMany({});
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.user.deleteMany({ where: { id: { in: [leaderId, member1Id, member2Id, member3Id] } } });
  });

  it('Leader should create a team', async () => {
    const res = await createTeam(leaderId, eventId, 'Discovery Team');
    teamId = res.team_id;
    assert.ok(teamId);
  });

  it('Safe invitee lookup: Leader can search eligible users', async () => {
    const results = await searchEligibleInvitees(leaderId, eventId, 'member');
    // M1 and M3 are eligible. M2 is in batch2, not eligible.
    assert.strictEqual(results.length, 2);
    const ids = results.map(r => r.user_id);
    assert.ok(ids.includes(member1Id));
    assert.ok(ids.includes(member3Id));
    assert.ok(!ids.includes(member2Id));
  });

  it('Safe invitee lookup: Non-leader rejected', async () => {
    await assert.rejects(
      searchEligibleInvitees(member1Id, eventId, 'member'),
      (err: any) => {
        assert.strictEqual(err.name, 'ForbiddenError');
        return true;
      }
    );
  });

  it('Member 1 joins the team directly via joinTeam', async () => {
    const joinRes = await joinTeam(member1Id, teamId);
    assert.ok(joinRes);
  });

  it('Safe invitee lookup: excludes existing team members', async () => {
    const results = await searchEligibleInvitees(leaderId, eventId, 'member');
    const ids = results.map(r => r.user_id);
    assert.ok(!ids.includes(member1Id)); // Now a member, excluded
    assert.ok(ids.includes(member3Id)); // Member 3 still eligible
  });

});
