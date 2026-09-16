import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { adminAnalyticsService } from '../../src/modules/admin/analytics.service';
import { adminPrisma } from '../helpers/adminDb';
import { ForbiddenError } from '../../src/lib/errors';
import { randomUUID as uuidv4 } from 'node:crypto';

describe('AdminAnalyticsService', () => {

  it('should return GLOBAL scope for PLATFORM_ADMIN', async () => {
    const userId = uuidv4();
    await adminPrisma.user.create({
      data: {
        id: userId,
        email: `platform_admin_${Date.now()}@test.com`,
        fullName: 'Platform Admin',
        globalRole: 'PLATFORM_ADMIN',
        googleSub: `sub_${Date.now()}_${userId}`,
      },
    });

    const access = await adminAnalyticsService.getAnalyticsAccess(userId);
    assert.deepStrictEqual(access, { scope: 'GLOBAL' });
  });

  it('should return GLOBAL scope for FACULTY_ADMIN', async () => {
    const userId = uuidv4();
    await adminPrisma.user.create({
      data: {
        id: userId,
        email: `faculty_admin_${Date.now()}@test.com`,
        fullName: 'Faculty Admin',
        globalRole: 'FACULTY_ADMIN',
        googleSub: `sub_${Date.now()}_${userId}`,
      },
    });

    const access = await adminAnalyticsService.getAnalyticsAccess(userId);
    assert.deepStrictEqual(access, { scope: 'GLOBAL' });
  });

  it('should return CLUB scope and clubIds for CLUB_ADMIN', async () => {
    const userId = uuidv4();
    await adminPrisma.user.create({
      data: {
        id: userId,
        email: `club_admin_${Date.now()}@test.com`,
        fullName: 'Club Admin',
        globalRole: 'STUDENT',
        googleSub: `sub_${Date.now()}_${userId}`,
      },
    });

    const club = await adminPrisma.club.create({
      data: {
        name: `Test Club ${Date.now()}`,
      },
    });

    await adminPrisma.clubMembership.create({
      data: {
        userId,
        clubId: club.id,
        role: 'CLUB_ADMIN',
      },
    });

    const access = await adminAnalyticsService.getAnalyticsAccess(userId);
    assert.deepStrictEqual(access, { scope: 'CLUB', clubIds: [club.id] });
  });

  it('should throw ForbiddenError for STUDENT without CLUB_ADMIN role', async () => {
    const userId = uuidv4();
    await adminPrisma.user.create({
      data: {
        id: userId,
        email: `student_${Date.now()}@test.com`,
        fullName: 'Student',
        globalRole: 'STUDENT',
        googleSub: `sub_${Date.now()}_${userId}`,
      },
    });

    await assert.rejects(
      async () => {
        await adminAnalyticsService.getAnalyticsAccess(userId);
      },
      (err: any) => err instanceof ForbiddenError
    );
  });

  it('should throw ForbiddenError for CORE_MEMBER without CLUB_ADMIN role', async () => {
    const userId = uuidv4();
    await adminPrisma.user.create({
      data: {
        id: userId,
        email: `core_member_${Date.now()}@test.com`,
        fullName: 'Core Member',
        globalRole: 'STUDENT',
        googleSub: `sub_${Date.now()}_${userId}`,
      },
    });

    const club = await adminPrisma.club.create({
      data: {
        name: `Test Club 2 ${Date.now()}`,
      },
    });

    await adminPrisma.clubMembership.create({
      data: {
        userId,
        clubId: club.id,
        role: 'CORE_MEMBER',
      },
    });

    await assert.rejects(
      async () => {
        await adminAnalyticsService.getAnalyticsAccess(userId);
      },
      (err: any) => err instanceof ForbiddenError
    );
  });

  it('should throw ForbiddenError if user does not exist', async () => {
    const userId = uuidv4();
    await assert.rejects(
      async () => {
        await adminAnalyticsService.getAnalyticsAccess(userId);
      },
      (err: any) => err instanceof ForbiddenError
    );
  });
});

