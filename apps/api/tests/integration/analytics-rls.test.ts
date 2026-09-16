import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';

describe('Analytics RLS Simulation: Collaborator vs Primary Club', () => {
  let primaryAdminId: string;
  let collabAdminId: string;
  let primaryClubId: string;
  let collabClubId: string;
  let eventId: string;

  before(async () => {
    // 1. Create Users
    const pAdmin = await adminPrisma.user.create({
      data: {
        email: `primary_admin_${Date.now()}@test.com`,
        fullName: 'Primary Admin',
        globalRole: 'STUDENT',
        googleSub: `sub_p_${Date.now()}`
      }
    });
    primaryAdminId = pAdmin.id;

    const cAdmin = await adminPrisma.user.create({
      data: {
        email: `collab_admin_${Date.now()}@test.com`,
        fullName: 'Collab Admin',
        globalRole: 'STUDENT',
        googleSub: `sub_c_${Date.now()}`
      }
    });
    collabAdminId = cAdmin.id;

    // 2. Create Clubs & Memberships
    const pClub = await adminPrisma.club.create({ data: { name: `Primary Club ${Date.now()}` } });
    primaryClubId = pClub.id;
    await adminPrisma.clubMembership.create({
      data: { userId: primaryAdminId, clubId: primaryClubId, role: 'CLUB_ADMIN' }
    });

    const cClub = await adminPrisma.club.create({ data: { name: `Collab Club ${Date.now()}` } });
    collabClubId = cClub.id;
    await adminPrisma.clubMembership.create({
      data: { userId: collabAdminId, clubId: collabClubId, role: 'CLUB_ADMIN' }
    });

    // 3. Create Event & EventClubs
    const evt = await adminPrisma.event.create({
      data: {
        title: `Analytics Test Event ${Date.now()}`,
        state: 'DRAFT',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        maxCapacity: 100,
        eventType: 'WORKSHOP',
        createdBy: primaryAdminId
      }
    });
    eventId = evt.id;

    await adminPrisma.eventClub.create({
      data: { eventId, clubId: primaryClubId, isPrimary: true }
    });
    await adminPrisma.eventClub.create({
      data: { eventId, clubId: collabClubId, isPrimary: false }
    });
  });

  after(async () => {
    await adminPrisma.eventClub.deleteMany({ where: { eventId } });
    await adminPrisma.event.delete({ where: { id: eventId } });
    await adminPrisma.clubMembership.deleteMany({
      where: { userId: { in: [primaryAdminId, collabAdminId] } }
    });
    await adminPrisma.club.deleteMany({
      where: { id: { in: [primaryClubId, collabClubId] } }
    });
    await adminPrisma.user.deleteMany({
      where: { id: { in: [primaryAdminId, collabAdminId] } }
    });
  });

  it('RLS Simulation: Primary CLUB_ADMIN should have access to event analytics', async () => {
    // We simulate the RLS policy for events
    // EXISTS (SELECT 1 FROM event_clubs ec WHERE ec.event_id = events.id AND ec.is_primary = true AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN']))
    const result = await adminPrisma.$queryRaw<Array<{ event_id: string }>>`
      SELECT id as event_id 
      FROM events e 
      WHERE e.id = ${eventId}::uuid
      AND EXISTS (
        SELECT 1 FROM event_clubs ec 
        WHERE ec.event_id = e.id 
        AND ec.is_primary = true 
        AND has_club_role(ec.club_id, ${primaryAdminId}::uuid, ARRAY['CLUB_ADMIN']::text[])
      )
    `;
    assert.strictEqual(result.length, 1, 'Primary club admin should see the event');
  });

  it('RLS Simulation: Collaborator CLUB_ADMIN should NOT have access to event analytics due to is_primary = true', async () => {
    const result = await adminPrisma.$queryRaw<Array<{ event_id: string }>>`
      SELECT id as event_id 
      FROM events e 
      WHERE e.id = ${eventId}::uuid
      AND EXISTS (
        SELECT 1 FROM event_clubs ec 
        WHERE ec.event_id = e.id 
        AND ec.is_primary = true 
        AND has_club_role(ec.club_id, ${collabAdminId}::uuid, ARRAY['CLUB_ADMIN']::text[])
      )
    `;
    assert.strictEqual(result.length, 0, 'Collaborator club admin should NOT see the event (is_primary guards this)');
  });
});
