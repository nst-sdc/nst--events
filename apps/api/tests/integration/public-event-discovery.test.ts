import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import {
  createEvent,
  updateEvent,
  approveEvent,
  listPublicEvents,
  getPublicEventBySlug,
  validateSlugAvailability,
} from '../../src/modules/events/events.service';
import { registerEvent } from '../../src/modules/registrations/registrations.service';
import { ForbiddenError, UnauthorizedError, NotFoundError, UnprocessableEntityError } from '../../src/lib/errors';

describe('Public Event Discovery and Slugs Integration', () => {
  let mentorId: string;
  let organizerId: string;
  let institutionalStudentId: string;
  let nonInstitutionalStudentId: string;
  let clubId: string;

  let publicEventId: string;
  let publicEventSlug: string;
  let unlistedEventId: string;
  let unlistedEventSlug: string;
  let restrictedEventId: string;
  let restrictedEventSlug: string;

  before(async () => {
    // 1. Create mentor and organizer
    const mentor = await adminPrisma.user.create({
      data: {
        email: `mentor_${Date.now()}@adypu.edu.in`,
        googleSub: `sub_mentor_${Date.now()}`,
        fullName: 'Test Faculty Mentor',
        globalRole: 'FACULTY_ADMIN',
      },
    });
    mentorId = mentor.id;

    const org = await adminPrisma.user.create({
      data: {
        email: `organizer_${Date.now()}@adypu.edu.in`,
        googleSub: `sub_org_${Date.now()}`,
        fullName: 'Test Organizer',
      },
    });
    organizerId = org.id;

    const instStudent = await adminPrisma.user.create({
      data: {
        email: `inst_student_${Date.now()}@adypu.edu.in`,
        googleSub: `sub_inst_${Date.now()}`,
        fullName: 'Institutional Student',
      },
    });
    institutionalStudentId = instStudent.id;

    const nonInstStudent = await adminPrisma.user.create({
      data: {
        email: `external_user_${Date.now()}@gmail.com`,
        googleSub: `sub_ext_${Date.now()}`,
        fullName: 'External Student',
      },
    });
    nonInstitutionalStudentId = nonInstStudent.id;

    const club = await adminPrisma.club.create({
      data: { name: `Public Discovery Test Club ${Date.now()}` },
    });
    clubId = club.id;

    await adminPrisma.clubMembership.create({
      data: { userId: organizerId, clubId, role: 'CLUB_ADMIN' },
    });
    await adminPrisma.clubMembership.create({
      data: { userId: mentorId, clubId, role: 'FACULTY_MENTOR' },
    });
  });

  after(async () => {
    await adminPrisma.eventSlugHistory.deleteMany({
      where: {
        eventId: { in: [publicEventId, unlistedEventId, restrictedEventId].filter(Boolean) },
      },
    });
    await adminPrisma.eventRegistration.deleteMany({
      where: {
        eventId: { in: [publicEventId, unlistedEventId, restrictedEventId].filter(Boolean) },
      },
    });
    await adminPrisma.$executeRaw`DELETE FROM notification_jobs;`;
    await adminPrisma.notification.deleteMany({
      where: {
        userId: {
          in: [mentorId, organizerId, institutionalStudentId, nonInstitutionalStudentId].filter(Boolean),
        },
      },
    });
    await adminPrisma.eventClub.deleteMany({ where: { clubId } });
    await adminPrisma.event.deleteMany({ where: { createdBy: organizerId } });
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });
    await adminPrisma.user.deleteMany({
      where: {
        id: {
          in: [mentorId, organizerId, institutionalStudentId, nonInstitutionalStudentId].filter(Boolean),
        },
      },
    });
  });

  it('slug validator rejects reserved words, invalid formats, and detects collisions', async () => {
    const reserved = await validateSlugAvailability('admin');
    assert.strictEqual(reserved.valid, false);
    assert.strictEqual(reserved.available, false);

    const malformed = await validateSlugAvailability('bad slug with spaces!!');
    assert.strictEqual(malformed.valid, false);

    const valid = await validateSlugAvailability('my-awesome-workshop-2026');
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.available, true);
    assert.strictEqual(valid.normalized_slug, 'my-awesome-workshop-2026');
  });

  it('creates events with explicit visibility and generated slugs', async () => {
    const pubEvent = await createEvent(organizerId, {
      title: 'Public Open Hackathon',
      description: 'An open hackathon for everyone to discover',
      start_time: new Date(Date.now() + 86400000), // tomorrow
      end_time: new Date(Date.now() + 86400000 + 7200000),
      registration_start_time: new Date(Date.now() - 3600000),
      registration_end_time: new Date(Date.now() + 86400000),
      event_type: 'HACKATHON',
      visibility: 'PUBLIC',
      registration_type: 'INDIVIDUAL',
      attendance_type: 'SINGLE',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    publicEventId = pubEvent.id;
    assert.ok(pubEvent.slug);
    assert.match(pubEvent.slug!, /public-open-hackathon/);
    publicEventSlug = pubEvent.slug!;

    // Create Unlisted event
    const unlisted = await createEvent(organizerId, {
      title: 'Secret Unlisted Meetup',
      description: 'Only accessible via direct link',
      start_time: new Date(Date.now() + 86400000),
      end_time: new Date(Date.now() + 86400000 + 7200000),
      event_type: 'MEETUP',
      visibility: 'UNLISTED',
      registration_type: 'INDIVIDUAL',
      attendance_type: 'SINGLE',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    unlistedEventId = unlisted.id;
    unlistedEventSlug = unlisted.slug!;

    // Create Restricted event
    const restricted = await createEvent(organizerId, {
      title: 'Internal Restricted Assembly',
      description: 'Only institutional members may view',
      start_time: new Date(Date.now() + 86400000),
      end_time: new Date(Date.now() + 86400000 + 7200000),
      event_type: 'WORKSHOP',
      visibility: 'RESTRICTED',
      registration_type: 'INDIVIDUAL',
      attendance_type: 'SINGLE',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    restrictedEventId = restricted.id;
    restrictedEventSlug = restricted.slug!;

    // Move all to PENDING_APPROVAL and approve them
    await adminPrisma.event.updateMany({
      where: { id: { in: [publicEventId, unlistedEventId, restrictedEventId] } },
      data: { state: 'PENDING_APPROVAL' },
    });

    await approveEvent(mentorId, publicEventId);
    await approveEvent(mentorId, unlistedEventId);
    await approveEvent(mentorId, restrictedEventId);

    const verifiedPub = await adminPrisma.event.findUnique({ where: { id: publicEventId } });
    assert.strictEqual(verifiedPub?.state, 'PUBLISHED');
  });

  it('listPublicEvents only returns published PUBLIC events and excludes UNLISTED & RESTRICTED', async () => {
    const result = await listPublicEvents({ scope: 'upcoming', limit: 50 });
    const slugs = result.data.map((e) => e.slug);

    assert.ok(slugs.includes(publicEventSlug), 'Public event must appear in public listing');
    assert.ok(!slugs.includes(unlistedEventSlug), 'Unlisted event must NOT appear in public listing');
    assert.ok(!slugs.includes(restrictedEventSlug), 'Restricted event must NOT appear in public listing');

    // Verify response schema doesn't leak capacity or private fields
    const foundEvent = result.data.find((e) => e.slug === publicEventSlug);
    assert.ok(foundEvent);
    assert.strictEqual(typeof foundEvent?.title, 'string');
    assert.strictEqual((foundEvent as any).capacity, undefined);
    assert.strictEqual((foundEvent as any).eventRegistrations, undefined);
  });

  it('listPublicEvents supports category and full-text search', async () => {
    const searchMatch = await listPublicEvents({ q: 'Open Hackathon' });
    assert.ok(searchMatch.data.some((e) => e.slug === publicEventSlug));

    const categoryMatch = await listPublicEvents({ event_type: 'HACKATHON' });
    assert.ok(categoryMatch.data.some((e) => e.slug === publicEventSlug));

    const categoryMismatch = await listPublicEvents({ event_type: 'COMPETITION' });
    assert.ok(!categoryMismatch.data.some((e) => e.slug === publicEventSlug));
  });

  it('getPublicEventBySlug allows anonymous access for PUBLIC and UNLISTED events', async () => {
    const pub = await getPublicEventBySlug(publicEventSlug);
    assert.strictEqual(pub.redirect, undefined);
    assert.strictEqual(pub.title, 'Public Open Hackathon');

    const unlisted = await getPublicEventBySlug(unlistedEventSlug);
    assert.strictEqual(unlisted.redirect, undefined);
    assert.strictEqual(unlisted.title, 'Secret Unlisted Meetup');
  });

  it('getPublicEventBySlug protects RESTRICTED events with institutional auth', async () => {
    // Anonymous lookup throws NotFoundError or UnauthorizedError to prevent leakage
    await assert.rejects(
      async () => {
        await getPublicEventBySlug(restrictedEventSlug);
      },
      (err: any) => err instanceof UnauthorizedError || err instanceof NotFoundError
    );

    // Non-institutional lookup throws ForbiddenError
    await assert.rejects(
      async () => {
        await getPublicEventBySlug(restrictedEventSlug, nonInstitutionalStudentId);
      },
      (err: any) => err instanceof ForbiddenError
    );

    // Institutional lookup succeeds
    const restricted = await getPublicEventBySlug(restrictedEventSlug, institutionalStudentId);
    assert.strictEqual(restricted.title, 'Internal Restricted Assembly');
  });

  it('updating an event slug preserves historical slugs and returns permanent redirects', async () => {
    const oldSlug = publicEventSlug;
    const newDesiredSlug = `renamed-hackathon-${Date.now()}`;

    const updated = await updateEvent(organizerId, publicEventId, {
      slug: newDesiredSlug,
    });
    assert.strictEqual(updated.slug, newDesiredSlug);
    publicEventSlug = newDesiredSlug;

    // Verify historical slug table recorded old slug
    const historyEntry = await adminPrisma.eventSlugHistory.findUnique({
      where: { slug: oldSlug },
    });
    assert.ok(historyEntry);
    assert.strictEqual(historyEntry?.eventId, publicEventId);

    // Looking up the old slug returns a permanent direct redirect to the new canonical slug
    const redirectRes = await getPublicEventBySlug(oldSlug);
    assert.strictEqual(redirectRes.redirect, true);
    assert.strictEqual(redirectRes.canonical_slug, newDesiredSlug);
    assert.strictEqual(redirectRes.permanent, true);

    // Looking up the legacy UUID also redirects to the canonical slug
    const uuidRedirect = await getPublicEventBySlug(publicEventId);
    assert.strictEqual(uuidRedirect.redirect, true);
    assert.strictEqual(uuidRedirect.canonical_slug, newDesiredSlug);
  });

  it('registration requires verified institutional email', async () => {
    // Non-institutional account rejected
    await assert.rejects(
      async () => {
        await registerEvent(nonInstitutionalStudentId, publicEventId);
      },
      (err: any) => err instanceof ForbiddenError
    );

    // Institutional account allowed
    const regResult = await registerEvent(institutionalStudentId, publicEventId);
    assert.ok(regResult);
  });

  it('persists and validates registration window start and end dates', async () => {
    // 1. Verify publicEvent persisted registration dates
    const eventFromDb = await adminPrisma.event.findUnique({
      where: { id: publicEventId },
    });
    assert.ok(eventFromDb?.registrationStartTime);
    assert.ok(eventFromDb?.registrationEndTime);

    // 2. Reject update if registration_start_time >= registration_end_time
    await assert.rejects(
      async () => {
        await updateEvent(organizerId, publicEventId, {
          registration_start_time: new Date(Date.now() + 50000).toISOString(),
          registration_end_time: new Date(Date.now() + 10000).toISOString(),
        });
      },
      (err: any) => err instanceof UnprocessableEntityError
    );

    // 3. Reject update if registration_end_time > event end_time
    await assert.rejects(
      async () => {
        await updateEvent(organizerId, publicEventId, {
          registration_end_time: new Date(Date.now() + 100000000).toISOString(),
        });
      },
      (err: any) => err instanceof UnprocessableEntityError
    );

    // 4. Successfully update registration dates
    const newRegStart = new Date(Date.now() - 7200000).toISOString();
    const newRegEnd = new Date(Date.now() + 3600000).toISOString();
    const updated = await updateEvent(organizerId, publicEventId, {
      registration_start_time: newRegStart,
      registration_end_time: newRegEnd,
    });
    assert.strictEqual(new Date(updated.registrationStartTime).toISOString(), newRegStart);
    assert.strictEqual(new Date(updated.registrationEndTime).toISOString(), newRegEnd);
  });
});
