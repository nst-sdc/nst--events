import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { prisma } from '../../src/lib/prisma';
import { signJwt } from '../../src/lib/jwt';
import { createTeam, joinTeam, leaveTeam, removeMember } from '../../src/modules/teams/teams.service';
import { deleteEventForm, submitEventFormResponses } from '../../src/modules/event-forms/event-forms.service';
import { registerEvent } from '../../src/modules/registrations/registrations.service';
import { leaderboardService } from '../../src/modules/leaderboard/leaderboard.service';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Phase 1 Remediation Integration Suite', () => {
  const runId = Date.now().toString().slice(-6);

  // Users
  const leaderAId = randomUUID();
  const leaderBId = randomUUID();
  const memberAId = randomUUID();
  const memberBId = randomUUID();
  const outsiderId = randomUUID();
  const platformAdminId = randomUUID();
  const organizerId = randomUUID();

  // Privacy Users
  const publicStudentId = randomUUID();
  const unlistedStudentId = randomUUID();
  const anonStudentId = randomUUID();

  // Events & Clubs
  const clubId = randomUUID();
  const teamEventId = randomUUID();
  const formEventId = randomUUID();

  // Tokens
  let leaderAToken: string;
  let memberAToken: string;
  let leaderBToken: string;
  let organizerToken: string;
  let adminToken: string;
  let anonStudentToken: string;
  let unlistedStudentToken: string;
  let publicToken: string;

  let teamAId: string;
  let teamBId: string;

  beforeAll(async () => {
    // 1. Create Club
    await adminPrisma.club.create({
      data: {
        id: clubId,
        name: `Club Phase1 ${runId}`,
      },
    });

    // 2. Create Users
    await adminPrisma.user.createMany({
      data: [
        { id: leaderAId, email: `leadA_${runId}@adypu.edu.in`, fullName: 'Leader A', globalRole: 'STUDENT', googleSub: `sub_la_${runId}` },
        { id: memberAId, email: `memA_${runId}@adypu.edu.in`, fullName: 'Member A', globalRole: 'STUDENT', googleSub: `sub_ma_${runId}` },
        { id: leaderBId, email: `leadB_${runId}@adypu.edu.in`, fullName: 'Leader B', globalRole: 'STUDENT', googleSub: `sub_lb_${runId}` },
        { id: memberBId, email: `memB_${runId}@adypu.edu.in`, fullName: 'Member B', globalRole: 'STUDENT', googleSub: `sub_mb_${runId}` },
        { id: outsiderId, email: `outsider_${runId}@adypu.edu.in`, fullName: 'Outsider', globalRole: 'STUDENT', googleSub: `sub_out_${runId}` },
        { id: organizerId, email: `org_${runId}@adypu.edu.in`, fullName: 'Organizer', globalRole: 'STUDENT', googleSub: `sub_org_${runId}` },
        { id: platformAdminId, email: `admin_${runId}@nst.com`, fullName: 'Platform Admin', globalRole: 'PLATFORM_ADMIN', googleSub: `sub_adm_${runId}` },
        { id: publicStudentId, email: `pub_${runId}@adypu.edu.in`, fullName: 'Public Student', globalRole: 'STUDENT', googleSub: `sub_pub_${runId}` },
        { id: unlistedStudentId, email: `unlisted_${runId}@adypu.edu.in`, fullName: 'Unlisted Student', globalRole: 'STUDENT', googleSub: `sub_unl_${runId}` },
        { id: anonStudentId, email: `anon_${runId}@adypu.edu.in`, fullName: 'Secret Student', globalRole: 'STUDENT', googleSub: `sub_sec_${runId}` },
      ],
    });

    await adminPrisma.clubMembership.create({
      data: {
        userId: organizerId,
        clubId,
        role: 'CLUB_ADMIN',
      },
    });

    // Generate JWTs
    leaderAToken = signJwt({ userId: leaderAId, email: `leadA_${runId}@adypu.edu.in`, globalRole: 'STUDENT' });
    memberAToken = signJwt({ userId: memberAId, email: `memA_${runId}@adypu.edu.in`, globalRole: 'STUDENT' });
    leaderBToken = signJwt({ userId: leaderBId, email: `leadB_${runId}@adypu.edu.in`, globalRole: 'STUDENT' });
    organizerToken = signJwt({ userId: organizerId, email: `org_${runId}@adypu.edu.in`, globalRole: 'STUDENT' });
    adminToken = signJwt({ userId: platformAdminId, email: `admin_${runId}@nst.com`, globalRole: 'PLATFORM_ADMIN' });
    anonStudentToken = signJwt({ userId: anonStudentId, email: `anon_${runId}@adypu.edu.in`, globalRole: 'STUDENT' });
    unlistedStudentToken = signJwt({ userId: unlistedStudentId, email: `unlisted_${runId}@adypu.edu.in`, globalRole: 'STUDENT' });
    publicToken = signJwt(publicStudentId, 1);

    // 3. Create Events
    await adminPrisma.event.createMany({
      data: [
        {
          id: teamEventId,
          title: `Team Event ${runId}`,
          description: 'Team event testing member removal',
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'TEAM',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'HACKATHON',
          createdBy: leaderAId,
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
          registrationStartTime: new Date(Date.now() - 3600000),
          registrationEndTime: new Date(Date.now() + 3600000),
          metadata: { minimum_team_size: 2, maximum_team_size: 4 },
        },
        {
          id: formEventId,
          title: `Form Event ${runId}`,
          description: 'Form event testing form deletion and registration questionnaire',
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'INDIVIDUAL',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'WORKSHOP',
          createdBy: leaderAId,
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
          registrationStartTime: new Date(Date.now() - 3600000),
          registrationEndTime: new Date(Date.now() + 3600000),
        },
      ],
    });

    await adminPrisma.eventClub.create({
      data: {
        eventId: formEventId,
        clubId,
        isPrimary: true,
      },
    });

    // Create Team A and Team B
    const resA = await createTeam(leaderAId, teamEventId, `Team A ${runId}`);
    teamAId = resA.team_id;
    await joinTeam(memberAId, teamAId);

    const resB = await createTeam(leaderBId, teamEventId, `Team B ${runId}`);
    teamBId = resB.team_id;
    await joinTeam(memberBId, teamBId);
  });

  afterAll(async () => {
    try {
      await adminPrisma.eventRegistrationResponse.deleteMany({ where: { eventRegistration: { eventId: { in: [teamEventId, formEventId] } } } });
      await adminPrisma.eventFormField.deleteMany({ where: { eventId: { in: [teamEventId, formEventId] } } });
      await adminPrisma.eventForm.deleteMany({ where: { eventId: { in: [teamEventId, formEventId] } } });
      await adminPrisma.eventRegistration.deleteMany({ where: { eventId: { in: [teamEventId, formEventId] } } });
      await adminPrisma.team.deleteMany({ where: { eventId: teamEventId } });
      await adminPrisma.eventClub.deleteMany({ where: { eventId: { in: [teamEventId, formEventId] } } });
      await adminPrisma.event.deleteMany({ where: { id: { in: [teamEventId, formEventId] } } });
      await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
      await adminPrisma.club.deleteMany({ where: { id: clubId } });
      await adminPrisma.studentSlugHistory.deleteMany({ where: { userId: { in: [publicStudentId, unlistedStudentId, anonStudentId] } } });
      await adminPrisma.studentProfile.deleteMany({ where: { userId: { in: [publicStudentId, unlistedStudentId, anonStudentId] } } });
      await adminPrisma.leaderboardScore.deleteMany({ where: { userId: { in: [publicStudentId, unlistedStudentId, anonStudentId] } } });
      await adminPrisma.user.deleteMany({
        where: {
          id: {
            in: [
              leaderAId,
              leaderBId,
              memberAId,
              memberBId,
              outsiderId,
              organizerId,
              platformAdminId,
              publicStudentId,
              unlistedStudentId,
              anonStudentId,
            ],
          },
        },
      });
    } catch {}
  });

  // =========================================================================
  // WORKSTREAM 1: Team Member Removal Authorization (FINDING-TEAM-01)
  // =========================================================================
  describe('Workstream 1: Team Member Removal Authorization', () => {
    it('1.1: Non-leader member cannot remove another member (forbidden)', async () => {
      await assert.rejects(
        async () => {
          await removeMember(memberAId, teamAId, leaderAId);
        },
        (err: any) => err.statusCode === 400 || err.message.includes('Only the leader can remove members')
      );
    });

    it('1.2: Leader of Team A cannot remove member from Team B (forbidden)', async () => {
      await assert.rejects(
        async () => {
          await removeMember(leaderAId, teamBId, memberBId);
        },
        (err: any) => err.statusCode === 400 || err.message.includes('Only the leader can remove members')
      );
    });

    it('1.3: Leader cannot remove themselves via removeMember (must use leave team)', async () => {
      await assert.rejects(
        async () => {
          await removeMember(leaderAId, teamAId, leaderAId);
        },
        (err: any) => err.statusCode === 400 && err.message.includes('Leader cannot be removed')
      );
    });

    it('1.4: Leader attempting to remove user not in the team throws Member not found (U0039)', async () => {
      await assert.rejects(
        async () => {
          await removeMember(leaderAId, teamAId, outsiderId);
        },
        (err: any) => err.statusCode === 404 || err.message.includes('MEMBER_NOT_IN_TEAM') || err.message.includes('Member not found in team')
      );
    });

    it('1.5: Authorized team leader can remove eligible member of their own team', async () => {
      // Leader A removes Member A from Team A
      await removeMember(leaderAId, teamAId, memberAId);

      // Verify Member A registration is CANCELLED and soft-deleted
      const reg = await adminPrisma.eventRegistration.findFirst({
        where: { eventId: teamEventId, teamId: teamAId, userId: memberAId },
      });
      assert.ok(reg);
      assert.strictEqual(reg.registrationStatus, 'CANCELLED');
      assert.ok(reg.deletedAt !== null);

      // Verify audit log exists
      const logs = await adminPrisma.$queryRaw<Array<{ action: string; actor_id: string }>>`
        SELECT action, actor_id::text FROM audit_logs
        WHERE entity_id = ${teamAId}::uuid AND action = 'TEAM_MEMBER_REMOVED_BY_LEADER'
      `;
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].actor_id, leaderAId);
    });

    it('1.6: Platform admin can remove a member from any team via leave_team RPC', async () => {
      // Platform admin removes memberB from teamB
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${platformAdminId}, true)`;
        return tx.$queryRaw<{ leave_team: string[] }[]>`
          SELECT leave_team(${teamEventId}::uuid, ${teamBId}::uuid, ${memberBId}::uuid);
        `;
      });
      assert.ok(result);

      const regB = await adminPrisma.eventRegistration.findFirst({
        where: { eventId: teamEventId, teamId: teamBId, userId: memberBId },
      });
      assert.ok(regB);
      assert.strictEqual(regB.registrationStatus, 'CANCELLED');
      assert.ok(regB.deletedAt !== null);
    });
  });

  // =========================================================================
  // WORKSTREAM 2: Supplemental Form Deletion and Registration Integrity (FINDING-FORM-01)
  // =========================================================================
  describe('Workstream 2: Supplemental Form Deletion & Registration Integrity', () => {
    let defRegFieldDefId: string;
    let suppFieldDefId: string;
    let suppFormId: string;

    it('2.1: Setup default registration questionnaire and supplemental form', async () => {
      // Create shared field definitions
      const defRegField = await adminPrisma.fieldDefinition.create({
        data: {
          key: `tshirt_size_${runId}`,
          label: 'T-Shirt Size',
          fieldType: 'TEXT',
          isReusable: true,
        },
      });
      defRegFieldDefId = defRegField.id;

      const suppField = await adminPrisma.fieldDefinition.create({
        data: {
          key: `workshop_feedback_${runId}`,
          label: 'Session Feedback Rating',
          fieldType: 'TEXT',
          isReusable: false,
        },
      });
      suppFieldDefId = suppField.id;

      // 1. Attach default registration field (formId: null)
      await adminPrisma.eventFormField.create({
        data: {
          eventId: formEventId,
          formId: null,
          fieldDefinitionId: defRegFieldDefId,
          isRequired: true,
          order: 1,
        },
      });

      // 2. Create supplemental form
      const suppForm = await adminPrisma.eventForm.create({
        data: {
          eventId: formEventId,
          purpose: 'FEEDBACK',
          title: `Post-Workshop Feedback ${runId}`,
          publishedAt: new Date(),
        },
      });
      suppFormId = suppForm.id;

      // Attach question to supplemental form (isRequired: true)
      await adminPrisma.eventFormField.create({
        data: {
          eventId: formEventId,
          formId: suppFormId,
          fieldDefinitionId: suppFieldDefId,
          isRequired: true,
          order: 1,
        },
      });

      // Verify initial state: exactly 1 default registration field
      const regFieldsBefore = await adminPrisma.eventFormField.findMany({
        where: { eventId: formEventId, formId: null },
      });
      assert.strictEqual(regFieldsBefore.length, 1);
      assert.strictEqual(regFieldsBefore[0].fieldDefinitionId, defRegFieldDefId);
    });

    it('2.2: Eligible student registers answering only the default registration questionnaire', async () => {
      // Outsider registers providing only T-Shirt Size
      const reg = await registerEvent(outsiderId, formEventId, [
        { fieldDefinitionId: defRegFieldDefId, value: 'XL' },
      ]);
      assert.ok(reg);
      assert.strictEqual(reg.status, 'REGISTERED');
    });

    it('2.3: Student submits response to supplemental form', async () => {
      const resp = await submitEventFormResponses(outsiderId, formEventId, suppFormId, [
        { fieldDefinitionId: suppFieldDefId, value: '5 Stars Excellent' },
      ]);
      assert.strictEqual(resp.length, 1);
      assert.strictEqual(resp[0].value, '5 Stars Excellent');
    });

    it('2.4: Attempting to delete a form with responses is rejected and preserves records', async () => {
      // 1. Service layer rejection
      await assert.rejects(
        async () => {
          await deleteEventForm(organizerId, formEventId, suppFormId);
        },
        (err: any) => err.statusCode === 400 && err.message.includes('Cannot delete a form that already has responses')
      );

      // 2. Database foreign key RESTRICT rejection
      await assert.rejects(
        async () => {
          await adminPrisma.eventForm.delete({ where: { id: suppFormId } });
        },
        (err: any) => err.message.includes('violates foreign key constraint') || err.code === 'P2003'
      );

      // Verify responses and form are preserved
      const savedResponses = await adminPrisma.eventRegistrationResponse.findMany({
        where: { formId: suppFormId },
      });
      assert.strictEqual(savedResponses.length, 1);
    });

    it('2.5: Deleting a form without responses cascades fields and DOES NOT contaminate registration form', async () => {
      // Create a temporary supplemental form with 0 responses
      const emptyForm = await adminPrisma.eventForm.create({
        data: {
          eventId: formEventId,
          purpose: 'CUSTOM',
          title: `Temporary Form ${runId}`,
        },
      });

      const tempFieldDef = await adminPrisma.fieldDefinition.create({
        data: { key: `temp_field_${runId}`, label: 'Temp Field', fieldType: 'TEXT' },
      });

      await adminPrisma.eventFormField.create({
        data: {
          eventId: formEventId,
          formId: emptyForm.id,
          fieldDefinitionId: tempFieldDef.id,
          isRequired: true,
          order: 1,
        },
      });

      // Delete the empty form via deleteEventForm
      await deleteEventForm(organizerId, formEventId, emptyForm.id);

      // Invariant check: Default registration questionnaire MUST STILL HAVE EXACTLY 1 FIELD!
      const regFieldsAfter = await adminPrisma.eventFormField.findMany({
        where: { eventId: formEventId, formId: null },
      });
      assert.strictEqual(regFieldsAfter.length, 1, 'Default registration questionnaire must never be contaminated');
      assert.strictEqual(regFieldsAfter[0].fieldDefinitionId, defRegFieldDefId);

      // The child question was cascaded, NOT orphaned to form_id = null
      const tempField = await adminPrisma.eventFormField.findFirst({
        where: { fieldDefinitionId: tempFieldDef.id },
      });
      assert.strictEqual(tempField, null, 'Deleted form fields must be cascaded/deleted, not retained with form_id = null');
    });
  });

  // =========================================================================
  // WORKSTREAM 3: Student Identity Privacy (FINDING-PRIVACY-01 & PRIVACY-02)
  // =========================================================================
  describe('Workstream 3: Student Identity Privacy & Leaderboard Projection', () => {
    const pubVanity = `pub-student-${runId}`;
    const unlistedVanity1 = `unlisted-old-${runId}`;
    const unlistedVanity2 = `unlisted-new-${runId}`;
    const anonVanity = `secret-student-${runId}`;
    let anonSlug: string;

    beforeAll(async () => {
      // 1. Setup Public Student (identity: true, directory_listed: true)
      await adminPrisma.studentProfile.update({
        where: { userId: publicStudentId },
        data: {
          slug: pubVanity,
          directoryListed: true,
          sectionVisibility: { identity: true, name: true, avatar: true },
        },
      });

      // 2. Setup Unlisted Student (identity: true, directory_listed: false)
      await adminPrisma.studentProfile.update({
        where: { userId: unlistedStudentId },
        data: {
          slug: unlistedVanity2,
          directoryListed: false,
          sectionVisibility: { identity: true, name: true, avatar: true },
        },
      });
      // Add historical vanity slug for unlisted student
      await adminPrisma.studentSlugHistory.create({
        data: {
          userId: unlistedStudentId,
          slug: unlistedVanity1,
        },
      });

      // 3. Setup Secret Student (identity: false, rotated to anonymous slug)
      anonSlug = `student-a${runId.padStart(7, '0')}`;
      await adminPrisma.studentProfile.update({
        where: { userId: anonStudentId },
        data: {
          slug: anonSlug,
          directoryListed: false,
          sectionVisibility: { identity: false, name: false, avatar: false },
        },
      });
      // Save old real-name vanity slug to history
      await adminPrisma.studentSlugHistory.create({
        data: {
          userId: anonStudentId,
          slug: anonVanity,
        },
      });

      // 4. Award leaderboard scores
      await adminPrisma.leaderboardScore.createMany({
        data: [
          { userId: publicStudentId, points: 300, reason: 'ATTENDANCE', sourceId: randomUUID(), clubId },
          { userId: unlistedStudentId, points: 200, reason: 'ATTENDANCE', sourceId: randomUUID(), clubId },
          { userId: anonStudentId, points: 500, reason: 'ATTENDANCE', sourceId: randomUUID(), clubId },
        ],
      });

      // Refresh materialized view
      await leaderboardService.refreshLeaderboards();
    });

    it('3.1: Public profile displays real full name and appears in directory', async () => {
      const res = await request(app).get(`/v1/students/${pubVanity}`).set('X-App-Version', '1.0.0');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.full_name, 'Public Student');

      const dirRes = await request(app).get('/v1/students').set('X-App-Version', '1.0.0');
      assert.strictEqual(dirRes.status, 200);
      const inDir = dirRes.body.data.some((s: any) => s.user_id === publicStudentId);
      assert.strictEqual(inDir, true, 'Public student must appear in directory');
    });

    it('3.2: Unlisted profile displays full name on direct link, excluded from directory, preserves historical vanity redirect', async () => {
      // Direct access returns full name because identity is visible
      const res = await request(app).get(`/v1/students/${unlistedVanity2}`).set('X-App-Version', '1.0.0');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.full_name, 'Unlisted Student');

      // Excluded from directory
      const dirRes = await request(app).get('/v1/students').set('X-App-Version', '1.0.0');
      const inDir = dirRes.body.data.some((s: any) => s.user_id === unlistedStudentId);
      assert.strictEqual(inDir, false, 'Unlisted student must be excluded from directory search');

      // Historical vanity redirect (unlistedVanity1 -> unlistedVanity2) works because identity is visible
      const redirectRows = await adminPrisma.$queryRaw<Array<{ canonical_slug: string }>>`
        SELECT canonical_slug FROM lookup_student_slug_redirect(${unlistedVanity1})
      `;
      assert.strictEqual(redirectRows.length, 1);
      assert.strictEqual(redirectRows[0].canonical_slug, unlistedVanity2);

      const redirectRes = await request(app).get(`/v1/students/${unlistedVanity1}`).set('X-App-Version', '1.0.0');
      assert.strictEqual(redirectRes.status, 200);
      assert.strictEqual(redirectRes.body.redirect, true);
      assert.strictEqual(redirectRes.body.canonical_slug, unlistedVanity2);
    });

    it('3.3: Hidden identity profile masks name to null and BLOCKS deanonymizing historical slug redirects', async () => {
      // Direct anonymous slug returns null name
      const res = await request(app).get(`/v1/students/${anonSlug}`).set('X-App-Version', '1.0.0');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.full_name, null, 'Hidden identity must mask full_name to null');

      // Requesting old vanity slug must NOT redirect to anonymous hash
      const redirectRows = await adminPrisma.$queryRaw<Array<{ canonical_slug: string }>>`
        SELECT canonical_slug FROM lookup_student_slug_redirect(${anonVanity})
      `;
      assert.strictEqual(redirectRows.length, 0, 'lookup_student_slug_redirect must return empty set when identity is hidden');

      // API request returns 404 (does not leak anonymous handle)
      const redirectReq = await request(app).get(`/v1/students/${anonVanity}`).set('X-App-Version', '1.0.0');
      assert.strictEqual(redirectReq.status, 404);
    });

    it('3.4: Global and club-scoped leaderboard masks hidden identities to Anonymous Student while preserving visible identities', async () => {
      // 1. Global leaderboard materialized view
      const lbRows = await adminPrisma.$queryRawUnsafe<any[]>(
        `SELECT user_id, display_name FROM student_leaderboard_mv WHERE user_id IN ('${publicStudentId}', '${unlistedStudentId}', '${anonStudentId}')`
      );
      const pubEntry = lbRows.find((d) => d.user_id === publicStudentId);
      const unlistedEntry = lbRows.find((d) => d.user_id === unlistedStudentId);
      const anonEntry = lbRows.find((d) => d.user_id === anonStudentId);

      assert.ok(pubEntry);
      assert.strictEqual(pubEntry.display_name, 'Public Student');

      assert.ok(unlistedEntry);
      assert.strictEqual(unlistedEntry.display_name, 'Unlisted Student', 'Unlisted student with identity:true must display name');

      assert.ok(anonEntry);
      assert.strictEqual(anonEntry.display_name, 'Anonymous Student', 'Hidden identity student must be masked to Anonymous Student');

      // 2. Club-scoped leaderboard
      const clubLb = await leaderboardService.getClubScopedStudentLeaderboard(platformAdminId, clubId, { limit: 10 });
      const clubAnonEntry = clubLb.data.find((d) => d.user_id === anonStudentId);
      assert.ok(clubAnonEntry);
      assert.strictEqual(clubAnonEntry.display_name, 'Anonymous Student', 'Club-scoped leaderboard must also mask hidden identity');
    });

    it('3.5: Critical Privacy Transition Gate: Immediate fail-closed masking when identity transitions to hidden without MV refresh', async () => {
      // 1. Initially public student is visible on global leaderboard API
      const initialLb = await leaderboardService.getStudentLeaderboard({ limit: 100 });
      const initialEntry = initialLb.data.find((d) => d.user_id === publicStudentId);
      assert.ok(initialEntry);
      assert.strictEqual(initialEntry.display_name, 'Public Student', 'Initially visible student displays real name');

      // 2. Student updates privacy settings to hide identity
      await adminPrisma.studentProfile.update({
        where: { userId: publicStudentId },
        data: {
          sectionVisibility: { identity: false, name: false },
        },
      });

      // 3. Confirm that the materialized view itself is STALE and still stores the real name
      const staleMvRow = await adminPrisma.$queryRawUnsafe<any[]>(
        `SELECT display_name FROM student_leaderboard_mv WHERE user_id = '${publicStudentId}'`
      );
      assert.strictEqual(
        staleMvRow[0].display_name,
        'Public Student',
        'Materialized view row is deliberately unrefreshed and stale'
      );

      // 4. Critical Gate: Global leaderboard API must immediately fail-closed and return Anonymous Student
      const transitionedLb = await leaderboardService.getStudentLeaderboard({ limit: 100 });
      const transitionedEntry = transitionedLb.data.find((d) => d.user_id === publicStudentId);
      assert.ok(transitionedEntry);
      assert.strictEqual(
        transitionedEntry.display_name,
        'Anonymous Student',
        'Concealment guarantee must NOT depend on delayed or background MV refresh'
      );

      // HTTP endpoint also immediately returns Anonymous Student
      const httpRes = await request(app)
        .get('/v1/leaderboard/students?limit=100')
        .set('Authorization', `Bearer ${publicToken}`)
        .set('X-App-Version', '1.0.0');
      assert.strictEqual(httpRes.status, 200);
      const httpEntry = httpRes.body.data.find((d: any) => d.user_id === publicStudentId);
      assert.ok(httpEntry);
      assert.strictEqual(httpEntry.display_name, 'Anonymous Student');

      // 5. Cleanup / revert public student visibility
      await adminPrisma.studentProfile.update({
        where: { userId: publicStudentId },
        data: {
          sectionVisibility: { identity: true, name: true },
        },
      });
    });
  });
});
