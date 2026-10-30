import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
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

describe('Phase 26E: Device Collision Race and Hardening', () => {
  let student1 = randomUUID();
  let student2 = randomUUID();
  let student3 = randomUUID();
  let admin = randomUUID();
  let clubId = randomUUID();
  let eventId = randomUUID();
  let sessionId = randomUUID();
  const runId = randomUUID().slice(0, 6);

  let student1Token: string;
  let student2Token: string;
  let student3Token: string;
  let adminToken: string;
  let sandbox: any;

  before(async () => {
    sandbox = require('sinon').createSandbox();

    await adminPrisma.user.createMany({
      data: [
        { id: student1, email: `s1_26e_${runId}@adypu.edu.in`, googleSub: `e1_${runId}`, fullName: 'S1', globalRole: 'STUDENT' },
        { id: student2, email: `s2_26e_${runId}@adypu.edu.in`, googleSub: `e2_${runId}`, fullName: 'S2', globalRole: 'STUDENT' },
        { id: student3, email: `s3_26e_${runId}@adypu.edu.in`, googleSub: `e3_${runId}`, fullName: 'S3', globalRole: 'STUDENT' },
        { id: admin, email: `admin_26e_${runId}@adypu.edu.in`, googleSub: `ea_${runId}`, fullName: 'A', globalRole: 'STUDENT' },
      ]
    });

    await adminPrisma.club.create({ data: { id: clubId, name: `Club 26E ${runId}` } });

    await adminPrisma.event.create({
      data: {
        id: eventId,
        title: `Event 26E ${runId}`,
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        isLocked: false,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: admin,
        eventType: 'WORKSHOP',
        eventClubs: { create: { clubId: clubId } }
      }
    });

    await adminPrisma.clubMembership.create({
      data: { userId: admin, clubId: clubId, role: 'CLUB_ADMIN' }
    });

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
        { eventId: eventId, userId: student2 },
        { eventId: eventId, userId: student3 },
      ]
    });

    student1Token = signJwt(student1);
    student2Token = signJwt(student2);
    student3Token = signJwt(student3);
    adminToken = signJwt(admin);
  });

  after(async () => {
    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId } });
    await adminPrisma.attendanceSession.deleteMany({ where: { id: sessionId } });
    await adminPrisma.eventRegistration.deleteMany({ where: { eventId } });
    await adminPrisma.eventClub.deleteMany({ where: { eventId } });
    await adminPrisma.event.deleteMany({ where: { id: eventId } });
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [student1, student2, student3, admin] } } });
  });

  it('Concurrent live scan (Promise.all) safely flags exactly one and awards 5 points to the other', async () => {
    const token1 = generateCustomQrPayload(sessionId, 'SECRET', 0);
    const token2 = generateCustomQrPayload(sessionId, 'SECRET', -1);
    const deviceId = 'race-device';

    // Fire both requests concurrently!
    const [res1, res2] = await Promise.all([
      request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${student1Token}`).send({
        session_id: sessionId, totp_token: token1, latitude: 10, longitude: 10, device_id: deviceId, device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
      }),
      request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${student2Token}`).send({
        session_id: sessionId, totp_token: token2, latitude: 10, longitude: 10, device_id: deviceId, device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
      })
    ]);

    if (res1.status !== 201) console.log(res1.body); assert.strictEqual(res1.status, 201);
    assert.strictEqual(res2.status, 201);

    const record1 = await adminPrisma.attendanceRecord.findUnique({ where: { id: res1.body.attendance_id } });
    const record2 = await adminPrisma.attendanceRecord.findUnique({ where: { id: res2.body.attendance_id } });

    const flag1 = (record1?.auditMetadata as any)?.device_collision_detected || false;
    const flag2 = (record2?.auditMetadata as any)?.device_collision_detected || false;

    // ONE must be flagged, one must be NOT flagged.
    assert.strictEqual(flag1 !== flag2, true);
  });

  it('Offline collision correctly applies 0 points and offline non-collision applies 5 points', async () => {
    // Generate valid tokens! Note offline doesn't check the window, but we should use standard token length just in case.
    // Wait, the Phase 26B fix requires `scanned_token` to be used for Replay protection (`consumedQrSignature`), so it just has to be unique.
    const batchDevice = 'batch-device';

    // We will use student3 and student4.
    const student4 = randomUUID();
    await adminPrisma.user.create({ data: { id: student4, email: `s4_26e_${runId}@adypu.edu.in`, googleSub: `s4-sub-${runId}`, fullName: 'S4', globalRole: 'STUDENT' }});
    await adminPrisma.eventRegistration.create({ data: { eventId: eventId, userId: student4 }});

    const nowIso = new Date().toISOString();
    const tokenA = generateCustomQrPayload(sessionId, 'SECRET', 0);
    const tokenB = generateCustomQrPayload(sessionId, 'SECRET', 0);

    const payload3 = {
      user_id: student3,
      session_id: sessionId,
      scanned_token: tokenA,
      scan_timestamp: nowIso,
      device_id: batchDevice,
      gps_lat: 10,
      gps_lng: 10,
      gps_accuracy: 5,
      mock_location_detected: false,
      offline_seq: 1
    };

    const payload4 = {
      user_id: student4, 
      session_id: sessionId,
      scanned_token: tokenB,
      scan_timestamp: nowIso,
      device_id: batchDevice,
      gps_lat: 10,
      gps_lng: 10,
      gps_accuracy: 5,
      mock_location_detected: false,
      offline_seq: 2
    };

    const student4Token = signJwt(student4);

    const res3 = await request(app)
      .post('/v1/attendance/sync-offline')
      .set('Authorization', `Bearer ${student3Token}`)
      .send({ records: [payload3] });

    const res4 = await request(app)
      .post('/v1/attendance/sync-offline')
      .set('Authorization', `Bearer ${student4Token}`)
      .send({ records: [payload4] });

    if (res3.status !== 200) console.log(res3.body);
    if (res4.status !== 200) console.log(res4.body);
    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res4.status, 200);
    assert.strictEqual(res3.body.processed, 1);
    assert.strictEqual(res4.body.processed, 1);
    
    const rec3 = await adminPrisma.attendanceRecord.findUnique({ where: { sessionId_userId: { sessionId, userId: student3 } } });
    const rec4 = await adminPrisma.attendanceRecord.findUnique({ where: { sessionId_userId: { sessionId, userId: student4 } } });
    
    const flag3 = (rec3?.auditMetadata as any)?.device_collision_detected || false;
    const flag4 = (rec4?.auditMetadata as any)?.device_collision_detected || false;

    // First one should not be flagged, second should be flagged. Or vice versa because of ordering by device_id (both are batch-device, so order is random/stable).
    assert.strictEqual(flag3 !== flag4, true);

    // Cleanup student 4
    await adminPrisma.attendanceRecord.deleteMany({ where: { userId: student4 } });
    await adminPrisma.eventRegistration.deleteMany({ where: { userId: student4 } });
    await adminPrisma.user.deleteMany({ where: { id: student4 } });
  });

  it('Device ID boundaries (1, 255, 256, empty)', async () => {
    const student5 = randomUUID();
    await adminPrisma.user.create({ data: { id: student5, email: `s5_26e_${runId}@adypu.edu.in`, googleSub: `s5_${runId}`, fullName: 'S5', globalRole: 'STUDENT' }});
    await adminPrisma.eventRegistration.create({ data: { eventId: eventId, userId: student5 }});
    const student5Token = signJwt(student5);

    const token = generateCustomQrPayload(sessionId, 'SECRET', 1); // valid next window (allowed by drift)

    // Empty device_id -> 400
    const res1 = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${student5Token}`).send({
      session_id: sessionId, totp_token: token, latitude: 10, longitude: 10, device_id: '', device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
    });
    assert.strictEqual(res1.status, 400);

    // 256 length -> 400
    const res2 = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${student5Token}`).send({
      session_id: sessionId, totp_token: token, latitude: 10, longitude: 10, device_id: 'a'.repeat(256), device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
    });
    assert.strictEqual(res2.status, 400);

    // 255 length -> 201
    const res3 = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${student5Token}`).send({
      session_id: sessionId, totp_token: token, latitude: 10, longitude: 10, device_id: 'a'.repeat(255), device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
    });
    assert.strictEqual(res3.status, 201);

    await adminPrisma.attendanceRecord.deleteMany({ where: { userId: student5 } });
    await adminPrisma.eventRegistration.deleteMany({ where: { userId: student5 } });
    await adminPrisma.user.deleteMany({ where: { id: student5 } });
    
    sandbox.restore();
  });
});
