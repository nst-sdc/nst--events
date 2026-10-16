import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

describe('NST Event Results & Recognition Integration Suite', { concurrency: false }, () => {
  const clubAdminId = randomUUID();
  const student1Id = randomUUID();
  const student2Id = randomUUID();
  const student3Id = randomUUID();
  const unauthorizedStudentId = randomUUID();

  const clubId = randomUUID();
  const individualEventId = randomUUID();
  const teamEventId = randomUUID();
  const restrictedEventId = randomUUID();
  const otherEventId = randomUUID();

  let teamId: string;
  let regStudent1Solo: string;
  let regStudent2Solo: string;
  let regStudent1Team: string;
  let regStudent2Team: string;
  let regOtherEvent: string;
  let regCancelledSolo: string;

  let clubAdminToken: string;
  let student1Token: string;
  let unauthorizedStudentToken: string;

  const testEmails = [
    'club.admin.results@adypu.edu.in',
    'student1.results@adypu.edu.in',
    'student2.results@newtonschool.co',
    'student3.results@adypu.edu.in',
    'unauth.results@adypu.edu.in',
  ];

  const cleanup = async () => {
    try {
      const userIds = [student1Id, student2Id, student3Id, unauthorizedStudentId, clubAdminId];
      const existingUsers = await adminPrisma.user.findMany({
        where: {
          OR: [
            { id: { in: userIds } },
            { email: { in: testEmails } },
            { googleSub: { in: ['sub_club_admin_res', 'sub_student1_res', 'sub_student2_res', 'sub_student3_res', 'sub_unauth_res'] } },
          ],
        },
        select: { id: true },
      });
      const allUserIds = Array.from(new Set([...userIds, ...existingUsers.map((u) => u.id)]));
      const eventIds = [individualEventId, teamEventId, restrictedEventId, otherEventId];

      const existingClubs = await adminPrisma.club.findMany({
        where: { OR: [{ id: clubId }, { name: 'Results Test Club' }] },
        select: { id: true },
      });
      const allClubIds = Array.from(new Set([clubId, ...existingClubs.map((c) => c.id)]));

      const existingEvents = await adminPrisma.event.findMany({
        where: {
          OR: [
            { id: { in: eventIds } },
            { slug: { in: ['solo-coding-champ', 'hackathon-grand-prix', 'restricted-faculty-cup', 'unrelated-meetup'] } },
            { createdBy: { in: allUserIds } },
          ],
        },
        select: { id: true },
      });
      const allEventIds = Array.from(new Set([...eventIds, ...existingEvents.map((e) => e.id)]));

      await adminPrisma.studentAchievement.deleteMany({});
      await adminPrisma.resultNotificationOutbox.deleteMany({});
      await adminPrisma.resultReport.deleteMany({});
      await adminPrisma.resultAuditLog.deleteMany({});
      await adminPrisma.awardProjectLink.deleteMany({});
      await adminPrisma.awardRecipientMember.deleteMany({});
      await adminPrisma.awardRecipient.deleteMany({});
      await adminPrisma.eventAward.deleteMany({});
      await adminPrisma.eventResultRevision.deleteMany({});
      await adminPrisma.eventResultSet.deleteMany({});
      await adminPrisma.eventRegistration.deleteMany({ where: { OR: [{ userId: { in: allUserIds } }, { eventId: { in: allEventIds } }] } });
      await adminPrisma.team.deleteMany({ where: { OR: [{ leaderId: { in: allUserIds } }, { eventId: { in: allEventIds } }] } });
      await adminPrisma.eventClub.deleteMany({ where: { OR: [{ eventId: { in: allEventIds } }, { clubId: { in: allClubIds } }] } });
      await adminPrisma.eventSlugHistory.deleteMany({ where: { eventId: { in: allEventIds } } });
      await adminPrisma.event.deleteMany({ where: { id: { in: allEventIds } } });
      await adminPrisma.clubMembership.deleteMany({ where: { OR: [{ userId: { in: allUserIds } }, { clubId: { in: allClubIds } }] } });
      await adminPrisma.club.deleteMany({ where: { id: { in: allClubIds } } });
      await adminPrisma.userAcademicProfile.deleteMany({ where: { userId: { in: allUserIds } } });
      await adminPrisma.notification.deleteMany({ where: { userId: { in: allUserIds } } });
      await adminPrisma.user.deleteMany({ where: { id: { in: allUserIds } } });
    } catch (e) {
      console.error('Cleanup error:', e);
      throw e;
    }
  };

  before(async () => {
    await cleanup();

    // 1. Seed Users
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES
      (${clubAdminId}::uuid, 'club.admin.results@adypu.edu.in', 'sub_club_admin_res', 'Admin Dave', 'STUDENT'),
      (${student1Id}::uuid, 'student1.results@adypu.edu.in', 'sub_student1_res', 'Alice Solo', 'STUDENT'),
      (${student2Id}::uuid, 'student2.results@newtonschool.co', 'sub_student2_res', 'Bob Duo', 'STUDENT'),
      (${student3Id}::uuid, 'student3.results@adypu.edu.in', 'sub_student3_res', 'Charlie Member', 'STUDENT'),
      (${unauthorizedStudentId}::uuid, 'unauth.results@adypu.edu.in', 'sub_unauth_res', 'Eve Stranger', 'STUDENT');
    `;

    // 2. Seed Club & Membership for clubAdmin
    await adminPrisma.$executeRaw`
      INSERT INTO clubs (id, name, status) VALUES
      (${clubId}::uuid, 'Results Test Club', 'ACTIVE');
    `;

    await adminPrisma.$executeRaw`
      INSERT INTO club_memberships (id, club_id, user_id, role) VALUES
      (gen_random_uuid(), ${clubId}::uuid, ${clubAdminId}::uuid, 'CLUB_ADMIN');
    `;

    // 3. Seed Events
    const now = new Date();
    const pastStart = new Date(now.getTime() - 86400000 * 2);
    const pastEnd = new Date(now.getTime() - 86400000);

    // Individual Competition Event
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, event_type, state, visibility, slug, registration_type, start_time, end_time, created_by) VALUES
      (${individualEventId}::uuid, 'Solo Coding Championship', 'COMPETITION', 'PUBLISHED', 'PUBLIC', 'solo-coding-champ', 'INDIVIDUAL', ${pastStart}, ${pastEnd}, ${clubAdminId}::uuid),
      (${teamEventId}::uuid, 'Hackathon Grand Prix', 'HACKATHON', 'PUBLISHED', 'PUBLIC', 'hackathon-grand-prix', 'TEAM', ${pastStart}, ${pastEnd}, ${clubAdminId}::uuid),
      (${restrictedEventId}::uuid, 'Restricted Faculty Cup', 'COMPETITION', 'PUBLISHED', 'RESTRICTED', 'restricted-faculty-cup', 'INDIVIDUAL', ${pastStart}, ${pastEnd}, ${clubAdminId}::uuid),
      (${otherEventId}::uuid, 'Unrelated Campus Meetup', 'MEETUP', 'PUBLISHED', 'PUBLIC', 'unrelated-meetup', 'INDIVIDUAL', ${pastStart}, ${pastEnd}, ${clubAdminId}::uuid);
    `;

    // Connect primary club
    await adminPrisma.$executeRaw`
      INSERT INTO event_clubs (event_id, club_id, is_primary) VALUES
      (${individualEventId}::uuid, ${clubId}::uuid, true),
      (${teamEventId}::uuid, ${clubId}::uuid, true),
      (${restrictedEventId}::uuid, ${clubId}::uuid, true);
    `;

    // 4. Seed Registrations
    regStudent1Solo = randomUUID();
    regStudent2Solo = randomUUID();
    regCancelledSolo = randomUUID();
    regOtherEvent = randomUUID();

    await adminPrisma.$executeRaw`
      INSERT INTO event_registrations (id, event_id, user_id, registration_status) VALUES
      (${regStudent1Solo}::uuid, ${individualEventId}::uuid, ${student1Id}::uuid, 'REGISTERED'),
      (${regStudent2Solo}::uuid, ${individualEventId}::uuid, ${student2Id}::uuid, 'REGISTERED'),
      (${regCancelledSolo}::uuid, ${individualEventId}::uuid, ${student3Id}::uuid, 'CANCELLED'),
      (${regOtherEvent}::uuid, ${otherEventId}::uuid, ${student3Id}::uuid, 'REGISTERED');
    `;

    // Team in Team Event
    teamId = randomUUID();
    await adminPrisma.$executeRaw`
      INSERT INTO teams (id, event_id, name, normalized_name, leader_id, status) VALUES
      (${teamId}::uuid, ${teamEventId}::uuid, 'Team CyberTech', 'team cybertech', ${student2Id}::uuid, 'REGISTERED');
    `;

    regStudent1Team = randomUUID();
    regStudent2Team = randomUUID();
    await adminPrisma.$executeRaw`
      INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status) VALUES
      (${regStudent1Team}::uuid, ${teamEventId}::uuid, ${student1Id}::uuid, ${teamId}::uuid, 'REGISTERED'),
      (${regStudent2Team}::uuid, ${teamEventId}::uuid, ${student2Id}::uuid, ${teamId}::uuid, 'REGISTERED');
    `;

    // Generate JWTs
    clubAdminToken = signJwt(clubAdminId);
    student1Token = signJwt(student1Id);
    unauthorizedStudentToken = signJwt(unauthorizedStudentId);
  });

  after(async () => {
    await cleanup();
  });

  // =========================================================================
  // 1. Authorization & BOLA
  // =========================================================================
  it('rejects unauthenticated access to organizer workspace with 401', async () => {
    const res = await request(app).get(`/v1/events/${individualEventId}/results/manage`);
    assert.strictEqual(res.status, 401);
  });

  it('rejects unauthorized student from managing results with 403', async () => {
    const res = await request(app)
      .get(`/v1/events/${individualEventId}/results/manage`)
      .set('Authorization', `Bearer ${unauthorizedStudentToken}`);
    assert.strictEqual(res.status, 403);
  });

  // =========================================================================
  // 2. Organizer Workspace & Eligibility Searches
  // =========================================================================
  it('initializes workspace for authorized event organizer', async () => {
    const res = await request(app)
      .get(`/v1/events/${individualEventId}/results/manage`)
      .set('Authorization', `Bearer ${clubAdminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.event.id, individualEventId);
    assert.ok(res.body.draft);
    assert.strictEqual(res.body.draft.status, 'DRAFT');
    assert.strictEqual(res.body.draft.revisionNumber, 1);
  });

  it('searches eligible individually registered students, excluding cancelled registrations', async () => {
    const res = await request(app)
      .get(`/v1/events/${individualEventId}/results/eligible-participants?search=Alice`)
      .set('Authorization', `Bearer ${clubAdminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.participants.length, 1);
    assert.strictEqual(res.body.participants[0].user_id, student1Id);
    assert.strictEqual(res.body.participants[0].full_name, 'Alice Solo');

    // Cancelled student3 should not appear in search
    const cancelledRes = await request(app)
      .get(`/v1/events/${individualEventId}/results/eligible-participants?search=Charlie`)
      .set('Authorization', `Bearer ${clubAdminToken}`);
    assert.strictEqual(cancelledRes.body.participants.length, 0);
  });

  it('searches eligible registered teams and returns roster', async () => {
    const res = await request(app)
      .get(`/v1/events/${teamEventId}/results/eligible-teams`)
      .set('Authorization', `Bearer ${clubAdminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.teams.length, 1);
    assert.strictEqual(res.body.teams[0].name, 'Team CyberTech');
    assert.strictEqual(res.body.teams[0].members.length, 2);
  });

  // =========================================================================
  // 3. Draft Saving & Validation
  // =========================================================================
  it('saves draft awards with individual winners and external recipients', async () => {
    const res = await request(app)
      .post(`/v1/events/${individualEventId}/results/draft`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        version: 1,
        awards: [
          {
            title: '1st Place Grand Winner',
            award_type: 'RANKED_PLACEMENT',
            placement: 1,
            description: 'Top algorithm optimization',
            prize_details: 'Rs. 25,000 Cash Prize',
            display_order: 1,
            is_tied: false,
            recipients: [
              {
                recipient_type: 'INDIVIDUAL',
                user_id: student1Id,
                registration_id: regStudent1Solo,
              },
            ],
          },
          {
            title: 'Best Innovation Special Award',
            award_type: 'SPECIAL_AWARD',
            description: 'Most creative architecture',
            display_order: 2,
            is_tied: false,
            recipients: [
              {
                recipient_type: 'INDIVIDUAL',
                user_id: student2Id,
                registration_id: regStudent2Solo,
              },
            ],
          },
          {
            title: 'Guest Honorable Mention',
            award_type: 'HONORABLE_MENTION',
            description: 'Invited participant display',
            display_order: 3,
            is_tied: false,
            recipients: [
              {
                recipient_type: 'EXTERNAL',
                external_name: 'Dr. Jane External',
                external_details: 'Visiting Developer',
              },
            ],
          },
        ],
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.version, 2);
  });

  it('rejects draft save when version does not match (concurrency control)', async () => {
    const res = await request(app)
      .post(`/v1/events/${individualEventId}/results/draft`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        version: 1, // Stale version (current is 2)
        awards: [],
      });

    assert.strictEqual(res.status, 409);
    assert.match(res.body.error || res.body.detail || '', /concurrently/i);
  });

  // =========================================================================
  // 4. Atomic Publication: Individual Winner (First-Class Individual Winner)
  // =========================================================================
  let publishedRevisionId: string;

  it('publishes individual competition results atomically and creates student achievements', async () => {
    // 1. Get workspace to get revision_id
    const ws = await request(app)
      .get(`/v1/events/${individualEventId}/results/manage`)
      .set('Authorization', `Bearer ${clubAdminToken}`);

    const draftRevisionId = ws.body.draft.id;
    const version = ws.body.draft.version;

    // 2. Publish
    const pubRes = await request(app)
      .post(`/v1/events/${individualEventId}/results/publish`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        revision_id: draftRevisionId,
        version,
        notify_winners: true,
        announce_participants: false,
      });

    if (pubRes.status !== 200) {
      console.error('pubRes failed:', JSON.stringify(pubRes.body, null, 2));
    }
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.success, true);
    publishedRevisionId = pubRes.body.revision_id;

    // 3. Verify exactly one active official achievement was created for Alice (1st place)
    const aliceAchievements = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM student_achievements
      WHERE user_id = ${student1Id}::uuid AND event_id = ${individualEventId}::uuid AND is_active = true
    `;
    assert.strictEqual(aliceAchievements.length, 1);
    assert.strictEqual(aliceAchievements[0].award_title, '1st Place Grand Winner');
    assert.strictEqual(aliceAchievements[0].placement, 1);
    assert.strictEqual(aliceAchievements[0].is_team_award, false);
    assert.strictEqual(aliceAchievements[0].team_id, null);

    // 4. Verify notification outbox entry created
    const outbox = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM result_notification_outbox
      WHERE recipient_user_id = ${student1Id}::uuid AND revision_id = ${publishedRevisionId}::uuid
    `;
    assert.strictEqual(outbox.length, 1);
    assert.strictEqual(outbox[0].notification_type, 'WINNER_NOTIFICATION');

    // 5. Verify in-app notification delivered
    const notifs = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM notifications WHERE user_id = ${student1Id}::uuid
    `;
    assert.strictEqual(notifs.length, 1);
    assert.match(notifs[0].body, /1st Place/i);
  });

  it('public visitor can view published official results by slug', async () => {
    const res = await request(app).get('/v1/events/public/solo-coding-champ/results');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'PUBLISHED');
    assert.strictEqual(res.body.event.title, 'Solo Coding Championship');
    assert.strictEqual(res.body.results.podium.length, 1);
    assert.strictEqual(res.body.results.podium[0].placement, 1);
    assert.strictEqual(res.body.results.podium[0].recipients[0].student.name, 'Alice Solo');
    assert.strictEqual(res.body.results.special_awards.length, 2);
  });

  it('rejects editing published revision in place (immutability)', async () => {
    const res = await request(app)
      .post(`/v1/events/${individualEventId}/results/draft`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        version: 2,
        awards: [],
      });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.error || res.body.detail || '', /No active draft found/i);
  });

  // =========================================================================
  // 5. Team Results: Confirmed Member Snapshots & Mixed Awards
  // =========================================================================
  it('publishes team results with confirmed member snapshots and mixed awards', async () => {
    // 1. Get workspace for teamEvent
    const ws = await request(app)
      .get(`/v1/events/${teamEventId}/results/manage`)
      .set('Authorization', `Bearer ${clubAdminToken}`);

    const draftId = ws.body.draft.id;
    let version = ws.body.draft.version;

    // 2. Save draft with Team 1st place AND Solo Best UI/UX (Mixed Awards)
    const draftRes = await request(app)
      .post(`/v1/events/${teamEventId}/results/draft`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        version,
        awards: [
          {
            title: 'Hackathon Champion Team',
            award_type: 'RANKED_PLACEMENT',
            placement: 1,
            display_order: 1,
            is_tied: false,
            recipients: [
              {
                recipient_type: 'TEAM',
                team_id: teamId,
                members: [
                  {
                    user_id: student1Id,
                    registration_id: regStudent1Team,
                    display_name: 'Alice Solo (Hacker)',
                    team_role: 'MEMBER',
                  },
                  {
                    user_id: student2Id,
                    registration_id: regStudent2Team,
                    display_name: 'Bob Duo (Leader)',
                    team_role: 'LEADER',
                  },
                ],
              },
            ],
          },
          {
            title: 'Best Individual Pitch',
            award_type: 'SPECIAL_AWARD',
            display_order: 2,
            is_tied: false,
            recipients: [
              {
                recipient_type: 'INDIVIDUAL',
                user_id: student1Id,
                registration_id: regStudent1Team,
              },
            ],
          },
        ],
      });

    assert.strictEqual(draftRes.status, 200);
    version = draftRes.body.version;

    // 3. Publish team results
    const pubRes = await request(app)
      .post(`/v1/events/${teamEventId}/results/publish`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        revision_id: draftId,
        version,
        notify_winners: true,
        announce_participants: false,
      });

    assert.strictEqual(pubRes.status, 200);

    // 4. Verify achievements: Both team members receive team achievement, Alice also receives individual achievement
    const bobAchievements = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM student_achievements
      WHERE user_id = ${student2Id}::uuid AND event_id = ${teamEventId}::uuid AND is_active = true
    `;
    assert.strictEqual(bobAchievements.length, 1);
    assert.strictEqual(bobAchievements[0].is_team_award, true);
    assert.strictEqual(bobAchievements[0].team_name_snapshot, 'Team CyberTech');

    const aliceTeamAchievements = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM student_achievements
      WHERE user_id = ${student1Id}::uuid AND event_id = ${teamEventId}::uuid AND is_active = true
    `;
    assert.strictEqual(aliceTeamAchievements.length, 2); // 1 team win + 1 individual pitch win
  });

  // =========================================================================
  // 6. Correction Workflow & Republication Reconciliation
  // =========================================================================
  it('creates correction draft and republishes corrected winner, reconciling achievements', async () => {
    // 1. Create correction draft
    const corrRes = await request(app)
      .post(`/v1/events/${individualEventId}/results/correction`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        correction_reason: 'Recounting algorithm benchmark scores showed Bob in 1st place',
      });

    assert.strictEqual(corrRes.status, 200);
    assert.strictEqual(corrRes.body.revision_number, 2);
    const newRevisionId = corrRes.body.revision_id;

    // 2. Fetch new draft workspace
    const ws = await request(app)
      .get(`/v1/events/${individualEventId}/results/manage`)
      .set('Authorization', `Bearer ${clubAdminToken}`);

    assert.strictEqual(ws.body.draft.id, newRevisionId);
    assert.strictEqual(ws.body.draft.revisionNumber, 2);
    let version = ws.body.draft.version;

    // 3. Update 1st place to Bob
    const saveRes = await request(app)
      .post(`/v1/events/${individualEventId}/results/draft`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        version,
        awards: [
          {
            title: '1st Place Grand Winner',
            award_type: 'RANKED_PLACEMENT',
            placement: 1,
            display_order: 1,
            is_tied: false,
            recipients: [
              {
                recipient_type: 'INDIVIDUAL',
                user_id: student2Id,
                registration_id: regStudent2Solo,
              },
            ],
          },
        ],
      });

    assert.strictEqual(saveRes.status, 200);
    version = saveRes.body.version;

    // 4. Republish corrected revision
    const pubRes = await request(app)
      .post(`/v1/events/${individualEventId}/results/publish`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        revision_id: newRevisionId,
        version,
        notify_winners: true,
        announce_participants: false,
      });

    assert.strictEqual(pubRes.status, 200);

    // 5. Verify Alice's old achievement is deactivated and Bob's achievement is active
    const aliceActive = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM student_achievements
      WHERE user_id = ${student1Id}::uuid AND event_id = ${individualEventId}::uuid AND is_active = true
    `;
    assert.strictEqual(aliceActive.length, 0);

    const bobActive = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM student_achievements
      WHERE user_id = ${student2Id}::uuid AND event_id = ${individualEventId}::uuid AND is_active = true
    `;
    assert.strictEqual(bobActive.length, 1);
    assert.strictEqual(bobActive[0].revision_id, newRevisionId);

    // 6. Public page reflects new winner and correction notice
    const pubView = await request(app).get('/v1/events/public/solo-coding-champ/results');
    assert.strictEqual(pubView.body.results.revision_number, 2);
    assert.strictEqual(pubView.body.results.is_correction, true);
    assert.strictEqual(pubView.body.results.podium[0].recipients[0].student.name, 'Bob Duo');
  });

  // =========================================================================
  // 7. Results Withdrawal & Restoration
  // =========================================================================
  it('withdraws results, hides public display, deactivates achievements, and allows restoration', async () => {
    // 1. Withdraw results
    const withdrawRes = await request(app)
      .post(`/v1/events/${individualEventId}/results/withdraw`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        withdrawal_reason: 'Under administrative audit',
      });

    assert.strictEqual(withdrawRes.status, 200);

    // 2. Public endpoint returns WITHDRAWN status
    const pubView = await request(app).get('/v1/events/public/solo-coding-champ/results');
    assert.strictEqual(pubView.body.status, 'WITHDRAWN');
    assert.strictEqual(pubView.body.results, null);

    // 3. Achievements deactivated
    const bobAchievements = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM student_achievements
      WHERE user_id = ${student2Id}::uuid AND event_id = ${individualEventId}::uuid AND is_active = true
    `;
    assert.strictEqual(bobAchievements.length, 0);

    // 4. Restore results
    const restoreRes = await request(app)
      .post(`/v1/events/${individualEventId}/results/restore`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        restoration_reason: 'Audit concluded, results verified',
      });

    assert.strictEqual(restoreRes.status, 200);

    // 5. Public endpoint active again
    const pubViewAfter = await request(app).get('/v1/events/public/solo-coding-champ/results');
    assert.strictEqual(pubViewAfter.body.status, 'PUBLISHED');

    // 6. Achievements reactivated
    const bobRestored = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM student_achievements
      WHERE user_id = ${student2Id}::uuid AND event_id = ${individualEventId}::uuid AND is_active = true
    `;
    assert.strictEqual(bobRestored.length, 1);
  });

  // =========================================================================
  // 8. Restricted Event Gating
  // =========================================================================
  it('gates restricted event results to authenticated institutional users', async () => {
    // Setup and publish results for restricted event
    const ws = await request(app)
      .get(`/v1/events/${restrictedEventId}/results/manage`)
      .set('Authorization', `Bearer ${clubAdminToken}`);

    const draftId = ws.body.draft.id;
    const version = ws.body.draft.version;

    await request(app)
      .post(`/v1/events/${restrictedEventId}/results/draft`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        version,
        awards: [
          {
            title: 'Faculty Cup 1st',
            award_type: 'RANKED_PLACEMENT',
            placement: 1,
            recipients: [
              {
                recipient_type: 'EXTERNAL',
                external_name: 'Prof. External Winner',
              },
            ],
          },
        ],
      });

    await request(app)
      .post(`/v1/events/${restrictedEventId}/results/publish`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        revision_id: draftId,
        version: version + 1,
        notify_winners: false,
        announce_participants: false,
      });

    // Anonymous visitor cannot discover or view restricted event results (404)
    const anonRes = await request(app).get('/v1/events/public/restricted-faculty-cup/results');
    assert.strictEqual(anonRes.status, 404);

    // Authenticated student receives PUBLISHED
    const authRes = await request(app)
      .get('/v1/events/public/restricted-faculty-cup/results')
      .set('Authorization', `Bearer ${student1Token}`);
    assert.strictEqual(authRes.body.status, 'PUBLISHED');
  });

  // =========================================================================
  // 9. Reporting Potential Inaccuracies
  // =========================================================================
  it('allows reporting an inaccuracy in published results', async () => {
    const res = await request(app)
      .post(`/v1/events/${individualEventId}/results/report`)
      .send({
        reason: 'Misspelled external winner display name',
        details: 'The name is spelled incorrectly on the official awards certificate.',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.report_id);
  });

  // =========================================================================
  // 10. Student Verified Achievements Query
  // =========================================================================
  it('returns active verified achievements for a student', async () => {
    const res = await request(app)
      .get(`/v1/events/users/${student2Id}/achievements`)
      .set('Authorization', `Bearer ${student1Token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.achievements));
    assert.ok(res.body.achievements.length >= 2); // 1st Place Solo + 1st Place Team
  });

  // =========================================================================
  // 11. Privacy & Security: Public Results Expose Only Approved Fields
  // =========================================================================
  it('strictly limits public winner fields (no emails, phone numbers, or private hashes)', async () => {
    const res = await request(app).get('/v1/events/public/solo-coding-champ/results');
    assert.strictEqual(res.status, 200);

    const winner = res.body.results.podium[0].recipients[0].student;
    assert.ok(winner.name, 'Expected student name to be present');
    assert.strictEqual(winner.email, undefined, 'Email MUST NOT be exposed in public results');
    assert.strictEqual(winner.phone, undefined, 'Phone MUST NOT be exposed in public results');
    assert.strictEqual(winner.googleSub, undefined, 'googleSub MUST NOT be exposed in public results');
    assert.strictEqual(winner.passwordHash, undefined, 'passwordHash MUST NOT be exposed');
  });

  // =========================================================================
  // 12. Privacy & Security: Restricted Event Achievements Hidden from Anonymous
  // =========================================================================
  it('filters out restricted event achievements when viewed anonymously', async () => {
    // Student 1 has achievements in both public and restricted events
    // Anonymous viewer query
    const anonRes = await request(app)
      .get(`/v1/events/users/${student2Id}/achievements`);

    assert.strictEqual(anonRes.status, 200);
    // None of the returned achievements should belong to restricted events
    for (const ach of anonRes.body.achievements) {
      assert.notStrictEqual(ach.event.id, restrictedEventId, 'Restricted event achievement must not leak to anonymous visitors');
    }
  });

  // =========================================================================
  // 13. Security: Ordinary Students Cannot Access Organizer Workspace or Audit Logs
  // =========================================================================
  it('blocks non-organizer students from accessing draft workspace and audit data', async () => {
    const res = await request(app)
      .get(`/v1/events/${individualEventId}/results/manage`)
      .set('Authorization', `Bearer ${unauthorizedStudentToken}`);

    assert.strictEqual(res.status, 403, 'Expected 403 Forbidden for non-organizer student');
  });

  // =========================================================================
  // 14. Notifications: Outbox Idempotency & Delivery Integrity
  // =========================================================================
  it('verifies notification outbox idempotency and in-app notification routing metadata', async () => {
    const outboxRecords = await adminPrisma.resultNotificationOutbox.findMany({
      where: { recipientUserId: student2Id },
    });

    assert.ok(outboxRecords.length > 0, 'Expected notification outbox records for winner');
    for (const rec of outboxRecords) {
      assert.ok(rec.idempotencyKey.includes('_WINNER'));
      assert.strictEqual(rec.deliveryStatus, 'DELIVERED');
    }

    const inAppNotifications = await adminPrisma.notification.findMany({
      where: { userId: student2Id },
    });

    assert.ok(inAppNotifications.length > 0, 'Expected in-app notification for winner');
    const resultsNotif = inAppNotifications.find((n) => (n.metadata as any)?.screen === 'EventResults');
    assert.ok(resultsNotif, 'Expected notification with screen: EventResults for deep-linking');
  });
});