describe('AdminAnalyticsService - getOverviewAnalytics', () => {
  it('should return aggregated metrics for GLOBAL scope', async () => {
    const userId = uuidv4();
    await adminPrisma.user.create({
      data: {
        id: userId,
        email: `platform_admin_overview_${Date.now()}@test.com`,
        fullName: 'Platform Admin',
        globalRole: 'PLATFORM_ADMIN',
        googleSub: `sub_overview_${Date.now()}_${userId}`,
      },
    });

    const overview = await adminAnalyticsService.getOverviewAnalytics(userId);
    assert.ok(overview);
    assert.strictEqual(typeof overview.total_events, 'number');
    assert.strictEqual(typeof overview.total_registrations, 'number');
    assert.strictEqual(typeof overview.attendance_rate, 'number');
    assert.strictEqual(typeof overview.active_clubs, 'number');
  });

  it('should explicitly enforce cross-club data isolation for CLUB scope', async () => {
    const userId = uuidv4();
    const otherUserId = uuidv4();

    // Create a club admin user
    await adminPrisma.user.createMany({
      data: [
        {
          id: userId,
          email: `club_admin_isolation_${Date.now()}@test.com`,
          fullName: 'Club Admin',
          globalRole: 'STUDENT',
          googleSub: `sub_isolation_${Date.now()}_${userId}`,
        },
        {
          id: otherUserId,
          email: `other_admin_${Date.now()}@test.com`,
          fullName: 'Other Admin',
          globalRole: 'STUDENT',
          googleSub: `sub_other_${Date.now()}_${otherUserId}`,
        }
      ]
    });

    // Create my club and another club
    const myClub = await adminPrisma.club.create({ data: { name: `My Club ${Date.now()}` } });
    const otherClub = await adminPrisma.club.create({ data: { name: `Other Club ${Date.now()}` } });

    // Make user admin of myClub, otherUser admin of otherClub
    await adminPrisma.clubMembership.createMany({
      data: [
        { userId, clubId: myClub.id, role: 'CLUB_ADMIN' },
        { userId: otherUserId, clubId: otherClub.id, role: 'CLUB_ADMIN' }
      ]
    });

    // Create 1 event for myClub and 2 events for otherClub
    const evt1 = await adminPrisma.event.create({
      data: {
        title: 'My Event',
        startTime: new Date(),
        endTime: new Date(),
        eventType: 'WORKSHOP',
        createdBy: userId,
      }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt1.id, clubId: myClub.id, isPrimary: true } });

    const evt2 = await adminPrisma.event.create({
      data: {
        title: 'Other Event 1',
        startTime: new Date(),
        endTime: new Date(),
        eventType: 'WORKSHOP',
        createdBy: otherUserId,
      }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt2.id, clubId: otherClub.id, isPrimary: true } });

    const evt3 = await adminPrisma.event.create({
      data: {
        title: 'Other Event 2',
        startTime: new Date(),
        endTime: new Date(),
        eventType: 'WORKSHOP',
        createdBy: otherUserId,
      }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt3.id, clubId: otherClub.id, isPrimary: true } });

    const overview = await adminAnalyticsService.getOverviewAnalytics(userId);
    
    // Total events should be 1, because the user only administers myClub, ignoring the 2 events from otherClub.
    assert.strictEqual(overview.total_events, 1);
    // Active clubs should be 1
    assert.strictEqual(overview.active_clubs, 1);
  });
});

