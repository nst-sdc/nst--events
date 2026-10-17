import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PrismaClient, Prisma } from '@nst/database';
import { adminPrisma } from '../helpers/adminDb';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { env } from '../../src/config/env';
import sinon from 'sinon';
import { googleOAuth } from '../../src/modules/auth/google.oauth';
import { authService } from '../../src/modules/auth/auth.service';

const prisma = new PrismaClient(); // Connects as nst_app via DATABASE_URL
const app = createApp();

const TEST_EMAILS = [
  'admin_auth07@newtonschool.co',
  'st1@adypu.edu.in',
  'st2@adypu.edu.in',
  'e25concurrent1@adypu.edu.in',
  'f25concurrent2@adypu.edu.in',
  'g27contention@adypu.edu.in',
  'e25subconflict@adypu.edu.in',
  'e25recovery@adypu.edu.in',
];

const AUTH07_PROGRAM_CODES = ['TEST', 'e', 'f', 'g'];

const AUTH07_AUTHORIZED_STUDENTS = [
  'st1@adypu.edu.in',
  'st2@adypu.edu.in',
  'e25concurrent1@adypu.edu.in',
  'f25concurrent2@adypu.edu.in',
  'g27contention@adypu.edu.in',
  'e25subconflict@adypu.edu.in',
  'e25recovery@adypu.edu.in',
];

async function cleanupAuth07Fixtures() {
  // 1. Reset app.user_id on application prisma connection to avoid session-level leak
  await prisma.$executeRaw`SELECT set_config('app.user_id', '', false)`.catch(() => {});

  // 2. Scoped cleanup of academic programs/batches created by AUTH-07
  const programs = await adminPrisma.academicProgram.findMany({
    where: { code: { in: AUTH07_PROGRAM_CODES } },
    select: { id: true },
  });
  const programIds = programs.map((p) => p.id);

  if (programIds.length > 0) {
    const batches = await adminPrisma.academicBatch.findMany({
      where: { programId: { in: programIds } },
      select: { id: true },
    });
    const batchIds = batches.map((b) => b.id);

    if (batchIds.length > 0) {
      await adminPrisma.userAcademicProfile.deleteMany({
        where: { batchId: { in: batchIds } },
      });
      await adminPrisma.eventAudienceBatch.deleteMany({
        where: { batchId: { in: batchIds } },
      });
      await adminPrisma.academicBatch.deleteMany({
        where: { id: { in: batchIds } },
      });
    }
    await adminPrisma.academicProgram.deleteMany({
      where: { id: { in: programIds } },
    });
  }

  // 3. Scoped cleanup of users and their dependent records created by AUTH-07
  const users = await adminPrisma.user.findMany({
    where: { email: { in: TEST_EMAILS } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  if (userIds.length > 0) {
    // Delete academic profiles where user is assigned or assigner
    await adminPrisma.userAcademicProfile.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { assignedBy: { in: userIds } },
        ],
      },
    });

    // Delete dependent tables with RESTRICT foreign keys
    await adminPrisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await adminPrisma.notificationPreference.deleteMany({
      where: { userId: { in: userIds } },
    });
    await adminPrisma.auditLog.deleteMany({
      where: { actorId: { in: userIds } },
    });

    // Delete token tables
    await adminPrisma.pushToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await adminPrisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });

    // Finally delete the users
    await adminPrisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  }

  // 4. Scoped cleanup of authorized students created by AUTH-07
  await adminPrisma.authorizedStudent.deleteMany({
    where: { normalizedEmail: { in: AUTH07_AUTHORIZED_STUDENTS } },
  });
}

