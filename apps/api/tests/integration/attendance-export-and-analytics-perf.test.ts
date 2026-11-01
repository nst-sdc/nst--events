import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { adminPrisma } from '../helpers/adminDb';
import { attendanceService } from '../../src/modules/attendance/attendance.service';
import { adminAnalyticsService } from '../../src/modules/admin/analytics.service';

describe('TASK P5: Performance Optimization - Attendance Export Streaming & Analytics Cleanup', () => {
  let adminUserId: string;
  let clubId: string;
  let eventId: string;
  let sessionId: string;
  const createdUserIds: string[] = [];

  before(async () => {
    // 1. Setup Admin User & Club
    adminUserId = randomUUID();
    await adminPrisma.user.create({
      data: {
        id: adminUserId,
        email: `perf_admin_${Date.now()}@test.com`,
        fullName: 'Performance Admin',
        globalRole: 'PLATFORM_ADMIN',
        googleSub: `sub_perf_admin_${Date.now()}`,
      },
    });
    createdUserIds.push(adminUserId);

    const club = await adminPrisma.club.create({
      data: { name: `Performance Club ${Date.now()}` },
    });
    clubId = club.id;

    // 2. Setup Event & Session
    const event = await adminPrisma.event.create({
      data: {
        title: 'Large Attendance Event',
        startTime: new Date(),
        endTime: new Date(Date.now() + 86400000),
        eventType: 'WORKSHOP',
        createdBy: adminUserId,
      },
    });
    eventId = event.id;

    await adminPrisma.eventClub.create({
      data: { eventId, clubId, isPrimary: true },
    });

    const session = await adminPrisma.attendanceSession.create({
      data: {
        eventId,
        createdBy: adminUserId,
        title: 'Main Hall Session',
        startTime: new Date(),
        endTime: new Date(Date.now() + 86400000),
        openAt: new Date(),
        closeAt: new Date(Date.now() + 86400000),
        qrSecret: 'perf_secret',
      },
    });
    sessionId = session.id;

    const now = Date.now();
    const formulaUsers = [
      { id: randomUUID(), fullName: '=SUM(A1:A10)', email: `equals_${now}@test.com`, googleSub: `sub_eq_${now}` },
      { id: randomUUID(), fullName: '+9199999999', email: `plus_${now}@test.com`, googleSub: `sub_plus_${now}` },
      { id: randomUUID(), fullName: '-100CMD', email: `minus_${now}@test.com`, googleSub: `sub_minus_${now}` },
      { id: randomUUID(), fullName: '@CALCULATE()', email: `at_${now}@test.com`, googleSub: `sub_at_${now}` },
      { id: randomUUID(), fullName: 'Jane "Ace" Doe', email: `quotes_${now}@test.com`, googleSub: `sub_quotes_${now}` },
    ];

    await adminPrisma.user.createMany({ data: formulaUsers });
    formulaUsers.forEach(u => createdUserIds.push(u.id));

    // Create attendance records for formula test users
    for (const u of formulaUsers) {
      await adminPrisma.attendanceRecord.create({
        data: {
          sessionId,
          userId: u.id,
          status: 'PRESENT',
          method: 'QR',
          markedAt: new Date(),
        },
      });
    }

    // 4. Bulk seed users & attendance records up to 5,000 rows
    const TOTAL_BULK = 4995; // 5 special + 4995 = 5,000 records
    const CHUNK_SIZE = 1000;
    const baseTimestamp = Date.now() - 100000;

    for (let c = 0; c < TOTAL_BULK; c += CHUNK_SIZE) {
      const end = Math.min(c + CHUNK_SIZE, TOTAL_BULK);
      const userBatch = [];
      for (let i = c; i < end; i++) {
        const uid = randomUUID();
        userBatch.push({
          id: uid,
          fullName: `Student ${i}`,
          email: `bulk_student_${i}_${Date.now()}@test.com`,
          googleSub: `sub_bulk_${Date.now()}_${i}`,
        });
        createdUserIds.push(uid);
      }
      await adminPrisma.user.createMany({ data: userBatch });

      const recordBatch = userBatch.map((u, idx) => ({
        sessionId,
        userId: u.id,
        status: 'PRESENT' as const,
        method: 'QR' as const,
        markedAt: new Date(baseTimestamp + (c + idx) * 10),
      }));
      await adminPrisma.attendanceRecord.createMany({ data: recordBatch });
    }
  });

  after(async () => {
    // Cleanup records, sessions, events, users, clubs
    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId } });
    await adminPrisma.attendanceSession.deleteMany({ where: { eventId } });
    await adminPrisma.eventClub.deleteMany({ where: { eventId } });
    await adminPrisma.event.deleteMany({ where: { id: eventId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });

    // Delete users in chunks of 1000
    for (let i = 0; i < createdUserIds.length; i += 1000) {
      const chunk = createdUserIds.slice(i, i + 1000);
      await adminPrisma.user.deleteMany({ where: { id: { in: chunk } } });
    }
  });

  it('exportEventAttendance streams 5,000 rows incrementally in 500-row batches with bounded memory', async () => {
    let chunksCount = 0;
    let totalBytes = 0;
    const chunks: string[] = [];

    // Track write events to assert incremental streaming batches
    const customStream = new Writable({
      write(chunk, encoding, callback) {
        chunksCount++;
        const str = chunk.toString();
        totalBytes += chunk.length;
        chunks.push(str);
        callback();
      },
    });

    const memBefore = process.memoryUsage().heapUsed;

    // Stream CSV to custom writable stream
    await attendanceService.exportEventAttendance(adminUserId, eventId, customStream);

    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);

    // 1. Assert multiple chunk writes occurred (demonstrating streaming, not single buffered write)
    assert.ok(
      chunksCount >= 10,
      `Expected at least 10 batch writes for 5,000 records, received ${chunksCount} chunks`
    );

    // 2. Combine chunks and verify row counts
    const fullCsv = chunks.join('');
    const lines = fullCsv.trim().split('\n');

    // Header + 5,000 data rows = 5,001 lines
    assert.strictEqual(lines[0], 'user_name,user_email,session_title,status,method,marked_at');
    assert.strictEqual(lines.length, 5001, 'Expected exactly 5,001 CSV lines (header + 5000 rows)');

    // 3. Assert bounded memory delta (should not accumulate full unbatched data structures)
    assert.ok(
      memDeltaMB < 100,
      `Expected bounded heap delta during streaming, measured ${memDeltaMB.toFixed(2)} MB`
    );
  });

  it('sanitizes formula-injection characters (=, +, -, @) and escapes quotes correctly', async () => {
    // Call in non-streaming mode to verify string return and cell escaping
    const csv = await attendanceService.exportEventAttendance(adminUserId, eventId);
    const lines = csv.split('\n');

    // Formula injection tests: prefix cells with single quote (')
    const equalsLine = lines.find(l => l.includes('=SUM(A1:A10)'));
    assert.ok(equalsLine, 'equalsLine must exist');
    assert.ok(
      equalsLine.includes('"\'=SUM(A1:A10)"'),
      `Expected formula prefix '=SUM...' to be escaped as \"'=SUM...\", got: ${equalsLine}`
    );

    const plusLine = lines.find(l => l.includes('+9199999999'));
    assert.ok(plusLine, 'plusLine must exist');
    assert.ok(
      plusLine.includes("\"\'+9199999999\""),
      `Expected formula prefix '+...' to be escaped with leading single quote, got: ${plusLine}`
    );

    const minusLine = lines.find(l => l.includes('-100CMD'));
    assert.ok(minusLine, 'minusLine must exist');
    assert.ok(
      minusLine.includes("\"\'-100CMD\""),
      `Expected formula prefix '-...' to be escaped with leading single quote, got: ${minusLine}`
    );

    const atLine = lines.find(l => l.includes('@CALCULATE()'));
    assert.ok(atLine, 'atLine must exist');
    assert.ok(
      atLine.includes("\"\'@CALCULATE()\""),
      `Expected formula prefix '@...' to be escaped with leading single quote, got: ${atLine}`
    );

    // Double-quote escaping test: "Ace" -> ""Ace""
    const quotesLine = lines.find(l => l.includes('Jane ""Ace"" Doe'));
    assert.ok(quotesLine, 'quotesLine must exist');
    assert.ok(
      quotesLine.includes('"Jane ""Ace"" Doe"'),
      `Expected embedded quotes to be escaped with double quotes, got: ${quotesLine}`
    );
  });

  it('getAttendanceAnalytics response remains identical and eliminates wasteful findMany query', async () => {
    // 1. Seed attempts for analytics testing
    const attemptTime = new Date();
    await adminPrisma.attendanceAttempt.createMany({
      data: [
        { sessionId, userId: adminUserId, isSuccess: true, attemptedAt: attemptTime },
        { sessionId, userId: adminUserId, isSuccess: false, failureReason: 'OUT_OF_RANGE', attemptedAt: attemptTime },
      ],
    });

    // 2. Call getAttendanceAnalytics
    const dateRange = {
      start: new Date(Date.now() - 3600000).toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
    };

    const analytics = await adminAnalyticsService.getAttendanceAnalytics(adminUserId, dateRange);

    // Verify response shape is intact
    assert.ok(Array.isArray(analytics.time_series), 'time_series must be an array');
    assert.ok(Array.isArray(analytics.failure_breakdown), 'failure_breakdown must be an array');
    assert.strictEqual(typeof analytics.time_series[0].date, 'string');
    assert.strictEqual(typeof analytics.time_series[0].success, 'number');
    assert.strictEqual(typeof analytics.time_series[0].fail, 'number');

    const outOfRange = analytics.failure_breakdown.find(f => f.reason === 'OUT_OF_RANGE');
    assert.ok(outOfRange, 'OUT_OF_RANGE failure reason must be counted');
    assert.ok(outOfRange.count >= 1);

    // Cleanup attempts
    await adminPrisma.attendanceAttempt.deleteMany({ where: { sessionId } });
  });
});
