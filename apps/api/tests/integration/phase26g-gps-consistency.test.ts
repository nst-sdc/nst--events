import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';


import crypto, { randomUUID } from 'crypto';

function generateCustomQrPayload(sessionId: string, qrSecret: string, offsetWindows: number): string {
  const windowEpoch = Math.floor(Date.now() / 30000) + offsetWindows;
  const hmacInput = `v1:${sessionId}:${windowEpoch}`;
  const hmac = crypto.createHmac('sha256', qrSecret);
  hmac.update(hmacInput);
  const base64Url = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signature = base64Url.substring(0, 16);
  return `v1:${sessionId}:${signature}`;
}

const app = createApp();

describe('Phase 26G: GPS Consistency', () => {
  const runId = randomUUID().slice(0, 6);
  const eventId = randomUUID();
  const sessionId = randomUUID();
  const clubId = randomUUID();
  
  const admin = randomUUID();
  const student = randomUUID();
  
  let adminToken: string;
  let studentToken: string;
  
  const validLat = 10;
  const validLng = 10;
  const outsideLat = 10.001; // Should be outside the 50m radius
  const deviceId = 'test_device';

  before(async () => {
    await adminPrisma.user.createMany({
      data: [
        { id: admin, email: `admin_g_${runId}@adypu.edu.in`, googleSub: `ag_${runId}`, fullName: 'AG', globalRole: 'STUDENT' },
        { id: student, email: `student_g_${runId}@adypu.edu.in`, googleSub: `sg_${runId}`, fullName: 'SG', globalRole: 'STUDENT' },
      ]
    });

    await adminPrisma.club.create({ data: { id: clubId, name: `CG_${runId}` } });

    await adminPrisma.event.create({
      data: {
        id: eventId,
        title: `EG_${runId}`,
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

    await adminPrisma.$executeRawUnsafe(`
      INSERT INTO attendance_sessions (id, event_id, title, start_time, end_time, open_at, close_at, qr_secret, created_by, geofence_radius, venue_latitude, venue_longitude)
      VALUES ('${sessionId}', '${eventId}', 'SG', now() - interval '1 hour', now() + interval '1 hour', now() - interval '1 hour', now() + interval '1 hour', 'SECRET', '${admin}', 50, ${validLat}, ${validLng})
    `);

    await adminPrisma.eventRegistration.create({
      data: { eventId: eventId, userId: student }
    });

    adminToken = signJwt(admin);
    studentToken = signJwt(student);
  });

  after(async () => {
    await adminPrisma.leaderboardScore.deleteMany({ where: { userId: { in: [admin, student] } } });
    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId } });
    await adminPrisma.eventRegistration.deleteMany({ where: { eventId } });
    await adminPrisma.attendanceSession.deleteMany({ where: { eventId } });
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.eventClub.deleteMany({ where: { eventId } });
    await adminPrisma.event.deleteMany({ where: { id: eventId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [admin, student] } } });
  });

  it('Live: invalid latitude bounds -> 400', async () => {
    const res = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${studentToken}`).send({
      session_id: sessionId, totp_token: generateCustomQrPayload(sessionId, 'SECRET', 0), latitude: 91, longitude: 10, device_id: deviceId, device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
    });
    assert.strictEqual(res.status, 400);
  });

  it('Live: negative gps_accuracy -> 400', async () => {
    const res = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${studentToken}`).send({
      session_id: sessionId, totp_token: generateCustomQrPayload(sessionId, 'SECRET', 0), latitude: 10, longitude: 10, device_id: deviceId, device_os: 'iOS', gps_accuracy: -5, mock_location_detected: false, app_version: '1.0'
    });
    assert.strictEqual(res.status, 400);
  });

  it('Live: mock_location_detected=true -> rejected', async () => {
    const res = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${studentToken}`).send({
      session_id: sessionId, totp_token: generateCustomQrPayload(sessionId, 'SECRET', 0), latitude: 10, longitude: 10, device_id: deviceId, device_os: 'iOS', gps_accuracy: 5, mock_location_detected: true, app_version: '1.0'
    });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.detail, 'MOCK_LOCATION_REJECTED');
  });

  it('Live: outside geofence -> rejected', async () => {
    const res = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${studentToken}`).send({
      session_id: sessionId, totp_token: generateCustomQrPayload(sessionId, 'SECRET', 0), latitude: outsideLat, longitude: validLng, device_id: deviceId, device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
    });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.detail, 'OUTSIDE_GEOFENCE');
  });

  it('Live: valid coordinates inside geofence -> success', async () => {
    const res = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${studentToken}`).send({
      session_id: sessionId, totp_token: generateCustomQrPayload(sessionId, 'SECRET', 0), latitude: validLat, longitude: validLng, device_id: deviceId, device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
    });
    if (res.status !== 201) console.error('LIVE SUCCESS TEST FAILED:', res.body);
    assert.strictEqual(res.status, 201);
  });

  it('Offline: mock_location_detected=true -> rejected in batch', async () => {
    const timestamp = new Date().toISOString();
    const token = generateCustomQrPayload(sessionId, 'SECRET', 0);
    const res = await request(app).post('/v1/attendance/sync-offline').set('Authorization', `Bearer ${studentToken}`).send({
      records: [
        { user_id: student, session_id: sessionId, scanned_token: token, scan_timestamp: timestamp, device_id: 'd2', gps_lat: validLat, gps_lng: validLng, gps_accuracy: 5, mock_location_detected: true, offline_seq: 1 }
      ]
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.processed, 0);
    assert.strictEqual(res.body.errors[0].error_code, 'MOCK_LOCATION_REJECTED');
  });

  it('Offline: outside geofence -> rejected in batch', async () => {
    const timestamp = new Date().toISOString();
    const token = generateCustomQrPayload(sessionId, 'SECRET', 0);
    const res = await request(app).post('/v1/attendance/sync-offline').set('Authorization', `Bearer ${studentToken}`).send({
      records: [
        { user_id: student, session_id: sessionId, scanned_token: token, scan_timestamp: timestamp, device_id: 'd3', gps_lat: outsideLat, gps_lng: validLng, gps_accuracy: 5, mock_location_detected: false, offline_seq: 2 }
      ]
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.processed, 0);
    assert.strictEqual(res.body.errors[0].error_code, 'OUTSIDE_GEOFENCE');
  });

  it('Offline: valid coordinates inside geofence -> success', async () => {
    const timestamp = new Date().toISOString();
    const token = generateCustomQrPayload(sessionId, 'SECRET', 0);
    
    // We need to delete the live attendance record first to test offline properly for the same user
    await adminPrisma.leaderboardScore.deleteMany({ where: { userId: student } });
    await adminPrisma.attendanceRecord.deleteMany({ where: { userId: student } });

    const res = await request(app).post('/v1/attendance/sync-offline').set('Authorization', `Bearer ${studentToken}`).send({
      records: [
        { user_id: student, session_id: sessionId, scanned_token: token, scan_timestamp: timestamp, device_id: 'd4', gps_lat: validLat, gps_lng: validLng, gps_accuracy: 5, mock_location_detected: false, offline_seq: 3 }
      ]
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.processed, 1);
  });
});
