import test from 'node:test';
import assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { attendanceService } from '../../src/modules/attendance/attendance.service';
import { generateQrPayload } from '../../src/modules/attendance/totp.utils';
import { UnprocessableEntityError, ConflictError } from '../../src/lib/errors';

test('Phase 2: Attendance Attempt Telemetry Persistence', async (t) => {
  // 1. Setup mock user
  const student = await adminPrisma.user.create({
    data: {
      email: `student-telemetry-${Date.now()}@test.com`,
      googleSub: `sub-telemetry-${Date.now()}`,
      fullName: 'Telemetry Student',
    },
  });

  const organizer = await adminPrisma.user.create({
    data: {
      email: `organizer-telemetry-${Date.now()}@test.com`,
      googleSub: `sub-org-${Date.now()}`,
      fullName: 'Telemetry Organizer',
    },
  });

  // 2. Setup event and attendance session
  const event = await adminPrisma.event.create({
    data: {
      title: 'Telemetry Test Event',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      eventType: 'WORKSHOP',
      createdBy: organizer.id,
      state: 'PUBLISHED',
      isLocked: false,
    },
  });

  const session = await adminPrisma.attendanceSession.create({
    data: {
      eventId: event.id,
      title: 'Telemetry Session',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      openAt: new Date(Date.now() - 3600000),
      closeAt: new Date(Date.now() + 3600000),
      geofenceRadius: 50, // 50m radius
      venueLatitude: 18.5204,
      venueLongitude: 73.8567,
      qrSecret: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      createdBy: organizer.id,
    },
  });

  // Register student
  await adminPrisma.eventRegistration.create({
    data: {
      eventId: event.id,
      userId: student.id,
      registrationStatus: 'REGISTERED',
    },
  });

  const validQr = generateQrPayload(session.id, session.qrSecret);

  await t.test('(a) & (b) & (d): Rejected scan (OUTSIDE_GEOFENCE) returns 422, logs attempt, leaves records empty', async () => {
    // Far coordinates (>1000m away)
    const farPayload = {
      session_id: session.id,
      totp_token: validQr,
      latitude: 18.6000,
      longitude: 73.9000,
      device_id: 'device-outside',
      device_os: 'android',
      gps_accuracy: 10,
      mock_location_detected: false,
      app_version: '1.0.0',
    };

    // (a) Assert 422 is thrown
    await assert.rejects(
      attendanceService.markAttendance(student.id, farPayload),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.statusCode, 422);
        assert.strictEqual(err.message, 'OUTSIDE_GEOFENCE');
        return true;
      }
    );

    // (b) Assert attendance_attempts gets a row on rejection
    const attempt = await adminPrisma.attendanceAttempt.findFirst({
      where: {
        userId: student.id,
        sessionId: session.id,
        deviceId: 'device-outside',
      },
    });
    assert.ok(attempt, 'Expected an attendance_attempt record to exist');
    assert.strictEqual(attempt.isSuccess, false);
    assert.strictEqual(attempt.failureReason, 'OUTSIDE_GEOFENCE');
    assert.strictEqual(attempt.latitude, 18.6000);
    assert.strictEqual(attempt.longitude, 73.9000);

    // (d) Assert attendance_records is NEVER touched on failure
    const record = await adminPrisma.attendanceRecord.findFirst({
      where: {
        userId: student.id,
        sessionId: session.id,
      },
    });
    assert.strictEqual(record, null, 'attendance_records must remain empty on rejection');
  });

  await t.test('(a) & (b): Express pre-check rejection (QR_EXPIRED) returns 422 and logs attempt', async () => {
    const expiredPayload = {
      session_id: session.id,
      totp_token: `v1:${session.id}:invalid-token`,
      latitude: 18.5204,
      longitude: 73.8567,
      device_id: 'device-expired-qr',
      device_os: 'ios',
      gps_accuracy: 5,
      mock_location_detected: false,
      app_version: '1.0.0',
    };

    await assert.rejects(
      attendanceService.markAttendance(student.id, expiredPayload),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.statusCode, 422);
        assert.strictEqual(err.message, 'QR_EXPIRED');
        return true;
      }
    );

    const attempt = await adminPrisma.attendanceAttempt.findFirst({
      where: {
        userId: student.id,
        sessionId: session.id,
        deviceId: 'device-expired-qr',
      },
    });
    assert.ok(attempt, 'Expected an attendance_attempt record for QR_EXPIRED');
    assert.strictEqual(attempt.isSuccess, false);
    assert.strictEqual(attempt.failureReason, 'QR_EXPIRED');
  });

  await t.test('(c): Successful scan records isSuccess = true and creates attendance_record', async () => {
    const validPayload = {
      session_id: session.id,
      totp_token: validQr,
      latitude: 18.5204,
      longitude: 73.8567,
      device_id: 'device-valid',
      device_os: 'ios',
      gps_accuracy: 5,
      mock_location_detected: false,
      app_version: '1.0.0',
    };

    const res = await attendanceService.markAttendance(student.id, validPayload);
    assert.strictEqual(res.status, 'PRESENT');

    // Attempt logged with isSuccess: true
    const attempt = await adminPrisma.attendanceAttempt.findFirst({
      where: {
        userId: student.id,
        sessionId: session.id,
        deviceId: 'device-valid',
      },
    });
    assert.ok(attempt);
    assert.strictEqual(attempt.isSuccess, true);
    assert.strictEqual(attempt.failureReason, null);

    // Record created
    const record = await adminPrisma.attendanceRecord.findFirst({
      where: {
        userId: student.id,
        sessionId: session.id,
      },
    });
    assert.ok(record);
    assert.strictEqual(record.status, 'PRESENT');
  });

  await t.test('Duplicate scan throws ALREADY_RECORDED and logs rejection', async () => {
    const validPayload = {
      session_id: session.id,
      totp_token: validQr,
      latitude: 18.5204,
      longitude: 73.8567,
      device_id: 'device-valid',
      device_os: 'ios',
      gps_accuracy: 5,
      mock_location_detected: false,
      app_version: '1.0.0',
    };

    await assert.rejects(
      attendanceService.markAttendance(student.id, validPayload),
      (err: any) => {
        assert.ok(err instanceof ConflictError);
        assert.strictEqual(err.message, 'ALREADY_RECORDED');
        return true;
      }
    );

    const duplicateAttempt = await adminPrisma.attendanceAttempt.findFirst({
      where: {
        userId: student.id,
        sessionId: session.id,
        failureReason: 'ALREADY_RECORDED',
      },
    });
    assert.ok(duplicateAttempt);
    assert.strictEqual(duplicateAttempt.isSuccess, false);
  });

  await t.test('Batch offline sync logs telemetry for failed records', async () => {
    const offlineRes = await attendanceService.syncOffline(student.id, {
      records: [
        {
          user_id: student.id,
          session_id: session.id,
          scanned_token: 'v1:invalid-offline-token',
          scan_timestamp: new Date().toISOString(),
          device_id: 'offline-phone-1',
          gps_lat: 18.5204,
          gps_lng: 73.8567,
          gps_accuracy: 8,
          mock_location_detected: false,
          offline_seq: 1,
        },
      ],
    });

    assert.strictEqual(offlineRes.skipped, 1);
    assert.strictEqual(offlineRes.errors[0].error_code, 'INVALID_SIGNATURE');

    const offlineAttempt = await adminPrisma.attendanceAttempt.findFirst({
      where: {
        userId: student.id,
        sessionId: session.id,
        deviceId: 'offline-phone-1',
        isOfflineSync: true,
      },
    });
    assert.ok(offlineAttempt, 'Expected offline attempt to be recorded');
    assert.strictEqual(offlineAttempt.isSuccess, false);
    assert.strictEqual(offlineAttempt.failureReason, 'INVALID_SIGNATURE');
  });
});
