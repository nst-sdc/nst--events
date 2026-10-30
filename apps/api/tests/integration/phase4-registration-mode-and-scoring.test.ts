import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { prisma } from '../../src/lib/prisma';
import { createEvent, updateEvent, approveEvent } from '../../src/modules/events/events.service';
import { publishRevision, withdrawResults, restoreResults } from '../../src/modules/event-results/event-results.service';
import { randomUUID } from 'crypto';

describe('Phase 4 Master Remediation: Registration Mode & Competition Results', { concurrency: false }, () => {
  const runId = Date.now().toString().slice(-6);

  // Users
  const platformAdminId = randomUUID();
  const studentWinner1Id = randomUUID();
  const studentWinner2Id = randomUUID();
  const studentWinner3Id = randomUUID();
  const studentTeamLeaderId = randomUUID();
  const studentTeamMemberId = randomUUID();
  const secretStudentId = randomUUID();

  // Club & Events
  const clubId = randomUUID();
  let requiredEventId: string;
  let notRequiredEventId: string;
  let competitionEventId: string;

  // Competition Entities
  let resultSetId: string;
  let revision1Id: string;
  let revision2Id: string;
  let teamId: string;
  let regWin1Id: string;
  let regWin2Id: string;
  let regWin3Id: string;
  let regTeamLeaderId: string;
  let regTeamMemberId: string;

  before(async () => {
    // 1. Create Club
    await adminPrisma.club.create({
      data: {
        id: clubId,
        name: `Phase 4 Club ${runId}`,
      },
    });

    // 2. Create Users individually with institutional domains
    await adminPrisma.user.create({
      data: {
        id: platformAdminId,
        email: `p4_adm_${runId}@adypu.edu.in`,
        fullName: 'Phase 4 Platform Admin',
        globalRole: 'PLATFORM_ADMIN',
        googleSub: `sub_adm_${runId}`,
      },
    });

    await adminPrisma.user.create({
      data: {
        id: studentWinner1Id,
        email: `p4_w1_${runId}@adypu.edu.in`,
        fullName: 'Winner One',
        globalRole: 'STUDENT',
        googleSub: `sub_w1_${runId}`,
      },
    });

    await adminPrisma.user.create({
      data: {
        id: studentWinner2Id,
        email: `p4_w2_${runId}@adypu.edu.in`,
        fullName: 'Winner Two',
        globalRole: 'STUDENT',
        googleSub: `sub_w2_${runId}`,
      },
    });

    await adminPrisma.user.create({
      data: {
        id: studentWinner3Id,
        email: `p4_w3_${runId}@adypu.edu.in`,
        fullName: 'Winner Three',
        globalRole: 'STUDENT',
        googleSub: `sub_w3_${runId}`,
      },
    });

    await adminPrisma.user.create({
      data: {
        id: studentTeamLeaderId,
        email: `p4_tl_${runId}@adypu.edu.in`,
        fullName: 'Team Leader',
        globalRole: 'STUDENT',
        googleSub: `sub_tl_${runId}`,
      },
    });

    await adminPrisma.user.create({
      data: {
        id: studentTeamMemberId,
        email: `p4_tm_${runId}@adypu.edu.in`,
        fullName: 'Team Member',
        globalRole: 'STUDENT',
        googleSub: `sub_tm_${runId}`,
      },
    });

    await adminPrisma.user.create({
      data: {
        id: secretStudentId,
        email: `p4_sec_${runId}@adypu.edu.in`,
        fullName: 'Hidden Student',
        globalRole: 'STUDENT',
        googleSub: `sub_sec_${runId}`,
      },
    });

    // Hidden student profile setup (section_visibility.identity = false)
    await adminPrisma.studentProfile.upsert({
      where: { userId: secretStudentId },
      create: {
        userId: secretStudentId,
        slug: `hidden-student-${runId}`,
        sectionVisibility: { identity: false, name: false },
        directoryListed: false,
      },
      update: {
        sectionVisibility: { identity: false, name: false },
        directoryListed: false,
      },
    });

    // 3. Setup Competition Event & Entities
    const now = new Date();
    const compEvent = await createEvent(platformAdminId, {
      title: `Annual Hackathon ${runId}`,
      start_time: new Date(now.getTime() - 7200000).toISOString(),
      end_time: new Date(now.getTime() - 3600000).toISOString(),
      event_type: 'COMPETITION',
      registration_mode: 'REQUIRED',
      registration_start_time: new Date(now.getTime() - 86400000).toISOString(),
      registration_end_time: new Date(now.getTime() - 80000000).toISOString(),
      visibility: 'PUBLIC',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    competitionEventId = compEvent.id;

    await adminPrisma.event.update({
      where: { id: competitionEventId },
      data: { state: 'PUBLISHED' },
    });

    // Create Registrations for individual winners
    const r1 = await adminPrisma.eventRegistration.create({
      data: { eventId: competitionEventId, userId: studentWinner1Id, registrationStatus: 'REGISTERED' },
    });
    regWin1Id = r1.id;

    const r2 = await adminPrisma.eventRegistration.create({
      data: { eventId: competitionEventId, userId: studentWinner2Id, registrationStatus: 'REGISTERED' },
    });
    regWin2Id = r2.id;

    const r3 = await adminPrisma.eventRegistration.create({
      data: { eventId: competitionEventId, userId: studentWinner3Id, registrationStatus: 'REGISTERED' },
    });
    regWin3Id = r3.id;

    // Create a Team and its members
    const team = await adminPrisma.team.create({
      data: {
        eventId: competitionEventId,
        name: `Alpha Squad ${runId}`,
        normalizedName: `alpha squad ${runId}`,
        leaderId: studentTeamLeaderId,
        status: 'REGISTERED',
      },
    });
    teamId = team.id;

    const rTeamLeader = await adminPrisma.eventRegistration.create({
      data: { eventId: competitionEventId, userId: studentTeamLeaderId, teamId, registrationStatus: 'REGISTERED' },
    });
    regTeamLeaderId = rTeamLeader.id;

    const rTeamMember = await adminPrisma.eventRegistration.create({
      data: { eventId: competitionEventId, userId: studentTeamMemberId, teamId, registrationStatus: 'REGISTERED' },
    });
    regTeamMemberId = rTeamMember.id;

    // Create EventResultSet
    const rs = await adminPrisma.eventResultSet.create({
      data: {
        eventId: competitionEventId,
        status: 'DRAFT',
      },
    });
    resultSetId = rs.id;
  });

  after(async () => {
    try {
      await adminPrisma.studentAchievement.deleteMany({
        where: { userId: { in: [studentWinner1Id, studentWinner2Id, studentWinner3Id, studentTeamLeaderId, studentTeamMemberId] } },
      });
      await adminPrisma.eventResultRevision.deleteMany({});
      await adminPrisma.eventResultSet.deleteMany({});
      await adminPrisma.eventRegistration.deleteMany({
        where: { userId: { in: [studentWinner1Id, studentWinner2Id, studentWinner3Id, studentTeamLeaderId, studentTeamMemberId] } },
      });
      await adminPrisma.team.deleteMany({});
      await adminPrisma.eventClub.deleteMany({ where: { clubId } });
      await adminPrisma.event.deleteMany({
        where: { id: { in: [requiredEventId, notRequiredEventId, competitionEventId].filter(Boolean) } },
      });
      await adminPrisma.studentProfile.deleteMany({ where: { userId: secretStudentId } });
      await adminPrisma.user.deleteMany({
        where: { id: { in: [platformAdminId, studentWinner1Id, studentWinner2Id, studentWinner3Id, studentTeamLeaderId, studentTeamMemberId, secretStudentId] } },
      });
      await adminPrisma.club.delete({ where: { id: clubId } });
    } catch {}
  });

  // =========================================================================
  // WORKSTREAM 1: Explicit Registration Mode (REQUIRED vs NOT_REQUIRED)
  // =========================================================================
  it('1.1: Creates an event with registration_mode = NOT_REQUIRED (informational event)', async () => {
    const now = new Date();
    const event = await createEvent(platformAdminId, {
      title: `Informational Seminar ${runId}`,
      start_time: new Date(now.getTime() + 86400000).toISOString(),
      end_time: new Date(now.getTime() + 90000000).toISOString(),
      event_type: 'SEMINAR',
      registration_mode: 'NOT_REQUIRED',
      visibility: 'PUBLIC',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });

    assert.ok(event);
    assert.strictEqual(event.registrationMode, 'NOT_REQUIRED');
    assert.strictEqual(event.registrationStartTime, null);
    assert.strictEqual(event.registrationEndTime, null);
    notRequiredEventId = event.id;
  });

  it('1.2: NOT_REQUIRED event can be approved/published without registration timestamps', async () => {
    // Transition from DRAFT to PENDING_APPROVAL
    await adminPrisma.event.update({
      where: { id: notRequiredEventId },
      data: { state: 'PENDING_APPROVAL' },
    });

    // Approve event
    const published = await approveEvent(platformAdminId, notRequiredEventId);
    assert.strictEqual(published.state, 'PUBLISHED');

    const dbEvent = await adminPrisma.event.findUnique({ where: { id: notRequiredEventId } });
    assert.strictEqual(dbEvent?.state, 'PUBLISHED');
    assert.strictEqual(dbEvent?.registrationMode, 'NOT_REQUIRED');
  });

  it('1.3: register_event RPC rejects registration on NOT_REQUIRED events', async () => {
    await assert.rejects(
      async () => {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.user_id', ${studentWinner1Id}, true)`;
          await tx.$queryRaw`SELECT register_event(${notRequiredEventId}::uuid)`;
        });
      },
      (err: any) => err.message.includes('Registration is not required for this event') || err.message.includes('U0056')
    );
  });

  it('1.4: create_team RPC rejects squad creation on NOT_REQUIRED events', async () => {
    // Set registration_type to TEAM for testing rejection
    await adminPrisma.event.update({
      where: { id: notRequiredEventId },
      data: { registrationType: 'TEAM' },
    });

    await assert.rejects(
      async () => {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.user_id', ${studentWinner1Id}, true)`;
          await tx.$queryRaw`SELECT create_team(${notRequiredEventId}::uuid, 'Test Squad')`;
        });
      },
      (err: any) => err.message.includes('Registration is not required for this event') || err.message.includes('U0056')
    );
  });

  it('1.5: REQUIRED event cannot be approved/published without valid registration window', async () => {
    const now = new Date();
    const event = await createEvent(platformAdminId, {
      title: `Required Registration Workshop ${runId}`,
      start_time: new Date(now.getTime() + 86400000).toISOString(),
      end_time: new Date(now.getTime() + 90000000).toISOString(),
      event_type: 'WORKSHOP',
      registration_mode: 'REQUIRED',
      visibility: 'PUBLIC',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    requiredEventId = event.id;

    // Transition to PENDING_APPROVAL
    await adminPrisma.event.update({
      where: { id: requiredEventId },
      data: { state: 'PENDING_APPROVAL' },
    });

    // Attempt approveEvent without configuring registration window -> rejected
    await assert.rejects(
      async () => {
        await approveEvent(platformAdminId, requiredEventId);
      },
      (err: any) =>
        err.statusCode === 422 &&
        err.message.includes('Registration window must be configured before publication')
    );
  });

  it('1.6: REQUIRED event publishes successfully once valid registration window is set', async () => {
    const now = new Date();
    // Configure valid registration window
    await adminPrisma.event.update({
      where: { id: requiredEventId },
      data: {
        registrationStartTime: new Date(now.getTime() - 3600000),
        registrationEndTime: new Date(now.getTime() + 80000000),
      },
    });

    const published = await approveEvent(platformAdminId, requiredEventId);
    assert.strictEqual(published.state, 'PUBLISHED');
  });

  it('1.7: join_team RPC rejects joining a squad on NOT_REQUIRED events', async () => {
    // Create a dummy team on notRequiredEventId
    const dummyTeam = await adminPrisma.team.create({
      data: {
        id: randomUUID(),
        eventId: notRequiredEventId,
        name: `Informational Team ${runId}`,
        normalizedName: `informational team ${runId}`,
        leaderId: studentTeamLeaderId,
        status: 'FORMING',
      },
    });

    await assert.rejects(
      async () => {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.user_id', ${studentWinner1Id}, true)`;
          await tx.$queryRaw`SELECT join_team(${notRequiredEventId}::uuid, ${dummyTeam.id}::uuid)`;
        });
      },
      (err: any) => err.message.includes('Registration is not required for this event') || err.message.includes('U0056')
    );
  });

  it('1.8: process_waitlist RPC returns empty array on NOT_REQUIRED events', async () => {
    const promoted: any[] = await prisma.$queryRaw`
      SELECT process_waitlist(${notRequiredEventId}::uuid) as promoted;
    `;
    assert.deepStrictEqual(promoted[0].promoted, []);
  });

  it('1.9: updateEvent rejects transitioning REQUIRED -> NOT_REQUIRED when registrations exist', async () => {
    // Add a registration to requiredEventId
    const dummyReg = await adminPrisma.eventRegistration.create({
      data: {
        eventId: requiredEventId,
        userId: studentWinner1Id,
        registrationStatus: 'REGISTERED',
      },
    });

    await assert.rejects(
      async () => {
        await updateEvent(platformAdminId, requiredEventId, {
          registration_mode: 'NOT_REQUIRED',
        });
      },
      (err: any) =>
        err.statusCode === 422 &&
        err.message.includes('Cannot change registration mode to NOT_REQUIRED when registrations or teams already exist')
    );

    // Clean up dummy registration
    await adminPrisma.eventRegistration.delete({ where: { id: dummyReg.id } });
  });

  it('1.10: Database trigger rejects direct SQL UPDATE of registration_mode to NOT_REQUIRED when registrations or teams exist', async () => {
    // Add a dummy team to requiredEventId
    const dummyTeam = await adminPrisma.team.create({
      data: {
        id: randomUUID(),
        eventId: requiredEventId,
        name: `Trigger Test Team ${runId}`,
        normalizedName: `trigger test team ${runId}`,
        leaderId: studentTeamLeaderId,
        status: 'REGISTERED',
      },
    });

    await assert.rejects(
      async () => {
        await adminPrisma.$executeRaw`
          UPDATE events SET registration_mode = 'NOT_REQUIRED' WHERE id = ${requiredEventId}::uuid
        `;
      },
      (err: any) => err.message.includes('Cannot change registration mode to NOT_REQUIRED') || err.message.includes('U0059')
    );

    // Clean up dummy team
    await adminPrisma.team.delete({ where: { id: dummyTeam.id } });
  });

  it('1.10b: Event with non-deleted WAITLISTED registration cannot transition REQUIRED -> NOT_REQUIRED via API or direct SQL, preserving waitlist records', async () => {
    // 1. Create a non-deleted WAITLISTED registration for requiredEventId
    const waitlistedReg = await adminPrisma.eventRegistration.create({
      data: {
        id: randomUUID(),
        eventId: requiredEventId,
        userId: studentWinner3Id,
        registrationStatus: 'WAITLISTED',
      },
    });

    const initialReg = await adminPrisma.eventRegistration.findUnique({
      where: { id: waitlistedReg.id },
    });
    const initialEvent = await adminPrisma.event.findUnique({
      where: { id: requiredEventId },
    });

    assert.ok(initialReg, 'Waitlisted registration must exist');
    assert.strictEqual(initialReg.registrationStatus, 'WAITLISTED');
    assert.strictEqual(initialReg.deletedAt, null);

    // 2. Attempt 1: The API updateEvent path
    await assert.rejects(
      async () => {
        await updateEvent(platformAdminId, requiredEventId, {
          registration_mode: 'NOT_REQUIRED',
        });
      },
      (err: any) =>
        err.statusCode === 422 &&
        err.message.includes('Cannot change registration mode to NOT_REQUIRED when registrations or teams already exist')
    );

    // Verify waitlisted registration and event remain unchanged after API attempt
    const afterApiReg = await adminPrisma.eventRegistration.findUnique({
      where: { id: waitlistedReg.id },
    });
    const afterApiEvent = await adminPrisma.event.findUnique({
      where: { id: requiredEventId },
    });
    assert.deepStrictEqual(afterApiReg, initialReg, 'Waitlisted registration row must be completely unchanged after API rejection');
    assert.strictEqual(afterApiEvent?.registrationMode, 'REQUIRED', 'Event registration_mode must remain REQUIRED');

    // 3. Attempt 2: Direct SQL update enforcing the database trigger
    await assert.rejects(
      async () => {
        await adminPrisma.$executeRaw`
          UPDATE events SET registration_mode = 'NOT_REQUIRED' WHERE id = ${requiredEventId}::uuid
        `;
      },
      (err: any) =>
        err.message.includes('Cannot change registration mode to NOT_REQUIRED') ||
        err.message.includes('U0059')
    );

    // Verify waitlisted registration and event remain completely unchanged after direct SQL rejection
    const afterSqlReg = await adminPrisma.eventRegistration.findUnique({
      where: { id: waitlistedReg.id },
    });
    const afterSqlEvent = await adminPrisma.event.findUnique({
      where: { id: requiredEventId },
    });
    assert.deepStrictEqual(afterSqlReg, initialReg, 'Waitlisted registration row must be completely unchanged after SQL trigger rejection');
    assert.strictEqual(afterSqlReg?.registrationStatus, 'WAITLISTED');
    assert.strictEqual(afterSqlReg?.deletedAt, null);
    assert.strictEqual(afterSqlEvent?.registrationMode, 'REQUIRED', 'Event registration_mode must remain REQUIRED');

    // Clean up test waitlisted registration
    await adminPrisma.eventRegistration.delete({ where: { id: waitlistedReg.id } });
  });

  it('1.11: Transitioning REQUIRED -> NOT_REQUIRED succeeds when NO registrations or teams exist', async () => {
    const now = new Date();
    const cleanEvent = await createEvent(platformAdminId, {
      title: `Clean Transition Event ${runId}`,
      start_time: new Date(now.getTime() + 86400000).toISOString(),
      end_time: new Date(now.getTime() + 90000000).toISOString(),
      event_type: 'SEMINAR',
      registration_mode: 'REQUIRED',
      visibility: 'PUBLIC',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });

    const updated = await updateEvent(platformAdminId, cleanEvent.id, {
      registration_mode: 'NOT_REQUIRED',
    });

    assert.strictEqual(updated.registrationMode, 'NOT_REQUIRED');
    assert.strictEqual(updated.registrationStartTime, null);
    assert.strictEqual(updated.registrationEndTime, null);

    // Clean up
    await adminPrisma.eventClub.deleteMany({ where: { eventId: cleanEvent.id } });
    await adminPrisma.event.delete({ where: { id: cleanEvent.id } });
  });

  it('1.12: updateEvent rejects transitioning published event from NOT_REQUIRED to REQUIRED without registration window', async () => {
    // notRequiredEventId is PUBLISHED with registration_mode = NOT_REQUIRED
    await assert.rejects(
      async () => {
        await updateEvent(platformAdminId, notRequiredEventId, {
          registration_mode: 'REQUIRED',
        });
      },
      (err: any) =>
        err.statusCode === 422 &&
        err.message.includes('Published events in REQUIRED registration mode must have a valid registration window')
    );
  });

  it('1.13: updateEvent rejects transitioning published event from NOT_REQUIRED to REQUIRED with invalid window (start >= end)', async () => {
    const now = new Date();
    await assert.rejects(
      async () => {
        await updateEvent(platformAdminId, notRequiredEventId, {
          registration_mode: 'REQUIRED',
          registration_start_time: new Date(now.getTime() + 100000).toISOString(),
          registration_end_time: new Date(now.getTime() + 50000).toISOString(),
        });
      },
      (err: any) =>
        err.statusCode === 422 &&
        err.message.includes('registration_start_time must be before registration_end_time')
    );
  });

  it('1.14: Database trigger rejects direct SQL UPDATE of published event to REQUIRED mode without valid registration window', async () => {
    // Direct SQL update attempting to set registration_mode = 'REQUIRED' on published event where registration times are NULL
    await assert.rejects(
      async () => {
        await adminPrisma.$executeRaw`
          UPDATE events SET registration_mode = 'REQUIRED' WHERE id = ${notRequiredEventId}::uuid
        `;
      },
      (err: any) =>
        err.message.includes('Published events in REQUIRED registration mode must have a valid registration window') ||
        err.message.includes('U0056')
    );
  });

  it('1.15: Database trigger rejects direct SQL UPDATE that sets registration_start_time to NULL on published REQUIRED event', async () => {
    // requiredEventId is PUBLISHED with registration_mode = 'REQUIRED' and valid window
    await assert.rejects(
      async () => {
        await adminPrisma.$executeRaw`
          UPDATE events SET registration_start_time = NULL WHERE id = ${requiredEventId}::uuid
        `;
      },
      (err: any) =>
        err.message.includes('Published events in REQUIRED registration mode must have a valid registration window') ||
        err.message.includes('U0056')
    );
  });

  it('1.16: Transitioning published event from NOT_REQUIRED to REQUIRED succeeds when a valid registration window is provided', async () => {
    // Create and publish a clean NOT_REQUIRED event
    const now = new Date();
    const cleanPubEvent = await createEvent(platformAdminId, {
      title: `Pub Not-Required to Required ${runId}`,
      start_time: new Date(now.getTime() + 86400000).toISOString(),
      end_time: new Date(now.getTime() + 90000000).toISOString(),
      event_type: 'WORKSHOP',
      registration_mode: 'NOT_REQUIRED',
      visibility: 'PUBLIC',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });

    await adminPrisma.event.update({
      where: { id: cleanPubEvent.id },
      data: { state: 'PENDING_APPROVAL' },
    });
    await approveEvent(platformAdminId, cleanPubEvent.id);

    // Now transition to REQUIRED providing valid window
    const updated = await updateEvent(platformAdminId, cleanPubEvent.id, {
      registration_mode: 'REQUIRED',
      registration_start_time: new Date(now.getTime() - 10000).toISOString(),
      registration_end_time: new Date(now.getTime() + 80000000).toISOString(),
    });

    assert.strictEqual(updated.registrationMode, 'REQUIRED');
    assert.ok(updated.registrationStartTime);
    assert.ok(updated.registrationEndTime);

    // Clean up
    await adminPrisma.eventClub.deleteMany({ where: { eventId: cleanPubEvent.id } });
    await adminPrisma.event.delete({ where: { id: cleanPubEvent.id } });
  });

  // =========================================================================
  // WORKSTREAM 2: Centralized Competition Scoring Policy & Ledger Reconciliation
  // =========================================================================
  it('2.1: Publishes Revision 1 with individual 1st, 2nd, 3rd place: awards 3, 2, 1 points exactly', async () => {
    // Create Revision 1 with 1st, 2nd, 3rd place awards
    const rev1 = await adminPrisma.eventResultRevision.create({
      data: {
        resultSet: { connect: { id: resultSetId } },
        creator: { connect: { id: platformAdminId } },
        revisionNumber: 1,
        version: 1,
        status: 'DRAFT',
        awards: {
          create: [
            {
              title: 'Gold Trophy — 1st Place',
              awardType: 'RANKED_PLACEMENT',
              placement: 1,
              displayOrder: 1,
              isTied: false,
              recipients: {
                create: [
                  {
                    recipientType: 'INDIVIDUAL',
                    userId: studentWinner1Id,
                    registrationId: regWin1Id,
                  },
                ],
              },
            },
            {
              title: 'Silver Medal — 2nd Place',
              awardType: 'RANKED_PLACEMENT',
              placement: 2,
              displayOrder: 2,
              isTied: false,
              recipients: {
                create: [
                  {
                    recipientType: 'INDIVIDUAL',
                    userId: studentWinner2Id,
                    registrationId: regWin2Id,
                  },
                ],
              },
            },
            {
              title: 'Bronze Medal — 3rd Place',
              awardType: 'RANKED_PLACEMENT',
              placement: 3,
              displayOrder: 3,
              isTied: false,
              recipients: {
                create: [
                  {
                    recipientType: 'INDIVIDUAL',
                    userId: studentWinner3Id,
                    registrationId: regWin3Id,
                  },
                ],
              },
            },
          ],
        },
      },
    });
    revision1Id = rev1.id;

    // Publish Revision 1
    const res = await publishRevision(competitionEventId, platformAdminId, {
      revision_id: revision1Id,
      version: 1,
      notify_winners: false,
      announce_participants: false,
    });
    assert.strictEqual(res.success, true);

    // Verify published achievements in studentAchievement
    const ach1 = await adminPrisma.studentAchievement.findMany({ where: { userId: studentWinner1Id, isActive: true } });
    const ach2 = await adminPrisma.studentAchievement.findMany({ where: { userId: studentWinner2Id, isActive: true } });
    const ach3 = await adminPrisma.studentAchievement.findMany({ where: { userId: studentWinner3Id, isActive: true } });

    assert.strictEqual(ach1.length, 1);
    assert.strictEqual(ach1[0].placement, 1, '1st place must receive placement 1');

    assert.strictEqual(ach2.length, 1);
    assert.strictEqual(ach2[0].placement, 2, '2nd place must receive placement 2');

    assert.strictEqual(ach3.length, 1);
    assert.strictEqual(ach3[0].placement, 3, '3rd place must receive placement 3');
  });

  it('2.2: Publishes Correction Revision 2: revokes old awards and reconciles team & individual placements without duplicates', async () => {
    // In Revision 2:
    // Winner 2 gets 1st place
    // Alpha Squad gets 2nd place (Leader Winner 1 and Member studentTeamMemberId)
    const rev2 = await adminPrisma.eventResultRevision.create({
      data: {
        resultSet: { connect: { id: resultSetId } },
        creator: { connect: { id: platformAdminId } },
        revisionNumber: 2,
        version: 1,
        status: 'DRAFT',
        correctionReason: 'Podium correction after official dispute review',
        awards: {
          create: [
            {
              title: 'Gold Trophy — 1st Place',
              awardType: 'RANKED_PLACEMENT',
              placement: 1,
              displayOrder: 1,
              isTied: false,
              recipients: {
                create: [
                  {
                    recipientType: 'INDIVIDUAL',
                    userId: studentWinner2Id,
                    registrationId: regWin2Id,
                  },
                ],
              },
            },
            {
              title: 'Silver Cup — 2nd Place (Team)',
              awardType: 'RANKED_PLACEMENT',
              placement: 2,
              displayOrder: 2,
              isTied: false,
              recipients: {
                create: [
                  {
                    recipientType: 'TEAM',
                    teamId,
                    members: {
                      create: [
                        { userId: studentTeamLeaderId, registrationId: regTeamLeaderId, displayNameSnapshot: 'Leader TL' },
                        { userId: studentTeamMemberId, registrationId: regTeamMemberId, displayNameSnapshot: 'Member TM' },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    });
    revision2Id = rev2.id;

    // Publish Revision 2
    const res = await publishRevision(competitionEventId, platformAdminId, {
      revision_id: revision2Id,
      version: 1,
      notify_winners: false,
      announce_participants: false,
    });
    assert.strictEqual(res.success, true);

    // Verify Winner 2 now has 1st place achievement
    const ach2 = await adminPrisma.studentAchievement.findMany({ where: { userId: studentWinner2Id, isActive: true } });
    assert.strictEqual(ach2.length, 1);
    assert.strictEqual(ach2[0].placement, 1, 'Winner 2 now has 1st place');

    // Verify Team Leader and Team Member each received 2nd place team award
    const achTL = await adminPrisma.studentAchievement.findMany({ where: { userId: studentTeamLeaderId, isActive: true } });
    assert.strictEqual(achTL.length, 1);
    assert.strictEqual(achTL[0].placement, 2, 'Team Leader received 2nd place');

    const achTM = await adminPrisma.studentAchievement.findMany({ where: { userId: studentTeamMemberId, isActive: true } });
    assert.strictEqual(achTM.length, 1);
    assert.strictEqual(achTM[0].placement, 2, 'Team Member received 2nd place');

    // Verify Winner 1 and Winner 3 active achievements are 0 (old awards revoked/superseded)
    const ach1 = await adminPrisma.studentAchievement.findMany({ where: { userId: studentWinner1Id, isActive: true } });
    assert.strictEqual(ach1.length, 0, 'Winner 1 award was revoked/superseded in Revision 2');

    const ach3 = await adminPrisma.studentAchievement.findMany({ where: { userId: studentWinner3Id, isActive: true } });
    assert.strictEqual(ach3.length, 0, 'Winner 3 award was revoked/superseded in Revision 2');
  });

  it('2.3: Withdrawing results deactivates achievements', async () => {
    // Withdraw results
    const res = await withdrawResults(competitionEventId, platformAdminId, 'Auditing competition logs');
    assert.strictEqual(res.success, true);

    // Verify active achievements for Winner 2, TeamLeader, and TeamMember were deactivated
    const activeTL = await adminPrisma.studentAchievement.findMany({
      where: { userId: studentTeamLeaderId, isActive: true },
    });
    assert.strictEqual(activeTL.length, 0, 'Team Leader achievement deactivated');

    const activeTM = await adminPrisma.studentAchievement.findMany({
      where: { userId: studentTeamMemberId, isActive: true },
    });
    assert.strictEqual(activeTM.length, 0, 'Team Member achievement deactivated');

    const active2 = await adminPrisma.studentAchievement.findMany({
      where: { userId: studentWinner2Id, isActive: true },
    });
    assert.strictEqual(active2.length, 0, 'Winner 2 achievement deactivated');
  });

  it('2.4: Restoring results re-activates achievements', async () => {
    const res = await restoreResults(competitionEventId, platformAdminId, 'Audit verified results valid');
    assert.strictEqual(res.success, true);

    // Achievements restored
    const compTL = await adminPrisma.studentAchievement.findMany({
      where: { userId: studentTeamLeaderId, isActive: true },
    });
    assert.strictEqual(compTL.length, 1);
    assert.strictEqual(compTL[0].placement, 2);

    const comp2 = await adminPrisma.studentAchievement.findMany({
      where: { userId: studentWinner2Id, isActive: true },
    });
    assert.strictEqual(comp2.length, 1);
    assert.strictEqual(comp2[0].placement, 1);
  });
});