describe('AdminAnalyticsService - getAttendanceAnalytics', () => {
  it('should explicitly enforce cross-club data isolation for CLUB scope', async () => {
    const userId = uuidv4();
    const otherUserId = uuidv4();

    await adminPrisma.user.createMany({
      data: [
        {
          id: userId,
          email: `att_admin_${Date.now()}@test.com`,
          fullName: 'Att Admin',
          globalRole: 'STUDENT',
          googleSub: `sub_att_${Date.now()}_${userId}`,
        },
        {
          id: otherUserId,
          email: `att_other_${Date.now()}@test.com`,
          fullName: 'Att Other',
          globalRole: 'STUDENT',
          googleSub: `sub_att_other_${Date.now()}_${otherUserId}`,
        }
      ]
    });

    const myClub = await adminPrisma.club.create({ data: { name: `Att My Club ${Date.now()}` } });
    const otherClub = await adminPrisma.club.create({ data: { name: `Att Other Club ${Date.now()}` } });

    await adminPrisma.clubMembership.createMany({
      data: [
        { userId, clubId: myClub.id, role: 'CLUB_ADMIN' },
        { userId: otherUserId, clubId: otherClub.id, role: 'CLUB_ADMIN' }
      ]
    });

    const evt1 = await adminPrisma.event.create({
      data: { title: 'My Event Att', startTime: new Date(), endTime: new Date(), eventType: 'WORKSHOP', createdBy: userId }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt1.id, clubId: myClub.id, isPrimary: true } });

    const evt2 = await adminPrisma.event.create({
      data: { title: 'Other Event Att', startTime: new Date(), endTime: new Date(), eventType: 'WORKSHOP', createdBy: otherUserId }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt2.id, clubId: otherClub.id, isPrimary: true } });

    // Sessions and Attempts
    const sess1 = await adminPrisma.attendanceSession.create({
      data: { eventId: evt1.id, createdBy: userId, title: 'Session 1', startTime: new Date(), endTime: new Date(Date.now() + 3600000), openAt: new Date(), closeAt: new Date(Date.now() + 3600000), qrSecret: 'secret1' }
    });
    const sess2 = await adminPrisma.attendanceSession.create({
      data: { eventId: evt2.id, createdBy: otherUserId, title: 'Session 2', startTime: new Date(), endTime: new Date(Date.now() + 3600000), openAt: new Date(), closeAt: new Date(Date.now() + 3600000), qrSecret: 'secret2' }
    });

    await adminPrisma.attendanceAttempt.create({
      data: { sessionId: sess1.id, userId, isSuccess: true }
    });
    await adminPrisma.attendanceAttempt.create({
      data: { sessionId: sess2.id, userId: otherUserId, isSuccess: true }
    });
    await adminPrisma.attendanceAttempt.create({
      data: { sessionId: sess2.id, userId, isSuccess: false, failureReason: 'LATE' }
    });

    const data = await adminAnalyticsService.getAttendanceAnalytics(userId, {
      start: new Date(Date.now() - 86400000).toISOString(),
      end: new Date(Date.now() + 86400000).toISOString()
    });

    // Expect 1 attempt from sess1, ignoring the 2 attempts from sess2
    assert.strictEqual(data.time_series.length, 1);
    assert.strictEqual(data.time_series[0].success, 1);
    assert.strictEqual(data.time_series[0].fail, 0);
    assert.strictEqual(data.failure_breakdown.length, 0);
  });
});

describe('AdminAnalyticsService - getEventAnalytics', () => {
  it('should explicitly enforce cross-club data isolation for CLUB scope', async () => {
    const userId = uuidv4();
    const otherUserId = uuidv4();

    await adminPrisma.user.createMany({
      data: [
        { id: userId, email: `ev_admin_${Date.now()}@test.com`, fullName: 'Ev Admin', globalRole: 'STUDENT', googleSub: `sub_ev_${Date.now()}_${userId}` },
        { id: otherUserId, email: `ev_other_${Date.now()}@test.com`, fullName: 'Ev Other', globalRole: 'STUDENT', googleSub: `sub_ev_other_${Date.now()}_${otherUserId}` }
      ]
    });

    const myClub = await adminPrisma.club.create({ data: { name: `Ev My Club ${Date.now()}` } });
    const otherClub = await adminPrisma.club.create({ data: { name: `Ev Other Club ${Date.now()}` } });

    await adminPrisma.clubMembership.createMany({
      data: [
        { userId, clubId: myClub.id, role: 'CLUB_ADMIN' },
        { userId: otherUserId, clubId: otherClub.id, role: 'CLUB_ADMIN' }
      ]
    });

    const evt1 = await adminPrisma.event.create({
      data: { title: 'My Event Ev', startTime: new Date(), endTime: new Date(), eventType: 'WORKSHOP', state: 'PUBLISHED', createdBy: userId }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt1.id, clubId: myClub.id, isPrimary: true } });

    const evt2 = await adminPrisma.event.create({
      data: { title: 'Other Event Ev', startTime: new Date(), endTime: new Date(), eventType: 'WORKSHOP', state: 'DRAFT', createdBy: otherUserId }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt2.id, clubId: otherClub.id, isPrimary: true } });

    const data = await adminAnalyticsService.getEventAnalytics(userId);

    assert.strictEqual(data.recent_events.length, 1);
    assert.strictEqual(data.recent_events[0].id, evt1.id);
    assert.strictEqual(data.pipeline_counts['PUBLISHED'], 1);
    assert.strictEqual(data.pipeline_counts['DRAFT'], 0);
  });
});