test('Phase AUTH-07 - Academic Profile RLS & Concurrency', async (t) => {
  let platformAdminToken: string;
  let student1Token: string;
  let student1Id: string;
  let student2Id: string;
  let batchId: string;

  t.before(async () => {
    // Isolated teardown first
    await cleanupAuth07Fixtures();

    const pa = await adminPrisma.user.create({
      data: {
        email: 'admin_auth07@newtonschool.co',
        fullName: 'PA',
        globalRole: 'PLATFORM_ADMIN',
        googleSub: 'google-sub-auth07-pa',
      },
    });
    platformAdminToken = signJwt(pa.id);

    const st1 = await adminPrisma.user.create({
      data: {
        email: 'st1@adypu.edu.in',
        fullName: 'St1',
        globalRole: 'STUDENT',
        googleSub: 'st1',
      },
    });
    student1Id = st1.id;
    student1Token = signJwt(st1.id);

    const st2 = await adminPrisma.user.create({
      data: {
        email: 'st2@adypu.edu.in',
        fullName: 'St2',
        globalRole: 'STUDENT',
        googleSub: 'st2',
      },
    });
    student2Id = st2.id;

    const prog = await adminPrisma.academicProgram.create({
      data: { name: 'Test Prog', code: 'TEST' },
    });
    const batch = await adminPrisma.academicBatch.create({
      data: { programId: prog.id, admissionYear: 2021, graduationYear: 2025 },
    });
    batchId = batch.id;
  });

  t.afterEach(async () => {
    sinon.restore();
    await prisma.$executeRaw`SELECT set_config('app.user_id', '', false)`.catch(() => {});
  });

  t.after(async () => {
    await cleanupAuth07Fixtures();
    await prisma.$disconnect();
  });

  await t.test('1. nst_app cannot create profile for arbitrary user', async () => {
    // Simulate nst_app direct DB access under st1 context
    await prisma.$executeRaw`SELECT set_config('app.user_id', ${student1Id}::text, false)`;
    
    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO user_academic_profiles (id, user_id, batch_id, assignment_source)
        VALUES (gen_random_uuid(), ${student2Id}::uuid, ${batchId}::uuid, 'INSTITUTIONAL_EMAIL_INFERENCE')
      `,
      (err: any) => err.code === 'P2010' && err.message.includes('42501'),
      'RLS should deny cross-user insert'
    );
  });

  await t.test('2. nst_app cannot update arbitrary users profile', async () => {
    // Create profile for st2 using adminPrisma
    await adminPrisma.userAcademicProfile.create({
      data: { userId: student2Id, batchId, assignmentSource: 'ADMIN_OVERRIDE' }
    });

    await prisma.$executeRaw`SELECT set_config('app.user_id', ${student1Id}::text, false)`;

    // Try to update st2 profile as st1
    const affectedRows = await prisma.$executeRaw`
        UPDATE user_academic_profiles SET assignment_source = 'INSTITUTIONAL_EMAIL_INFERENCE' WHERE user_id = ${student2Id}::uuid
      `;
    assert.strictEqual(affectedRows, 0, 'RLS should silently filter out cross-user update (0 rows affected)');
    
    // Clean up profile for next tests
    await adminPrisma.userAcademicProfile.deleteMany({ where: { userId: student2Id } });
  });

  await t.test('7-9, 12. Concurrent Google login creates correct single state', async () => {
    const email = 'e25concurrent1@adypu.edu.in';
    const sub = 'sub-concurrent1';
    await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: email } });
    
    // Stub google auth
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'fake-id-token', access_token: 'fake', refresh_token: 'fake', expires_in: 3600, scope: 'openid', token_type: 'Bearer' });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({ sub, email, name: 'Concurrent 1' } as any);

    const prog = await adminPrisma.academicProgram.create({ data: { name: 'Prog B', code: 'e' } });
    await adminPrisma.academicBatch.create({ data: { programId: prog.id, admissionYear: 2025, graduationYear: 2029 } });

    // Make concurrent requests
    const promises = [
      authService.loginWithGoogle('fake-code-1'),
      authService.loginWithGoogle('fake-code-2'),
      authService.loginWithGoogle('fake-code-3')
    ];

    const results = await Promise.all(promises);

    for (const res of results) {
      assert.ok(res.access_token);
    }

    // Verify DB state
    const users = await adminPrisma.user.findMany({ where: { email } });
    assert.strictEqual(users.length, 1, 'Only one user should be created');

    const profiles = await adminPrisma.userAcademicProfile.findMany({ where: { userId: users[0].id } });
    assert.strictEqual(profiles.length, 1, 'Only one academic profile should be created');
  });

  await t.test('13. ADMIN_OVERRIDE remains authoritative', async () => {
    const email = 'f25concurrent2@adypu.edu.in';
    const sub = 'sub-concurrent2';
    await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: email } });

    const prog = await adminPrisma.academicProgram.create({ data: { name: 'Prog C', code: 'f' } });
    const batchInferred = await adminPrisma.academicBatch.create({ data: { programId: prog.id, admissionYear: 2025, graduationYear: 2029 } });
    const batchAdmin = await adminPrisma.academicBatch.create({ data: { programId: prog.id, admissionYear: 2024, graduationYear: 2028 } });

    // Pre-create user and admin override profile
    const user = await adminPrisma.user.create({
      data: { email, fullName: 'Concurrent 2', googleSub: sub, globalRole: 'STUDENT' }
    });
    await adminPrisma.userAcademicProfile.create({
      data: { userId: user.id, batchId: batchAdmin.id, assignmentSource: 'ADMIN_OVERRIDE' }
    });

    sinon.restore();
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'fake-id-token', access_token: 'fake', refresh_token: 'fake', expires_in: 3600, scope: 'openid', token_type: 'Bearer' });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({ sub, email, name: 'Concurrent 2' } as any);

    const promises = [
      authService.loginWithGoogle('fake-code-4'),
      authService.loginWithGoogle('fake-code-5')
    ];

    await Promise.all(promises);

    const profiles = await adminPrisma.userAcademicProfile.findMany({ where: { userId: user.id } });
    assert.strictEqual(profiles.length, 1);
    assert.strictEqual(profiles[0].batchId, batchAdmin.id, 'Admin override should be preserved');
    assert.strictEqual(profiles[0].assignmentSource, 'ADMIN_OVERRIDE');
  });

  await t.test('14. High-contention simultaneous Google login reliably resolves single user', async () => {
    const email = 'g27contention@adypu.edu.in';
    const sub = 'sub-contention';
    await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: email } });

    const prog = await adminPrisma.academicProgram.create({ data: { name: 'Prog Contention', code: 'g' } });
    await adminPrisma.academicBatch.create({ data: { programId: prog.id, admissionYear: 2027, graduationYear: 2031 } });

    sinon.restore();
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({
      id_token: 'fake-id-token',
      access_token: 'fake',
      refresh_token: 'fake',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
    });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({ sub, email, name: 'Contention User' } as any);

    // 10 concurrent requests at once
    const promises = Array.from({ length: 10 }, (_, i) =>
      authService.loginWithGoogle(`fake-contention-code-${i}`)
    );

    const results = await Promise.all(promises);

    for (const res of results) {
      assert.ok(res.access_token);
      assert.strictEqual(res.user.email, email);
    }

    const users = await adminPrisma.user.findMany({ where: { email } });
    assert.strictEqual(users.length, 1, 'Only one user record created under 10-way contention');

    const profiles = await adminPrisma.userAcademicProfile.findMany({ where: { userId: users[0].id } });
    assert.strictEqual(profiles.length, 1, 'Only one academic profile created');
  });

  await t.test('15. Different Google subject CANNOT silently replace subject of an established account', async () => {
    const email = 'e25subconflict@adypu.edu.in';
    const establishedSub = 'sub-established-original';
    const attackerSub = 'sub-different-attacker';
    await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: email } });

    // Pre-create the user with an established Google subject
    await adminPrisma.user.create({
      data: {
        email,
        fullName: 'Original User',
        googleSub: establishedSub,
        globalRole: 'STUDENT',
      },
    });

    sinon.restore();
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({
      id_token: 'fake-id-token',
      access_token: 'fake',
      refresh_token: 'fake',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
    });
    // Attempt login with a different sub for the same email
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: attackerSub,
      email,
      name: 'Intruder',
    } as any);

    // Must be rejected with ForbiddenError
    await assert.rejects(
      authService.loginWithGoogle('code-different-sub'),
      (err: any) => {
        return err.status === 403 || err.message?.includes('already linked') || err.message?.includes('ACCOUNT_LINK_CONFLICT');
      },
      'Should reject login attempt when a different Google subject presents an already-linked email'
    );

    // Verify database state: googleSub was NOT silently replaced!
    const userInDb = await adminPrisma.user.findUnique({ where: { email } });
    assert.strictEqual(userInDb?.googleSub, establishedSub, 'Established googleSub must remain unchanged');
    assert.strictEqual(userInDb?.fullName, 'Original User', 'User fullName must remain unchanged');
  });

  await t.test('16. Legitimate account linking succeeds for provisioned placeholder and freezes subject thereafter', async () => {
    const email = 'e25recovery@adypu.edu.in';
    const legitimateSub = 'sub-legitimate-first-login';
    const subsequentIntruderSub = 'sub-subsequent-intruder';
    await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: email } });

    // Pre-create user with admin provisioned placeholder
    const preProvisioned = await adminPrisma.user.create({
      data: {
        email,
        fullName: 'Not yet registered',
        googleSub: `provisioned:${email}`,
        globalRole: 'STUDENT',
      },
    });

    sinon.restore();
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({
      id_token: 'fake-id-token',
      access_token: 'fake',
      refresh_token: 'fake',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
    });

    // 1. Legitimate first login: placeholder transitions to real Google subject
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: legitimateSub,
      email,
      name: 'Real Student',
    } as any);

    const firstLogin = await authService.loginWithGoogle('code-legitimate-first');
    assert.ok(firstLogin.access_token);
    assert.strictEqual(firstLogin.user.id, preProvisioned.id);

    // Verify DB was updated to legitimate subject
    const userAfterFirstLogin = await adminPrisma.user.findUnique({ where: { email } });
    assert.strictEqual(userAfterFirstLogin?.googleSub, legitimateSub, 'googleSub correctly linked from provisioned placeholder');
    assert.strictEqual(userAfterFirstLogin?.fullName, 'Real Student');

    // 2. Subsequent attempt with a DIFFERENT Google subject must now be rejected
    sinon.restore();
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({
      id_token: 'fake-id-token',
      access_token: 'fake',
      refresh_token: 'fake',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
    });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: subsequentIntruderSub,
      email,
      name: 'Intruder After Linking',
    } as any);

    await assert.rejects(
      authService.loginWithGoogle('code-intruder-after-linking'),
      (err: any) => {
        return err.status === 403 || err.message?.includes('already linked') || err.message?.includes('ACCOUNT_LINK_CONFLICT');
      },
      'Should reject subsequent login with different sub once account is established'
    );

    // Verify DB still holds the legitimate subject
    const finalUser = await adminPrisma.user.findUnique({ where: { email } });
    assert.strictEqual(finalUser?.googleSub, legitimateSub, 'googleSub must not be replaced by subsequent intruder');
  });

  await t.test('17. Concurrent logins with SAME Google subject recover from DB conflict without duplicate users', async () => {
    const email = 'e25concurrent1@adypu.edu.in';
    const sub = 'sub-concurrent-same-identity';

    // Clean up if existed
    await adminPrisma.user.deleteMany({ where: { email } });

    sinon.restore();
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({
      id_token: 'fake-id-token',
      access_token: 'fake',
      refresh_token: 'fake',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
    });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub,
      email,
      name: 'Concurrent Same User',
    } as any);

    // 5 concurrent requests with identical subject & email
    const results = await Promise.all([
      authService.loginWithGoogle('same-code-1'),
      authService.loginWithGoogle('same-code-2'),
      authService.loginWithGoogle('same-code-3'),
      authService.loginWithGoogle('same-code-4'),
      authService.loginWithGoogle('same-code-5'),
    ]);

    for (const res of results) {
      assert.ok(res.access_token);
      assert.strictEqual(res.user.email, email);
    }

    const users = await adminPrisma.user.findMany({ where: { email } });
    assert.strictEqual(users.length, 1, 'Exactly one user record exists');
    assert.strictEqual(users[0].googleSub, sub);
  });
});
