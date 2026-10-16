import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Client } from 'pg';
import { adminPrisma } from '../helpers/adminDb';
import {
  listPublicEvents,
  getPublicEventBySlug,
  updateEvent,
} from '../../src/modules/events/events.service';
import { NotFoundError } from '../../src/lib/errors';

describe('Public Event RLS & Anonymous Isolation Integration', () => {
  let appClient: Client;
  let organizerId: string;
  let studentId: string;
  let clubId: string;

  let pubEventId: string;
  let pubSlug: string;
  let pubSessionId: string;
  let pubFieldId: string;
  let pubRegId: string;
  let pubRespId: string;

  let unlistedEventId: string;
  let unlistedSlug: string;
  let unlistedSessionId: string;
  let unlistedFieldId: string;

  let restrictedEventId: string;
  let restrictedSlug: string;
  let restrictedSessionId: string;

  let draftEventId: string;
  let draftSlug: string;

  before(async () => {
    // 1. Connect application client using nst_app (which is subject to RLS)
    appClient = new Client({
      connectionString: 'postgresql://nst_app:nst_app_password@localhost:5440/nst_events?schema=public',
    });
    await appClient.connect();

    // 2. Create users and club via adminPrisma (superuser bypass)
    const timestamp = Date.now();
    const org = await adminPrisma.user.create({
      data: {
        email: `org_rls_${timestamp}@adypu.edu.in`,
        googleSub: `sub_org_rls_${timestamp}`,
        fullName: 'RLS Organizer',
        globalRole: 'STUDENT',
      },
    });
    organizerId = org.id;

    const student = await adminPrisma.user.create({
      data: {
        email: `student_rls_${timestamp}@adypu.edu.in`,
        googleSub: `sub_student_rls_${timestamp}`,
        fullName: 'RLS Student',
        globalRole: 'STUDENT',
      },
    });
    studentId = student.id;

    const club = await adminPrisma.club.create({
      data: { name: `RLS Verification Club ${timestamp}` },
    });
    clubId = club.id;

    await adminPrisma.clubMembership.create({
      data: { userId: organizerId, clubId, role: 'CLUB_ADMIN' },
    });

    // 3. Seed Published PUBLIC Event with attendance session, form fields, registration & response
    pubSlug = `rls-pub-event-${timestamp}`;
    const pubEvent = await adminPrisma.event.create({
      data: {
        title: 'Seeded Public Event',
        slug: pubSlug,
        description: 'Seeded public description',
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
    pubEventId = pubEvent.id;

    const sessionPub = await adminPrisma.attendanceSession.create({
      data: {
        eventId: pubEventId,
        title: 'Keynote Session',
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        openAt: new Date(Date.now() + 86400000),
        closeAt: new Date(Date.now() + 90000000),
        qrSecret: 'qr_secret_pub_123',
        createdBy: organizerId,
      },
    });
    pubSessionId = sessionPub.id;

    const fieldDef = await adminPrisma.fieldDefinition.create({
      data: {
        key: `tshirt_${timestamp}`,
        label: 'T-Shirt Size',
        fieldType: 'TEXT',
      },
    });

    const fieldPub = await adminPrisma.eventFormField.create({
      data: {
        eventId: pubEventId,
        fieldDefinitionId: fieldDef.id,
        order: 1,
        isRequired: true,
      },
    });
    pubFieldId = fieldPub.id;

    const regPub = await adminPrisma.eventRegistration.create({
      data: {
        eventId: pubEventId,
        userId: studentId,
        registrationStatus: 'REGISTERED',
      },
    });
    pubRegId = regPub.id;

    const respPub = await adminPrisma.eventRegistrationResponse.create({
      data: {
        eventRegistrationId: pubRegId,
        fieldDefinitionId: fieldDef.id,
        value: 'XL',
      },
    });
    pubRespId = respPub.id;

    // 4. Seed Published UNLISTED Event
    unlistedSlug = `rls-unlisted-event-${timestamp}`;
    const unlistedEvent = await adminPrisma.event.create({
      data: {
        title: 'Seeded Unlisted Event',
        slug: unlistedSlug,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        eventType: 'WORKSHOP',
        visibility: 'UNLISTED',
        state: 'PUBLISHED',
        createdBy: organizerId,
        eventClubs: { create: [{ clubId, isPrimary: true }] },
      },
    });
    unlistedEventId = unlistedEvent.id;

    const sessionUnlisted = await adminPrisma.attendanceSession.create({
      data: {
        eventId: unlistedEventId,
        title: 'Unlisted Secret Session',
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        openAt: new Date(Date.now() + 86400000),
        closeAt: new Date(Date.now() + 90000000),
        qrSecret: 'qr_secret_unlisted_123',
        createdBy: organizerId,
      },
    });
    unlistedSessionId = sessionUnlisted.id;

    const fieldUnlisted = await adminPrisma.eventFormField.create({
      data: {
        eventId: unlistedEventId,
        fieldDefinitionId: fieldDef.id,
        order: 1,
        isRequired: false,
      },
    });
    unlistedFieldId = fieldUnlisted.id;

    // 5. Seed Published RESTRICTED Event
    restrictedSlug = `rls-restricted-event-${timestamp}`;
    const restrictedEvent = await adminPrisma.event.create({
      data: {
        title: 'Seeded Restricted Event',
        slug: restrictedSlug,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        eventType: 'SEMINAR',
        visibility: 'RESTRICTED',
        state: 'PUBLISHED',
        createdBy: organizerId,
        eventClubs: { create: [{ clubId, isPrimary: true }] },
      },
    });
    restrictedEventId = restrictedEvent.id;

    const sessionRestricted = await adminPrisma.attendanceSession.create({
      data: {
        eventId: restrictedEventId,
        title: 'Restricted Internal Session',
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        openAt: new Date(Date.now() + 86400000),
        closeAt: new Date(Date.now() + 90000000),
        qrSecret: 'qr_secret_restricted_123',
        createdBy: organizerId,
      },
    });
    restrictedSessionId = sessionRestricted.id;

    // 6. Seed DRAFT Event
    draftSlug = `rls-draft-event-${timestamp}`;
    const draftEvent = await adminPrisma.event.create({
      data: {
        title: 'Seeded Draft Event',
        slug: draftSlug,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        eventType: 'SEMINAR',
        visibility: 'PUBLIC',
        state: 'DRAFT',
        createdBy: organizerId,
        eventClubs: { create: [{ clubId, isPrimary: true }] },
      },
    });
    draftEventId = draftEvent.id;
  });

  after(async () => {
    if (appClient) await appClient.end();

    // Clean up test data
    const eventIds = [pubEventId, unlistedEventId, restrictedEventId, draftEventId].filter(Boolean);
    await adminPrisma.eventRegistrationResponse.deleteMany({
      where: { eventRegistrationId: pubRegId },
    });
    await adminPrisma.eventRegistration.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await adminPrisma.attendanceSession.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await adminPrisma.eventFormField.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await adminPrisma.eventClub.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await adminPrisma.event.deleteMany({
      where: { id: { in: eventIds } },
    });
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });
    await adminPrisma.user.deleteMany({
      where: { id: { in: [organizerId, studentId].filter(Boolean) } },
    });
  });

  it('proves fixtures exist via adminPrisma before testing RLS isolation', async () => {
    const adminEvents = await adminPrisma.event.findMany({
      where: { id: { in: [pubEventId, unlistedEventId, restrictedEventId, draftEventId] } },
    });
    assert.strictEqual(adminEvents.length, 4, 'All 4 seeded event fixtures must exist in DB');

    const adminSessions = await adminPrisma.attendanceSession.findMany({
      where: { id: { in: [pubSessionId, unlistedSessionId, restrictedSessionId] } },
    });
    assert.strictEqual(adminSessions.length, 3, 'All 3 seeded attendance sessions must exist in DB');

    const adminFields = await adminPrisma.eventFormField.findMany({
      where: { id: { in: [pubFieldId, unlistedFieldId] } },
    });
    assert.strictEqual(adminFields.length, 2, 'All 2 seeded event form fields must exist in DB');
  });

  it('anonymous database caller cannot see RESTRICTED or DRAFT events via RLS', async () => {
    // Reset RLS session to anonymous
    await appClient.query("SELECT set_config('app.user_id', '', false);");

    const res = await appClient.query(
      'SELECT id, title, visibility, state FROM events WHERE id = ANY($1::uuid[]) ORDER BY title ASC;',
      [[pubEventId, unlistedEventId, restrictedEventId, draftEventId]]
    );

    // Only PUBLISHED PUBLIC and PUBLISHED UNLISTED should be visible
    const visibleIds = res.rows.map((r: any) => r.id);
    assert.ok(visibleIds.includes(pubEventId), 'Public published event must be selectable');
    assert.ok(visibleIds.includes(unlistedEventId), 'Unlisted published event must be selectable');
    assert.strictEqual(visibleIds.includes(restrictedEventId), false, 'Restricted event MUST be blocked by RLS');
    assert.strictEqual(visibleIds.includes(draftEventId), false, 'Draft event MUST be blocked by RLS');
    assert.strictEqual(res.rows.length, 2);
  });

  it('anonymous database caller cannot read attendance_sessions, event_form_fields, registrations, or responses', async () => {
    // Reset RLS session to anonymous
    await appClient.query("SELECT set_config('app.user_id', '', false);");

    // 1. Attendance Sessions
    const sessionsRes = await appClient.query(
      'SELECT id FROM attendance_sessions WHERE id = ANY($1::uuid[]);',
      [[pubSessionId, unlistedSessionId, restrictedSessionId]]
    );
    assert.strictEqual(sessionsRes.rows.length, 0, 'Anonymous users must receive 0 attendance sessions');

    // 2. Event Form Fields
    const fieldsRes = await appClient.query(
      'SELECT id FROM event_form_fields WHERE id = ANY($1::uuid[]);',
      [[pubFieldId, unlistedFieldId]]
    );
    assert.strictEqual(fieldsRes.rows.length, 0, 'Anonymous users must receive 0 event form fields');

    // 3. Event Registrations
    const regRes = await appClient.query(
      'SELECT id FROM event_registrations WHERE id = $1::uuid;',
      [pubRegId]
    );
    assert.strictEqual(regRes.rows.length, 0, 'Anonymous users must receive 0 event registrations');

    // 4. Registration Responses
    const respRes = await appClient.query(
      'SELECT id FROM event_registration_responses WHERE id = $1::uuid;',
      [pubRespId]
    );
    assert.strictEqual(respRes.rows.length, 0, 'Anonymous users must receive 0 registration responses');
  });

  it('authenticated student can read permitted sessions, form fields, and their own registration', async () => {
    // Set RLS session to student
    await appClient.query("SELECT set_config('app.user_id', $1, false);", [studentId]);

    // Student can read attendance session of published event
    const sessionsRes = await appClient.query(
      'SELECT id FROM attendance_sessions WHERE id = $1::uuid;',
      [pubSessionId]
    );
    assert.strictEqual(sessionsRes.rows.length, 1, 'Authenticated student must see published event session');

    // Student can read form fields of published event
    const fieldsRes = await appClient.query(
      'SELECT id FROM event_form_fields WHERE id = $1::uuid;',
      [pubFieldId]
    );
    assert.strictEqual(fieldsRes.rows.length, 1, 'Authenticated student must see form fields of published event');

    // Student can read their own registration
    const regRes = await appClient.query(
      'SELECT id FROM event_registrations WHERE id = $1::uuid;',
      [pubRegId]
    );
    assert.strictEqual(regRes.rows.length, 1, 'Student must see their own registration');

    // Student can read their own response
    const respRes = await appClient.query(
      'SELECT id FROM event_registration_responses WHERE id = $1::uuid;',
      [pubRespId]
    );
    assert.strictEqual(respRes.rows.length, 1, 'Student must see their own responses');
  });

  it('public discovery API excludes UNLISTED, RESTRICTED, and DRAFT events', async () => {
    const discovery = await listPublicEvents({ limit: 50 });
    const discoveredIds = discovery.data.map((e) => e.id);

    assert.ok(discoveredIds.includes(pubEventId), 'PUBLIC event must be in discovery list');
    assert.strictEqual(discoveredIds.includes(unlistedEventId), false, 'UNLISTED event must NOT appear in discovery list');
    assert.strictEqual(discoveredIds.includes(restrictedEventId), false, 'RESTRICTED event must NOT appear in discovery list');
    assert.strictEqual(discoveredIds.includes(draftEventId), false, 'DRAFT event must NOT appear in discovery list');
  });

  it('direct slug retrieval allows PUBLIC and UNLISTED, but returns 404 for RESTRICTED and DRAFT to anonymous callers', async () => {
    // 1. PUBLIC by slug
    const pubRes = await getPublicEventBySlug(pubSlug);
    assert.strictEqual(pubRes.title, 'Seeded Public Event');

    // 2. UNLISTED by slug
    const unlistedRes = await getPublicEventBySlug(unlistedSlug);
    assert.strictEqual(unlistedRes.title, 'Seeded Unlisted Event');

    // 3. RESTRICTED by slug: anonymous caller receives clean 404
    await assert.rejects(
      async () => {
        await getPublicEventBySlug(restrictedSlug);
      },
      (err: any) => err instanceof NotFoundError
    );

    // 4. DRAFT by slug: anonymous caller receives clean 404
    await assert.rejects(
      async () => {
        await getPublicEventBySlug(draftSlug);
      },
      (err: any) => err instanceof NotFoundError
    );
  });

  it('changing visibility to RESTRICTED immediately blocks anonymous discovery and direct slug access', async () => {
    // Change pubEvent visibility to RESTRICTED
    await updateEvent(organizerId, pubEventId, {
      visibility: 'RESTRICTED',
    });

    // 1. Immediately absent from public discovery
    const discovery = await listPublicEvents({ limit: 50 });
    const discoveredIds = discovery.data.map((e) => e.id);
    assert.strictEqual(discoveredIds.includes(pubEventId), false, 'Immediately removed from public discovery');

    // 2. Anonymous direct slug lookup immediately throws NotFoundError
    await assert.rejects(
      async () => {
        await getPublicEventBySlug(pubSlug);
      },
      (err: any) => err instanceof NotFoundError
    );

    // 3. Anonymous direct database query immediately yields 0 rows
    await appClient.query("SELECT set_config('app.user_id', '', false);");
    const rlsQuery = await appClient.query('SELECT id FROM events WHERE id = $1::uuid;', [pubEventId]);
    assert.strictEqual(rlsQuery.rows.length, 0, 'Database RLS immediately returns 0 rows');

    // Restore to PUBLIC
    await updateEvent(organizerId, pubEventId, {
      visibility: 'PUBLIC',
    });
  });
});
