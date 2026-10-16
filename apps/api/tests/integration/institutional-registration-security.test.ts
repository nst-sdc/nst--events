import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { registerEvent } from '../../src/modules/registrations/registrations.service';
import { createTeam, joinTeam } from '../../src/modules/teams/teams.service';
import { isInstitutionalEmail, validateRegistrationEligibility } from '../../src/modules/events/events.service';
import { verifyIdToken } from '../../src/modules/auth/google.oauth';
import { ForbiddenError } from '../../src/lib/errors';
import sinon from 'sinon';
import { OAuth2Client } from 'google-auth-library';

describe('Institutional Registration Security & Domain Eligibility Integration', () => {
  let organizerId: string;
  let clubId: string;
  let eventId: string;
  let teamEventId: string;
  let existingTeamId: string;

  // Test User IDs
  let adypuUserId: string;
  let newtonUserId: string;
  let upperAdypuUserId: string;
  let mixedNewtonUserId: string;
  let unverifiedUserId: string;
  let lookalikeAdypuUserId: string;
  let lookalikeNewtonUserId: string;
  let testComUserId: string;
  let nstComUserId: string;
  let adminNonInstUserId: string;

  const timestamp = Date.now();
  const userIdsToClean: string[] = [];
  const eventIdsToClean: string[] = [];

  before(async () => {
    // 1. Create Organizer & Club
    const org = await adminPrisma.user.create({
      data: {
        email: `org_sec_${timestamp}@adypu.edu.in`,
        googleSub: `sub_org_${timestamp}`,
        fullName: 'Security Organizer',
        globalRole: 'STUDENT',
      },
    });
    organizerId = org.id;
    userIdsToClean.push(organizerId);

    const club = await adminPrisma.club.create({
      data: { name: `Sec Club ${timestamp}` },
    });
    clubId = club.id;

    await adminPrisma.clubMembership.create({
      data: { userId: organizerId, clubId, role: 'CLUB_ADMIN' },
    });

    // 2. Create Events (Individual and Team)
    const indEvent = await adminPrisma.event.create({
      data: {
        title: 'Security Solo Event',
        slug: `sec-solo-${timestamp}`,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        registrationStartTime: new Date(Date.now() - 3600000),
        registrationEndTime: new Date(Date.now() + 86400000),
        eventType: 'WORKSHOP',
        visibility: 'PUBLIC',
        state: 'PUBLISHED',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        createdBy: organizerId,
        eventClubs: { create: [{ clubId, isPrimary: true }] },
      },
    });
    eventId = indEvent.id;
    eventIdsToClean.push(eventId);

    const tEvent = await adminPrisma.event.create({
      data: {
        title: 'Security Team Event',
        slug: `sec-team-${timestamp}`,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        registrationStartTime: new Date(Date.now() - 3600000),
        registrationEndTime: new Date(Date.now() + 86400000),
        eventType: 'HACKATHON',
        visibility: 'PUBLIC',
        state: 'PUBLISHED',
        registrationType: 'TEAM',
        attendanceType: 'SINGLE',
        maxCapacity: 50,
        metadata: { minimum_team_size: 2, maximum_team_size: 5 },
        createdBy: organizerId,
        eventClubs: { create: [{ clubId, isPrimary: true }] },
      },
    });
    teamEventId = tEvent.id;
    eventIdsToClean.push(teamEventId);

    // 3. Create Seeded Test Users
    // 3a. Approved adypu.edu.in
    const adypuUser = await adminPrisma.user.create({
      data: {
        email: `valid_student_${timestamp}@adypu.edu.in`,
        googleSub: `sub_adypu_${timestamp}`,
        fullName: 'Valid ADYPU Student',
        globalRole: 'STUDENT',
      },
    });
    adypuUserId = adypuUser.id;
    userIdsToClean.push(adypuUserId);

    // 3b. Approved newtonschool.co
    const newtonUser = await adminPrisma.user.create({
      data: {
        email: `valid_faculty_${timestamp}@newtonschool.co`,
        googleSub: `sub_newton_${timestamp}`,
        fullName: 'Valid Newton Faculty',
        globalRole: 'FACULTY_MENTOR',
      },
    });
    newtonUserId = newtonUser.id;
    userIdsToClean.push(newtonUserId);

    // 3c. Upper Case ADYPU
    const upperUser = await adminPrisma.user.create({
      data: {
        email: `UPPER_STUDENT_${timestamp}@ADYPU.EDU.IN`,
        googleSub: `sub_upper_${timestamp}`,
        fullName: 'Upper ADYPU Student',
        globalRole: 'STUDENT',
      },
    });
    upperAdypuUserId = upperUser.id;
    userIdsToClean.push(upperAdypuUserId);

    // 3d. Mixed Case Newton
    const mixedUser = await adminPrisma.user.create({
      data: {
        email: `Mixed_Faculty_${timestamp}@NewtonSchool.CO`,
        googleSub: `sub_mixed_${timestamp}`,
        fullName: 'Mixed Newton Faculty',
        globalRole: 'FACULTY_MENTOR',
      },
    });
    mixedNewtonUserId = mixedUser.id;
    userIdsToClean.push(mixedNewtonUserId);

    // 3e. Unverified User (googleSub: 'unverified')
    const unverifiedUser = await adminPrisma.user.create({
      data: {
        email: `unverified_${timestamp}@adypu.edu.in`,
        googleSub: `unverified_sub_${timestamp}`,
        fullName: 'Unverified Student',
        globalRole: 'STUDENT',
      },
    });
    unverifiedUserId = unverifiedUser.id;
    userIdsToClean.push(unverifiedUserId);

    // 3f. Lookalike ADYPU domain attacker
    const lookalikeAdypu = await adminPrisma.user.create({
      data: {
        email: `attacker_${timestamp}@adypu.edu.in.attacker.com`,
        googleSub: `sub_att_adypu_${timestamp}`,
        fullName: 'Lookalike ADYPU Attacker',
        globalRole: 'STUDENT',
      },
    });
    lookalikeAdypuUserId = lookalikeAdypu.id;
    userIdsToClean.push(lookalikeAdypuUserId);

    // 3g. Lookalike Newton domain attacker
    const lookalikeNewton = await adminPrisma.user.create({
      data: {
        email: `attacker_${timestamp}@newtonschool.co.attacker.com`,
        googleSub: `sub_att_newton_${timestamp}`,
        fullName: 'Lookalike Newton Attacker',
        globalRole: 'STUDENT',
      },
    });
    lookalikeNewtonUserId = lookalikeNewton.id;
    userIdsToClean.push(lookalikeNewtonUserId);

    // 3h. @test.com user
    const testCom = await adminPrisma.user.create({
      data: {
        email: `user_${timestamp}@test.com`,
        googleSub: `sub_test_${timestamp}`,
        fullName: 'Test Com User',
        globalRole: 'STUDENT',
      },
    });
    testComUserId = testCom.id;
    userIdsToClean.push(testComUserId);

    // 3i. @nst.com user
    const nstCom = await adminPrisma.user.create({
      data: {
        email: `user_${timestamp}@nst.com`,
        googleSub: `sub_nst_${timestamp}`,
        fullName: 'NST Com User',
        globalRole: 'STUDENT',
      },
    });
    nstComUserId = nstCom.id;
    userIdsToClean.push(nstComUserId);

    // 3j. Platform Admin with non-institutional email
    const adminNonInst = await adminPrisma.user.create({
      data: {
        email: `platform_admin_${timestamp}@gmail.com`,
        googleSub: `sub_admin_gmail_${timestamp}`,
        fullName: 'Platform Admin Non-Inst',
        globalRole: 'PLATFORM_ADMIN',
      },
    });
    adminNonInstUserId = adminNonInst.id;
    userIdsToClean.push(adminNonInstUserId);

    // 4. Create a baseline team for join testing using the valid ADYPU student
    const baseTeam = await createTeam(adypuUserId, teamEventId, `Base Team ${timestamp}`);
    existingTeamId = baseTeam.team_id;
  });

  after(async () => {
    sinon.restore();
    if (eventIdsToClean.length > 0) {
      await adminPrisma.eventRegistrationResponse.deleteMany({
        where: { eventRegistration: { eventId: { in: eventIdsToClean } } },
      });
      await adminPrisma.eventRegistration.deleteMany({
        where: { eventId: { in: eventIdsToClean } },
      });
      await adminPrisma.team.deleteMany({
        where: { eventId: { in: eventIdsToClean } },
      });
      await adminPrisma.eventClub.deleteMany({
        where: { eventId: { in: eventIdsToClean } },
      });
      await adminPrisma.event.deleteMany({
        where: { id: { in: eventIdsToClean } },
      });
    }
    if (clubId) {
      await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
      await adminPrisma.club.deleteMany({ where: { id: clubId } });
    }
    if (userIdsToClean.length > 0) {
      await adminPrisma.notification.deleteMany({
        where: { userId: { in: userIdsToClean } },
      });
      await adminPrisma.notificationJob.deleteMany({
        where: { payload: { path: ['user_id'], string_contains: '' } },
      }).catch(() => {});
      await adminPrisma.user.deleteMany({
        where: { id: { in: userIdsToClean } },
      });
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Both approved domains succeed across solo, create, and join
  // --------------------------------------------------------------------------
  it('1. Both approved domains (@adypu.edu.in and @newtonschool.co) succeed for solo registration, team creation, and joining', async () => {
    // 1a. ADYPU student solo registration
    const regAdypu = await registerEvent(adypuUserId, eventId);
    assert.ok(regAdypu, 'ADYPU student must successfully register solo');

    // 1b. Newton faculty solo registration
    const regNewton = await registerEvent(newtonUserId, eventId);
    assert.ok(regNewton, 'Newton faculty must successfully register solo');

    // 1c. Newton faculty creates a team
    const teamNewton = await createTeam(newtonUserId, teamEventId, `Newton Squad ${timestamp}`);
    assert.ok(teamNewton.team_id, 'Newton user must successfully create a team');

    // 1d. Create an independent team and have an approved Newton joiner join
    const secondAdypu = await adminPrisma.user.create({
      data: {
        email: `join_host_${timestamp}@adypu.edu.in`,
        googleSub: `sub_join_host_${timestamp}`,
        fullName: 'Join Host',
        globalRole: 'STUDENT',
      },
    });
    userIdsToClean.push(secondAdypu.id);

    const joinTargetTeam = await createTeam(secondAdypu.id, teamEventId, `Join Target ${timestamp}`);

    const newtonJoiner = await adminPrisma.user.create({
      data: {
        email: `newton_joiner_${timestamp}@newtonschool.co`,
        googleSub: `sub_newton_joiner_${timestamp}`,
        fullName: 'Newton Joiner',
        globalRole: 'FACULTY_MENTOR',
      },
    });
    userIdsToClean.push(newtonJoiner.id);

    const joinRes = await joinTeam(newtonJoiner.id, joinTargetTeam.team_id);
    assert.ok(joinRes !== undefined, 'Approved domain user must successfully join team');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Case normalization succeeds
  // --------------------------------------------------------------------------
  it('2. Case normalization succeeds for upper-case and mixed-case emails', async () => {
    // 2a. Upper-case ADYPU student solo register
    const regUpper = await registerEvent(upperAdypuUserId, eventId);
    assert.ok(regUpper, 'Upper-case ADYPU email must be case-normalized and succeed');

    // 2b. Mixed-case Newton user creates team
    const teamMixed = await createTeam(mixedNewtonUserId, teamEventId, `Mixed Case Team ${timestamp}`);
    assert.ok(teamMixed.team_id, 'Mixed-case Newton email must be case-normalized and succeed');

    // 2c. Helper function direct check
    assert.strictEqual(isInstitutionalEmail('STUDENT@ADYPU.EDU.IN'), true);
    assert.strictEqual(isInstitutionalEmail('FACULTY@NEWTONSCHOOL.CO'), true);
    assert.strictEqual(isInstitutionalEmail('Mixed.Case@Adypu.Edu.In'), true);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Unverified institutional emails are rejected
  // --------------------------------------------------------------------------
  it('3. Unverified institutional emails are rejected at both OAuth and registration layers', async () => {
    // 3a. OAuth layer: verifyIdToken rejects idToken when payload.email_verified is false
    sinon.restore();
    sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves({
      getPayload: () => ({
        sub: 'sub-unverified-123',
        email: 'unverified_student@adypu.edu.in',
        name: 'Unverified Student',
        email_verified: false, // <-- Explicitly unverified by Google
      }),
    } as any);

    await assert.rejects(
      async () => {
        await verifyIdToken('mock-id-token-unverified');
      },
      (err: any) => {
        return err instanceof ForbiddenError && /EMAIL_NOT_VERIFIED/i.test(err.message);
      },
      'OAuth layer must reject id_tokens with email_verified: false'
    );
    sinon.restore();

    // 3b. Registration layer: User with unverified identity cannot register
    await assert.rejects(
      async () => {
        await registerEvent(unverifiedUserId, eventId);
      },
      (err: any) => {
        return err instanceof ForbiddenError && /verified institutional email/i.test(err.message);
      },
      'Solo registration must reject unverified accounts'
    );

    // 3c. Team creation layer rejects unverified identity
    await assert.rejects(
      async () => {
        await createTeam(unverifiedUserId, teamEventId, `Unverified Team ${timestamp}`);
      },
      (err: any) => {
        return err instanceof ForbiddenError && /verified institutional email/i.test(err.message);
      },
      'Team creation must reject unverified accounts'
    );

    // 3d. Team join layer rejects unverified identity
    await assert.rejects(
      async () => {
        await joinTeam(unverifiedUserId, existingTeamId);
      },
      (err: any) => {
        return err instanceof ForbiddenError && /verified institutional email/i.test(err.message);
      },
      'Team joining must reject unverified accounts'
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 4: @test.com and @nst.com in production mode are rejected
  // --------------------------------------------------------------------------
  it('4. @test.com and @nst.com are strictly rejected in production mode', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origAllowTest = process.env.ALLOW_TEST_EMAIL_DOMAINS;

    try {
      // Force production mode
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_TEST_EMAIL_DOMAINS = 'true'; // Should be ignored in production!

      // Direct helper checks in production mode
      assert.strictEqual(isInstitutionalEmail('user@test.com'), false, '@test.com must be false in production');
      assert.strictEqual(isInstitutionalEmail('user@nst.com'), false, '@nst.com must be false in production');
      assert.strictEqual(isInstitutionalEmail('admin@nst.com'), false, 'admin@nst.com must be false in production');

      // validateRegistrationEligibility checks
      assert.throws(
        () => {
          validateRegistrationEligibility({
            email: 'user@test.com',
            googleSub: 'valid_sub_123',
          });
        },
        (err: any) => err instanceof ForbiddenError
      );

      assert.throws(
        () => {
          validateRegistrationEligibility({
            email: 'admin@nst.com',
            googleSub: 'valid_sub_123',
          });
        },
        (err: any) => err instanceof ForbiddenError
      );
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.ALLOW_TEST_EMAIL_DOMAINS = origAllowTest;
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Lookalike domains are strictly rejected
  // --------------------------------------------------------------------------
  it('5. Lookalike domains (@adypu.edu.in.attacker.com, @newtonschool.co.attacker.com) are strictly rejected', async () => {
    // 5a. Helper checks
    assert.strictEqual(isInstitutionalEmail('attacker@adypu.edu.in.attacker.com'), false);
    assert.strictEqual(isInstitutionalEmail('attacker@newtonschool.co.attacker.com'), false);
    assert.strictEqual(isInstitutionalEmail('attacker@fakeadypu.edu.in'), false);
    assert.strictEqual(isInstitutionalEmail('attacker@sub.adypu.edu.in'), false);

    // 5b. Solo registration rejects lookalike ADYPU
    await assert.rejects(
      async () => {
        await registerEvent(lookalikeAdypuUserId, eventId);
      },
      (err: any) => err instanceof ForbiddenError && /institutional email account/i.test(err.message)
    );

    // 5c. Solo registration rejects lookalike Newton
    await assert.rejects(
      async () => {
        await registerEvent(lookalikeNewtonUserId, eventId);
      },
      (err: any) => err instanceof ForbiddenError && /institutional email account/i.test(err.message)
    );

    // 5d. Team creation rejects lookalike ADYPU
    await assert.rejects(
      async () => {
        await createTeam(lookalikeAdypuUserId, teamEventId, `Attacker Team ${timestamp}`);
      },
      (err: any) => err instanceof ForbiddenError && /institutional email account/i.test(err.message)
    );

    // 5e. Team joining rejects lookalike Newton
    await assert.rejects(
      async () => {
        await joinTeam(lookalikeNewtonUserId, existingTeamId);
      },
      (err: any) => err instanceof ForbiddenError && /institutional email account/i.test(err.message)
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Solo registration, team creation, and team joining all enforce validation
  // --------------------------------------------------------------------------
  it('6. Solo registration, team creation, and team joining all enforce identical domain boundaries', async () => {
    const origAllowTest = process.env.ALLOW_TEST_EMAIL_DOMAINS;
    try {
      process.env.ALLOW_TEST_EMAIL_DOMAINS = 'false';
      // Non-institutional user attempts all 3 operations
      await assert.rejects(
        async () => {
          await registerEvent(testComUserId, eventId);
        },
        (err: any) => err instanceof ForbiddenError
      );

      await assert.rejects(
        async () => {
          await createTeam(testComUserId, teamEventId, `Illegal Team ${timestamp}`);
        },
        (err: any) => err instanceof ForbiddenError
      );

      await assert.rejects(
        async () => {
          await joinTeam(testComUserId, existingTeamId);
        },
        (err: any) => err instanceof ForbiddenError
      );
    } finally {
      process.env.ALLOW_TEST_EMAIL_DOMAINS = origAllowTest;
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Admin accounts with non-institutional emails cannot register
  // --------------------------------------------------------------------------
  it('7. Admin accounts with non-institutional emails cannot register or participate in teams', async () => {
    // adminNonInstUserId has globalRole: 'PLATFORM_ADMIN' but email 'platform_admin@gmail.com'
    // 7a. Solo registration rejected
    await assert.rejects(
      async () => {
        await registerEvent(adminNonInstUserId, eventId);
      },
      (err: any) => err instanceof ForbiddenError && /institutional email account/i.test(err.message),
      'Platform admin with non-institutional email must be blocked from solo registration'
    );

    // 7b. Team creation rejected
    await assert.rejects(
      async () => {
        await createTeam(adminNonInstUserId, teamEventId, `Admin Non-Inst Squad ${timestamp}`);
      },
      (err: any) => err instanceof ForbiddenError && /institutional email account/i.test(err.message),
      'Platform admin with non-institutional email must be blocked from team creation'
    );

    // 7c. Team join rejected
    await assert.rejects(
      async () => {
        await joinTeam(adminNonInstUserId, existingTeamId);
      },
      (err: any) => err instanceof ForbiddenError && /institutional email account/i.test(err.message),
      'Platform admin with non-institutional email must be blocked from joining a team'
    );
  });
});
