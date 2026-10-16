import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Team Registration Questionnaire Flow: Configuration, Validation, RLS & Persistence', () => {
  // Test entities
  const adminId = randomUUID();
  const leaderId = randomUUID();
  const memberId = randomUUID();
  const clubId = randomUUID();

  // Events
  const teamEventId = randomUUID();
  const emptyTeamEventId = randomUUID();
  const otherEventId = randomUUID();

  // Standalone scheduled form ID
  const scheduledFormId = randomUUID();

  // Field definition IDs
  const textDefId = randomUUID();
  const urlDefId = randomUUID();
  const numberDefId = randomUUID();
  const selectDefId = randomUUID();
  const multiSelectDefId = randomUUID();
  const otherEventFieldDefId = randomUUID();
  const scheduledFormFieldDefId = randomUUID();

  // JWT Tokens
  let leaderToken: string;
  let memberToken: string;
  let adminToken: string;

  let createdTeamId: string;
  let leaderRegistrationId: string;
  let memberRegistrationId: string;

  before(async () => {
    // 0. Initial Cleanup
    await adminPrisma.$executeRaw`DELETE FROM notifications;`;
    await adminPrisma.$executeRaw`DELETE FROM notification_jobs;`;
    await adminPrisma.$executeRaw`DELETE FROM field_definitions WHERE key IN ('github_handle', 'portfolio_url', 'years_experience', 'tshirt_size', 'tech_skills', 'other_question', 'feedback_rating');`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE email IN ('team_admin@test.com', 'team_leader@test.com', 'team_member@test.com') OR google_sub IN ('g_tadmin', 'g_tleader', 'g_tmember');`;

    // 1. Create Users
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role)
      VALUES 
        (${adminId}::uuid, 'team_admin@test.com', 'g_tadmin', 'Platform Admin', 'PLATFORM_ADMIN'),
        (${leaderId}::uuid, 'team_leader@test.com', 'g_tleader', 'Team Leader', 'STUDENT'),
        (${memberId}::uuid, 'team_member@test.com', 'g_tmember', 'Team Member', 'STUDENT');
    `;

    // 2. Create Club
    await adminPrisma.$executeRaw`
      INSERT INTO clubs (id, name, description, status)
      VALUES (${clubId}::uuid, 'Team Hack Club', 'Hackathon Club', 'ACTIVE');
    `;

    // 3. Create Team Events
    // Team Event with min 2, max 4 members
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, state, visibility, audience, start_time, end_time, registration_start_time, registration_end_time, created_by, event_type, registration_type, metadata)
      VALUES (${teamEventId}::uuid, 'Hackathon 2026', 'PUBLISHED', 'PUBLIC', 'ALL_STUDENTS', now(), now() + interval '2 days', now() - interval '1 hour', now() + interval '2 days', ${adminId}::uuid, 'HACKATHON', 'TEAM', '{"minimum_team_size": 2, "maximum_team_size": 4}'::jsonb);
    `;
    await adminPrisma.$executeRaw`
      INSERT INTO event_clubs (event_id, club_id, is_primary)
      VALUES (${teamEventId}::uuid, ${clubId}::uuid, true);
    `;

    // Team Event with NO questionnaire
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, state, visibility, audience, start_time, end_time, registration_start_time, registration_end_time, created_by, event_type, registration_type, metadata)
      VALUES (${emptyTeamEventId}::uuid, 'Open Team Event', 'PUBLISHED', 'PUBLIC', 'ALL_STUDENTS', now(), now() + interval '2 days', now() - interval '1 hour', now() + interval '2 days', ${adminId}::uuid, 'HACKATHON', 'TEAM', '{"minimum_team_size": 1, "maximum_team_size": 3}'::jsonb);
    `;
    await adminPrisma.$executeRaw`
      INSERT INTO event_clubs (event_id, club_id, is_primary)
      VALUES (${emptyTeamEventId}::uuid, ${clubId}::uuid, true);
    `;

    // Other Event
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, state, visibility, audience, start_time, end_time, registration_start_time, registration_end_time, created_by, event_type, registration_type)
      VALUES (${otherEventId}::uuid, 'Unrelated Event', 'PUBLISHED', 'PUBLIC', 'ALL_STUDENTS', now(), now() + interval '2 days', now() - interval '1 hour', now() + interval '2 days', ${adminId}::uuid, 'WORKSHOP', 'INDIVIDUAL');
    `;

    // 4. Create Field Definitions
    await adminPrisma.$executeRaw`
      INSERT INTO field_definitions (id, key, label, field_type, is_reusable, options)
      VALUES 
        (${textDefId}::uuid, 'github_handle', 'GitHub Handle', 'TEXT', false, NULL),
        (${urlDefId}::uuid, 'portfolio_url', 'Portfolio URL', 'URL', true, NULL),
        (${numberDefId}::uuid, 'years_experience', 'Years of Experience', 'NUMBER', false, NULL),
        (${selectDefId}::uuid, 'tshirt_size', 'T-Shirt Size', 'SELECT', true, '["S", "M", "L", "XL"]'::jsonb),
        (${multiSelectDefId}::uuid, 'tech_skills', 'Tech Skills', 'MULTI_SELECT', false, '["React", "Node", "PostgreSQL", "Go"]'::jsonb),
        (${otherEventFieldDefId}::uuid, 'other_question', 'Other Event Question', 'TEXT', false, NULL),
        (${scheduledFormFieldDefId}::uuid, 'feedback_rating', 'Feedback Rating', 'NUMBER', false, NULL);
    `;

    // Attach question to other event
    await adminPrisma.$executeRaw`
      INSERT INTO event_form_fields (id, event_id, field_definition_id, is_required, "order", form_id)
      VALUES (gen_random_uuid(), ${otherEventId}::uuid, ${otherEventFieldDefId}::uuid, true, 1, NULL);
    `;

    // 5. Create Standalone Scheduled Form on teamEventId
    await adminPrisma.$executeRaw`
      INSERT INTO event_forms (id, event_id, title, purpose, release_at, close_at, published_at)
      VALUES (${scheduledFormId}::uuid, ${teamEventId}::uuid, 'In-Event Checkin Survey', 'FEEDBACK', now(), now() + interval '1 day', now());
    `;
    await adminPrisma.$executeRaw`
      INSERT INTO event_form_fields (id, event_id, field_definition_id, is_required, "order", form_id)
      VALUES (gen_random_uuid(), ${teamEventId}::uuid, ${scheduledFormFieldDefId}::uuid, true, 1, ${scheduledFormId}::uuid);
    `;

    leaderToken = signJwt(leaderId);
    memberToken = signJwt(memberId);
    adminToken = signJwt(adminId);
  });

  after(async () => {
    await adminPrisma.$executeRaw`DELETE FROM notifications;`;
    await adminPrisma.$executeRaw`DELETE FROM notification_jobs;`;
    await adminPrisma.$executeRaw`DELETE FROM event_registration_responses WHERE event_registration_id IN (SELECT id FROM event_registrations WHERE event_id IN (${teamEventId}::uuid, ${emptyTeamEventId}::uuid, ${otherEventId}::uuid));`;
    await adminPrisma.$executeRaw`DELETE FROM event_registrations WHERE event_id IN (${teamEventId}::uuid, ${emptyTeamEventId}::uuid, ${otherEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM teams WHERE event_id IN (${teamEventId}::uuid, ${emptyTeamEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_form_fields WHERE event_id IN (${teamEventId}::uuid, ${emptyTeamEventId}::uuid, ${otherEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_forms WHERE event_id IN (${teamEventId}::uuid, ${emptyTeamEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM student_profile_values WHERE field_definition_id IN (${textDefId}::uuid, ${urlDefId}::uuid, ${numberDefId}::uuid, ${selectDefId}::uuid, ${multiSelectDefId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM field_definitions WHERE id IN (${textDefId}::uuid, ${urlDefId}::uuid, ${numberDefId}::uuid, ${selectDefId}::uuid, ${multiSelectDefId}::uuid, ${otherEventFieldDefId}::uuid, ${scheduledFormFieldDefId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_clubs WHERE event_id IN (${teamEventId}::uuid, ${emptyTeamEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM events WHERE id IN (${teamEventId}::uuid, ${emptyTeamEventId}::uuid, ${otherEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM clubs WHERE id = ${clubId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id IN (${adminId}::uuid, ${leaderId}::uuid, ${memberId}::uuid);`;
  });

  it('1. Configures registration questions via batch PUT and verifies scheduled forms do not appear as registration questions', async () => {
    const configRes = await request(app)
      .put(`/v1/events/${teamEventId}/form-fields`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fields: [
          { fieldDefinitionId: textDefId, isRequired: true, order: 1 },
          { fieldDefinitionId: urlDefId, isRequired: false, order: 2 },
          { fieldDefinitionId: numberDefId, isRequired: true, order: 3 },
          { fieldDefinitionId: selectDefId, isRequired: true, order: 4 },
          { fieldDefinitionId: multiSelectDefId, isRequired: true, order: 5 },
        ]
      });

    assert.strictEqual(configRes.status, 200);
    assert.strictEqual(configRes.body.data.length, 5);

    // Call GET /v1/events/:id/form-fields as student
    const getRes = await request(app)
      .get(`/v1/events/${teamEventId}/form-fields`)
      .set('Authorization', `Bearer ${leaderToken}`);

    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.data.length, 5);

    // Ensure order is 1, 2, 3, 4, 5
    const returnedIds = getRes.body.data.map((f: any) => f.fieldDefinitionId);
    assert.deepStrictEqual(returnedIds, [textDefId, urlDefId, numberDefId, selectDefId, multiSelectDefId]);

    // Ensure scheduled form field (scheduledFormFieldDefId) is NOT included in registration questions
    assert.strictEqual(returnedIds.includes(scheduledFormFieldDefId), false);

    // Verify field definition metadata returned
    const selectField = getRes.body.data.find((f: any) => f.fieldDefinitionId === selectDefId);
    assert.strictEqual(selectField.isRequired, true);
    assert.deepStrictEqual(selectField.fieldDefinition.options, ['S', 'M', 'L', 'XL']);
  });

  it('2. Blocks team creation when required questionnaire fields are missing', async () => {
    const res = await request(app)
      .post(`/v1/events/${teamEventId}/teams`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({
        team_name: 'Incomplete Squad',
        responses: [
          { fieldDefinitionId: textDefId, value: 'octocat' }
          // Missing numberDefId, selectDefId, multiSelectDefId
        ]
      });

    assert.strictEqual(res.status, 400);
    const errorMsg = res.body.detail || res.body.message || '';
    assert.match(errorMsg, /Missing required registration fields/i);

    // Verify team was not created in database
    const team = await adminPrisma.team.findFirst({ where: { name: 'Incomplete Squad' } });
    assert.strictEqual(team, null);
  });

  it('3. Blocks team creation when responses fail format validation', async () => {
    const res = await request(app)
      .post(`/v1/events/${teamEventId}/teams`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({
        team_name: 'Invalid Data Squad',
        responses: [
          { fieldDefinitionId: textDefId, value: 'octocat' },
          { fieldDefinitionId: urlDefId, value: 'not-a-valid-url' }, // Invalid URL
          { fieldDefinitionId: numberDefId, value: 'five' }, // Invalid Number
          { fieldDefinitionId: selectDefId, value: 'XXXL' }, // Invalid Option
          { fieldDefinitionId: multiSelectDefId, value: '["InvalidSkill"]' } // Invalid multi-select
        ]
      });

    assert.strictEqual(res.status, 400);

    const team = await adminPrisma.team.findFirst({ where: { name: 'Invalid Data Squad' } });
    assert.strictEqual(team, null);
  });

  it('4. Blocks team creation when answers belong to another event', async () => {
    const res = await request(app)
      .post(`/v1/events/${teamEventId}/teams`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({
        team_name: 'Foreign Field Squad',
        responses: [
          { fieldDefinitionId: textDefId, value: 'octocat' },
          { fieldDefinitionId: urlDefId, value: 'https://github.com/octocat' },
          { fieldDefinitionId: numberDefId, value: '3' },
          { fieldDefinitionId: selectDefId, value: 'L' },
          { fieldDefinitionId: multiSelectDefId, value: '["React", "Node"]' },
          { fieldDefinitionId: otherEventFieldDefId, value: 'Hacking other event' } // Field from other event
        ]
      });

    assert.strictEqual(res.status, 400);
    const errorMsg = res.body.detail || res.body.message || '';
    assert.match(errorMsg, /not part of this event's registration form/i);
  });

  it('5. Successfully creates team, saves answers in event_registration_responses, and syncs reusable profile values', async () => {
    const res = await request(app)
      .post(`/v1/events/${teamEventId}/teams`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({
        team_name: 'Cyber Warriors',
        responses: [
          { fieldDefinitionId: textDefId, value: 'cyber_lead' },
          { fieldDefinitionId: urlDefId, value: 'https://cyberwarriors.dev' },
          { fieldDefinitionId: numberDefId, value: '4' },
          { fieldDefinitionId: selectDefId, value: 'XL' },
          { fieldDefinitionId: multiSelectDefId, value: '["React", "PostgreSQL"]' }
        ]
      });

    if (res.status !== 201) {
      console.error('TEST 5 UNEXPECTED STATUS:', res.status, res.body);
    }
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.team_id);
    assert.strictEqual(res.body.name, 'Cyber Warriors');
    assert.strictEqual(res.body.status, 'FORMING');
    assert.ok(res.body.registration_id);

    createdTeamId = res.body.team_id;
    leaderRegistrationId = res.body.registration_id;

    // Verify responses stored in event_registration_responses
    const savedResponses = await adminPrisma.eventRegistrationResponse.findMany({
      where: { eventRegistrationId: leaderRegistrationId }
    });
    assert.strictEqual(savedResponses.length, 5);

    const textResp = savedResponses.find(r => r.fieldDefinitionId === textDefId);
    assert.strictEqual(textResp?.value, 'cyber_lead');
    assert.strictEqual(textResp?.formId, null);

    const urlResp = savedResponses.find(r => r.fieldDefinitionId === urlDefId);
    assert.strictEqual(urlResp?.value, 'https://cyberwarriors.dev');

    // Verify reusable fields synced to student_profile_values for leader
    const profileValues = await adminPrisma.studentProfileValue.findMany({
      where: { userId: leaderId }
    });
    const profileUrl = profileValues.find(p => p.fieldDefinitionId === urlDefId);
    assert.strictEqual(profileUrl?.value, 'https://cyberwarriors.dev');
    const profileTshirt = profileValues.find(p => p.fieldDefinitionId === selectDefId);
    assert.strictEqual(profileTshirt?.value, 'XL');

    // Non-reusable fields should NOT be in student_profile_values
    const profileText = profileValues.find(p => p.fieldDefinitionId === textDefId);
    assert.strictEqual(profileText, undefined);
  });

  it('6. Blocks member from joining team without completing required registration questionnaire', async () => {
    const res = await request(app)
      .post(`/v1/teams/${createdTeamId}/join`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        responses: []
      });

    const errorMsg = res.body.detail || res.body.message || '';
    assert.match(errorMsg, /Missing required registration fields/i);
  });

  it('7. Successfully joins team with valid responses, persists member answers separately, and transitions team to REGISTERED', async () => {
    const res = await request(app)
      .post(`/v1/teams/${createdTeamId}/join`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        responses: [
          { fieldDefinitionId: textDefId, value: 'member_ninja' },
          { fieldDefinitionId: urlDefId, value: 'https://ninja.portfolio.com' },
          { fieldDefinitionId: numberDefId, value: '2' },
          { fieldDefinitionId: selectDefId, value: 'M' },
          { fieldDefinitionId: multiSelectDefId, value: '["Node", "Go"]' }
        ]
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'REGISTERED'); // min size 2 reached
    assert.ok(res.body.registration_id);

    memberRegistrationId = res.body.registration_id;

    // Verify member responses saved separately in event_registration_responses
    const memberResponses = await adminPrisma.eventRegistrationResponse.findMany({
      where: { eventRegistrationId: memberRegistrationId }
    });
    assert.strictEqual(memberResponses.length, 5);

    const memberTextResp = memberResponses.find(r => r.fieldDefinitionId === textDefId);
    assert.strictEqual(memberTextResp?.value, 'member_ninja');

    const memberSizeResp = memberResponses.find(r => r.fieldDefinitionId === selectDefId);
    assert.strictEqual(memberSizeResp?.value, 'M');

    // Verify leader responses were NOT overwritten
    const leaderResponses = await adminPrisma.eventRegistrationResponse.findMany({
      where: { eventRegistrationId: leaderRegistrationId }
    });
    const leaderSizeResp = leaderResponses.find(r => r.fieldDefinitionId === selectDefId);
    assert.strictEqual(leaderSizeResp?.value, 'XL');

    // Verify member reusable profile values synced
    const memberProfileValues = await adminPrisma.studentProfileValue.findMany({
      where: { userId: memberId }
    });
    const memberProfileTshirt = memberProfileValues.find(p => p.fieldDefinitionId === selectDefId);
    assert.strictEqual(memberProfileTshirt?.value, 'M');
  });

  it('8. Supports team registration without answers when no questionnaire is configured', async () => {
    // Leader creates team on event with no questionnaire
    const createRes = await request(app)
      .post(`/v1/events/${emptyTeamEventId}/teams`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({
        team_name: 'No Form Squad'
      });

    assert.strictEqual(createRes.status, 201);
    assert.ok(createRes.body.team_id);
    const noFormTeamId = createRes.body.team_id;

    // Member joins team on event with no questionnaire
    const joinRes = await request(app)
      .post(`/v1/teams/${noFormTeamId}/join`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({});

    assert.strictEqual(joinRes.status, 201);
    assert.ok(joinRes.body.registration_id);
  });

  it('9. Rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post(`/v1/events/${teamEventId}/teams`)
      .send({ team_name: 'Anon Squad' });

    assert.strictEqual(res.status, 401);
  });
});