describe('AdminAnalyticsService - getRegistrationAnalytics', () => {
  it('should explicitly enforce cross-club data isolation for CLUB scope', async () => {
    const userId = uuidv4();
    const otherUserId = uuidv4();

    await adminPrisma.user.createMany({
      data: [
        { id: userId, email: `reg_admin_${Date.now()}@test.com`, fullName: 'Reg Admin', globalRole: 'STUDENT', googleSub: `sub_reg_${Date.now()}_${userId}` },
        { id: otherUserId, email: `reg_other_${Date.now()}@test.com`, fullName: 'Reg Other', globalRole: 'STUDENT', googleSub: `sub_reg_other_${Date.now()}_${otherUserId}` }
      ]
    });

    const myClub = await adminPrisma.club.create({ data: { name: `Reg My Club ${Date.now()}` } });
    const otherClub = await adminPrisma.club.create({ data: { name: `Reg Other Club ${Date.now()}` } });

    await adminPrisma.clubMembership.createMany({
      data: [
        { userId, clubId: myClub.id, role: 'CLUB_ADMIN' },
        { userId: otherUserId, clubId: otherClub.id, role: 'CLUB_ADMIN' }
      ]
    });

    const evt1 = await adminPrisma.event.create({
      data: { title: 'My Event Reg', startTime: new Date(), endTime: new Date(), eventType: 'WORKSHOP', createdBy: userId }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt1.id, clubId: myClub.id, isPrimary: true } });

    const evt2 = await adminPrisma.event.create({
      data: { title: 'Other Event Reg', startTime: new Date(), endTime: new Date(), eventType: 'WORKSHOP', createdBy: otherUserId }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt2.id, clubId: otherClub.id, isPrimary: true } });

    await adminPrisma.eventRegistration.create({
      data: { eventId: evt1.id, userId }
    });
    await adminPrisma.eventRegistration.create({
      data: { eventId: evt2.id, userId: otherUserId }
    });
    await adminPrisma.eventRegistration.create({
      data: { eventId: evt2.id, userId }
    });

    const data = await adminAnalyticsService.getRegistrationAnalytics(userId, {
      start: new Date(Date.now() - 86400000).toISOString(),
      end: new Date(Date.now() + 86400000).toISOString()
    });

    assert.strictEqual(data.time_series.length, 1);
    assert.strictEqual(data.time_series[0].count, 1);
  });
});

describe('AdminAnalyticsService - getClubsAnalytics', () => {
  it('should explicitly enforce cross-club data isolation for CLUB scope', async () => {
    const userId = uuidv4();
    const otherUserId = uuidv4();

    await adminPrisma.user.createMany({
      data: [
        { id: userId, email: `cl_admin_${Date.now()}@test.com`, fullName: 'Cl Admin', globalRole: 'STUDENT', googleSub: `sub_cl_${Date.now()}_${userId}` },
        { id: otherUserId, email: `cl_other_${Date.now()}@test.com`, fullName: 'Cl Other', globalRole: 'STUDENT', googleSub: `sub_cl_other_${Date.now()}_${otherUserId}` }
      ]
    });

    const myClub = await adminPrisma.club.create({ data: { name: `Cl My Club ${Date.now()}` } });
    const otherClub = await adminPrisma.club.create({ data: { name: `Cl Other Club ${Date.now()}` } });

    await adminPrisma.clubMembership.createMany({
      data: [
        { userId, clubId: myClub.id, role: 'CLUB_ADMIN' },
        { userId: otherUserId, clubId: otherClub.id, role: 'CLUB_ADMIN' }
      ]
    });

    const data = await adminAnalyticsService.getClubsAnalytics(userId);

    assert.strictEqual(data.clubs.length, 1);
    assert.strictEqual(data.clubs[0].id, myClub.id);
  });
});

