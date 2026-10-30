import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { generateQrPayload } from '../../src/modules/attendance/totp.utils';
import crypto from 'crypto';
import { randomUUID } from 'crypto';

const app = createApp();

function generateCustomQrPayload(sessionId: string, qrSecret: string, offsetWindows: number): string {
  const windowEpoch = Math.floor(Date.now() / 30000) + offsetWindows;
  const hmacInput = `v1:${sessionId}:${windowEpoch}`;
  const hmac = crypto.createHmac('sha256', qrSecret);
  hmac.update(hmacInput);
  const base64 = hmac.digest('base64');
  const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signature = base64Url.substring(0, 16);
  return `v1:${sessionId}:${signature}`;
}

describe('Phase 26D: Attendance Collision Detection and Review Resolution', () => {
  let student1 = randomUUID();
  let student2 = randomUUID();
  let admin = randomUUID();
  let nonAdmin = randomUUID();
  let clubId = randomUUID();
  let eventId = randomUUID();
  let sessionId = randomUUID();

  let student1Token: string;
  let student2Token: string;
  let adminToken: string;
  let nonAdminToken: string;

  before(async () => {
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);

    // 1. Users
    await adminPrisma.user.deleteMany({ where: { googleSub: { in: ['s1', 's2', 'a1', 'na1'] } } });
    await adminPrisma.user.createMany({
      data: [
        { id: student1, email: 's1@adypu.edu.in', googleSub: 's1', fullName: 'Student One', globalRole: 'STUDENT' },
        { id: student2, email: 's2@adypu.edu.in', googleSub: 's2', fullName: 'Student Two', globalRole: 'STUDENT' },
        { id: admin, email: 'admin@adypu.edu.in', googleSub: 'a1', fullName: 'Club Admin', globalRole: 'STUDENT' },
        { id: nonAdmin, email: 'nonadmin@adypu.edu.in', googleSub: 'na1', fullName: 'Non Admin', globalRole: 'STUDENT' }
      ]
    });

    // 2. Club & Event
    const runSuffix = randomUUID().slice(0, 8);
    await adminPrisma.club.create({
      data: { id: clubId, name: `C1_${runSuffix}` }
    });
    
    await adminPrisma.event.create({
      data: {
        id: eventId,
        title: `E1_${runSuffix}`,
        state: 'PUBLISHED',
        isLocked: false,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: admin,
        eventType: 'WORKSHOP',
        eventClubs: {
          create: { clubId: clubId }
        }
      }
    });

    // 3. Memberships
    await adminPrisma.clubMembership.create({
      data: { userId: admin, clubId: clubId, role: 'CLUB_ADMIN' }
    });

    // 4. Session & Registration
    await adminPrisma.attendanceSession.create({
      data: {
        id: sessionId,
        eventId: eventId,
        title: 'S1',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        openAt: new Date(Date.now() - 3600000),
        closeAt: new Date(Date.now() + 3600000),
        qrSecret: 'SECRET',
        createdBy: admin
      }
    });

    await adminPrisma.eventRegistration.createMany({
      data: [
        { eventId: eventId, userId: student1 },
        { eventId: eventId, userId: student2 }
      ]
    });

    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);

    // 5. Tokens
    student1Token = signJwt(student1);
    student2Token = signJwt(student2);
    adminToken = signJwt(admin);
    nonAdminToken = signJwt(nonAdmin);
  });

  after(async () => {
    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId } });
    await adminPrisma.attendanceSession.deleteMany({ where: { id: sessionId } });
    await adminPrisma.eventRegistration.deleteMany({ where: { eventId } });
    await adminPrisma.eventClub.deleteMany({ where: { eventId } });
    await adminPrisma.event.deleteMany({ where: { id: eventId } });
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);
    await adminPrisma.user.deleteMany({ where: { id: { in: [student1, student2, admin, nonAdmin] } } });
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
  });

  let student2AttendanceId: string;

  it('Normal scan records attendance as PRESENT without collision flag', async () => {
    // Current window
    const token = generateCustomQrPayload(sessionId, 'SECRET', 0);

    const res = await request(app)
      .post('/v1/attendance/mark')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        session_id: sessionId,
        totp_token: token,
        latitude: 10,
        longitude: 10,
        device_id: 'device-1',
        device_os: 'iOS',
        gps_accuracy: 5,
        mock_location_detected: false,
        app_version: '1.0'
      });
    
    if (res.status !== 201) console.error('TEST 1 FAILED', res.body);
    assert.strictEqual(res.status, 201);
    const attendance = res.body;
    assert.strictEqual(attendance.status, 'PRESENT');

    const record = await adminPrisma.attendanceRecord.findUnique({ where: { id: attendance.attendance_id } });
    assert.strictEqual(record?.status, 'PRESENT');
    assert.strictEqual((record?.auditMetadata as any)?.device_collision_detected, undefined);
  });

  it('Collision scan records attendance as PRESENT with collision flag', async () => {
    // Previous window (valid, but different signature! offset by 1 to avoid time-rollover flakiness)
    const token = generateCustomQrPayload(sessionId, 'SECRET', 1);

    const res = await request(app)
      .post('/v1/attendance/mark')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        session_id: sessionId,
        totp_token: token,
        latitude: 10,
        longitude: 10,
        device_id: 'device-1', // Collision! Same device, different user
        device_os: 'iOS',
        gps_accuracy: 5,
        mock_location_detected: false,
        app_version: '1.0'
      });
    
    if (res.status !== 201) console.error('TEST 2 FAILED', res.body);
    assert.strictEqual(res.status, 201);
    const attendance = res.body;
    assert.strictEqual(attendance.status, 'PRESENT');
    
    student2AttendanceId = attendance.attendance_id;

    const record = await adminPrisma.attendanceRecord.findUnique({ where: { id: student2AttendanceId } });
    assert.strictEqual((record?.auditMetadata as any)?.device_collision_detected, true);
  });

  it('Reviewing collision clears collision flag and logs audit entry', async () => {
    const failRes = await request(app)
      .patch(`/v1/attendance/${student2AttendanceId}/review`)
      .set('Authorization', `Bearer ${nonAdminToken}`)
      .send();
    
    assert.strictEqual(failRes.status, 403);

    const res = await request(app)
      .patch(`/v1/attendance/${student2AttendanceId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    
    assert.strictEqual(res.status, 200);
    const record = await adminPrisma.attendanceRecord.findUnique({ where: { id: student2AttendanceId } });
    assert.strictEqual((record?.auditMetadata as any)?.device_collision_detected, undefined); // Flag cleared

    const auditLog = await adminPrisma.auditLog.findFirst({
      where: {
        entityId: student2AttendanceId,
        action: 'ATTENDANCE_REVIEWED'
      }
    });
    assert.ok(auditLog, 'Audit log must record ATTENDANCE_REVIEWED');
  });

  it('Reviewing collision twice fails with 400', async () => {
    const res = await request(app)
      .patch(`/v1/attendance/${student2AttendanceId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    
    assert.strictEqual(res.status, 400);
  });
});