describe('AdminAnalyticsService - getDisputeAnalytics', () => {
  it('should explicitly enforce cross-club data isolation for CLUB scope', async () => {
    const userId = uuidv4();
    const otherUserId = uuidv4();

    await adminPrisma.user.createMany({
      data: [
        { id: userId, email: `di_admin_${Date.now()}@test.com`, fullName: 'Di Admin', globalRole: 'STUDENT', googleSub: `sub_di_${Date.now()}_${userId}` },
        { id: otherUserId, email: `di_other_${Date.now()}@test.com`, fullName: 'Di Other', globalRole: 'STUDENT', googleSub: `sub_di_other_${Date.now()}_${otherUserId}` }
      ]
    });

    const myClub = await adminPrisma.club.create({ data: { name: `Di My Club ${Date.now()}` } });
    const otherClub = await adminPrisma.club.create({ data: { name: `Di Other Club ${Date.now()}` } });

    await adminPrisma.clubMembership.createMany({
      data: [
        { userId, clubId: myClub.id, role: 'CLUB_ADMIN' },
        { userId: otherUserId, clubId: otherClub.id, role: 'CLUB_ADMIN' }
      ]
    });

    const evt1 = await adminPrisma.event.create({
      data: { title: 'My Event Di', startTime: new Date(), endTime: new Date(), eventType: 'WORKSHOP', createdBy: userId }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt1.id, clubId: myClub.id, isPrimary: true } });

    const evt2 = await adminPrisma.event.create({
      data: { title: 'Other Event Di', startTime: new Date(), endTime: new Date(), eventType: 'WORKSHOP', createdBy: otherUserId }
    });
    await adminPrisma.eventClub.create({ data: { eventId: evt2.id, clubId: otherClub.id, isPrimary: true } });

    const sess1 = await adminPrisma.attendanceSession.create({
      data: { eventId: evt1.id, createdBy: userId, title: 'Session 1', startTime: new Date(), endTime: new Date(Date.now() + 3600000), openAt: new Date(), closeAt: new Date(Date.now() + 3600000), qrSecret: 'secret1' }
    });
    const sess2 = await adminPrisma.attendanceSession.create({
      data: { eventId: evt2.id, createdBy: otherUserId, title: 'Session 2', startTime: new Date(), endTime: new Date(Date.now() + 3600000), openAt: new Date(), closeAt: new Date(Date.now() + 3600000), qrSecret: 'secret2' }
    });

    await adminPrisma.attendanceDispute.create({
      data: { eventId: evt1.id, sessionId: sess1.id, userId, status: 'PENDING', reason: 'GPS failed', disputeWindowExpiresAt: new Date(Date.now() + 86400000) }
    });
    await adminPrisma.attendanceDispute.create({
      data: { eventId: evt2.id, sessionId: sess2.id, userId: otherUserId, status: 'PENDING', reason: 'Phone died', disputeWindowExpiresAt: new Date(Date.now() + 86400000) }
    });
    await adminPrisma.attendanceDispute.create({
      data: { eventId: evt2.id, sessionId: sess2.id, userId, status: 'REJECTED', reason: 'Late', disputeWindowExpiresAt: new Date(Date.now() + 86400000) }
    });

    const data = await adminAnalyticsService.getDisputeAnalytics(userId);

    const pending = data.breakdown.find((b: any) => b.status === 'PENDING');
    const rejected = data.breakdown.find((b: any) => b.status === 'REJECTED');
    
    assert.strictEqual(pending?.count, 1);
    assert.strictEqual(rejected?.count ?? 0, 0);
  });
});
