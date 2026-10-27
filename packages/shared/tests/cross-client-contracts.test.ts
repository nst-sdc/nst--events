import { describe, it, expect } from 'vitest';
import {
  normalizePublicStudentProfile,
  toDetailedStudentProfile,
  toTransportModel,
  type PublicStudentProfileTransportDto,
  type PublicStudentProfileRedirectTransportDto,
  type EventListItem,
  type EventsResponse,
  type TeamsResponse,
  type ClubsResponse,
  type ClubListItem,
  type ClubDetail,
  type MyRegistrationResponse,
} from '../src/index';

describe('Cross-Client Integration & Shared DTO Contract Test Matrix', () => {
  describe('1. Student Public Profile Normalization (GET /v1/students/:slug)', () => {
    it('1.1: Canonical slug redirect response preserves redirect: true and canonical_slug', () => {
      const redirectPayload: PublicStudentProfileRedirectTransportDto = {
        redirect: true,
        canonical_slug: 'jane-doe-canonical',
      };

      const normalized = normalizePublicStudentProfile(redirectPayload);
      expect(normalized.redirect).toBe(true);
      expect(normalized.canonical_slug).toBe('jane-doe-canonical');
      expect(normalized.slug).toBe('jane-doe-canonical');
      expect(normalized.fullName).toBeNull();
      expect(normalized.projects).toEqual([]);
      expect(normalized.achievements).toEqual([]);
    });

    it('1.2: Normalizes snake_case server payload with full academic profile and external links', () => {
      const serverPayload: PublicStudentProfileTransportDto = {
        slug: 'john-smith',
        full_name: 'John Smith',
        avatar_url: 'https://cdn.nstsdc.org/avatars/john.jpg',
        headline: 'Lead Systems Architect',
        bio: 'Passionate about distributed systems',
        academic: {
          program: 'Computer Science and Engineering',
          program_code: 'CSE',
          graduation_year: 2027,
          admission_year: 2023,
        },
        skills: ['TypeScript', 'Rust', 'PostgreSQL'],
        interests: ['Distributed Systems', 'Cloud Native'],
        external_links: [
          { type: 'GITHUB', label: 'GitHub Profile', url: 'https://github.com/johnsmith' },
          { type: 'LINKEDIN', url: 'https://linkedin.com/in/johnsmith' },
        ],
        projects: [
          {
            id: 'proj-1',
            title: 'NST Events Monorepo',
            slug: 'nst-events',
            tagline: 'Campus lifecycle engine',
            description: 'Scalable events platform',
            cover_image_url: 'https://cdn.nstsdc.org/covers/nst.png',
            category: 'Systems',
            tags: ['React', 'Node'],
            is_owner: true,
            is_featured: true,
            like_count: 42,
            view_count: 128,
            published_at: '2026-09-01T00:00:00.000Z',
          },
        ],
        achievements: [
          {
            id: 'ach-1',
            award_title: '1st Place Hackathon',
            award_type: 'RANKED_PLACEMENT',
            placement: 1,
            is_team_award: true,
            team_name: 'Team Alpha',
            is_featured: true,
            published_at: '2026-10-15T00:00:00.000Z',
            event: {
              id: 'ev-1',
              title: 'Fall Hackathon 2026',
              slug: 'fall-hackathon-2026',
              start_time: '2026-10-14T00:00:00.000Z',
            },
          },
        ],
        clubs: [
          {
            club_id: 'club-1',
            club_name: 'Coding Club',
            role: 'CLUB_ADMIN',
            banner_url: 'https://cdn.nstsdc.org/banners/club.jpg',
            is_featured: true,
          },
        ],
      };

      const normalized = normalizePublicStudentProfile(serverPayload);
      expect(normalized.fullName).toBe('John Smith');
      expect(normalized.avatarUrl).toBe('https://cdn.nstsdc.org/avatars/john.jpg');
      expect(normalized.headline).toBe('Lead Systems Architect');
      expect(normalized.program).toBe('Computer Science and Engineering');
      expect(normalized.batch).toBe('2027');
      expect(normalized.skills).toEqual(['TypeScript', 'Rust', 'PostgreSQL']);
      expect(normalized.externalLinks.GITHUB).toBe('https://github.com/johnsmith');
      expect(normalized.externalLinks.LINKEDIN).toBe('https://linkedin.com/in/johnsmith');
      expect(normalized.projects.length).toBe(1);
      expect(normalized.projects[0].coverImageUrl).toBe('https://cdn.nstsdc.org/covers/nst.png');
      expect(normalized.achievements.length).toBe(1);
      expect(normalized.achievements[0].awardTitle).toBe('1st Place Hackathon');
      expect(normalized.clubs.length).toBe(1);
      expect(normalized.clubs[0].role).toBe('CLUB_ADMIN');
    });

    it('1.3: Gracefully handles missing, partial, or null fields without throwing', () => {
      const minimalPayload = {
        slug: 'minimal-user',
        full_name: null,
        avatar_url: null,
        headline: null,
        bio: null,
        academic: null,
        skills: undefined,
        interests: undefined,
        external_links: null,
        projects: null,
        achievements: null,
        clubs: null,
      } as any;

      const normalized = normalizePublicStudentProfile(minimalPayload);
      expect(normalized.slug).toBe('minimal-user');
      expect(normalized.fullName).toBeNull();
      expect(normalized.avatarUrl).toBeNull();
      expect(normalized.program).toBeNull();
      expect(normalized.batch).toBeNull();
      expect(normalized.skills).toEqual([]);
      expect(normalized.interests).toEqual([]);
      expect(normalized.projects).toEqual([]);
      expect(normalized.achievements).toEqual([]);
      expect(normalized.clubs).toEqual([]);
      expect(normalized.externalLinks).toEqual({});
    });
  });

  describe('2. Event List and Details DTO Contracts', () => {
    it('2.1: Validates canonical event pagination envelope (data + pagination)', () => {
      const eventResponse: EventsResponse = {
        data: [
          {
            id: 'ev-1',
            title: 'Workshop',
            description: 'Tech Workshop',
            startTime: '2026-11-01T10:00:00.000Z',
            endTime: '2026-11-01T12:00:00.000Z',
            registrationStartTime: '2026-10-01T10:00:00.000Z',
            registrationEndTime: '2026-10-31T23:59:59.000Z',
            registrationStatus: 'OPEN',
            locationName: 'Hall A',
            state: 'PUBLISHED',
            maxCapacity: 100,
            maxParticipants: null,
            participantCount: 25,
            registrationCount: 25,
            isLocked: false,
            attendanceType: 'SINGLE',
            eventType: 'WORKSHOP',
            visibility: 'PUBLIC',
            registrationType: 'INDIVIDUAL',
            registrationMode: 'REQUIRED',
            audience: 'ALL_STUDENTS',
            location_geofence: null,
            lock_deadline: '2026-11-02T12:00:00.000Z',
            lock_state: 'UNLOCKED',
          },
        ],
        pagination: {
          next_cursor: 'cursor-token-123',
          has_more: true,
        },
      };

      expect(Array.isArray(eventResponse.data)).toBe(true);
      expect(eventResponse.data[0].registrationStatus).toBe('OPEN');
      expect(eventResponse.pagination.next_cursor).toBe('cursor-token-123');
      expect(eventResponse.pagination.has_more).toBe(true);
    });
  });

  describe('3. Teams Pagination Dual Compatibility', () => {
    it('3.1: TeamsPagination accepts both nextCursor and next_cursor without type conflicts', () => {
      const teamsResponseWithCamelCase: TeamsResponse = {
        data: [
          {
            id: 'team-1',
            name: 'Squad 1',
            leader_id: 'user-1',
            leader_name: 'Leader One',
            member_count: 3,
            members: [],
          },
        ],
        pagination: {
          nextCursor: 'team-cursor-1',
        },
      };

      const teamsResponseWithSnakeCase: TeamsResponse = {
        data: [],
        pagination: {
          next_cursor: 'team-cursor-2',
        },
      };

      expect(teamsResponseWithCamelCase.pagination.nextCursor).toBe('team-cursor-1');
      expect(teamsResponseWithSnakeCase.pagination.next_cursor).toBe('team-cursor-2');
    });
  });

  describe('4. Clubs List & Detail Casing Aliases', () => {
    it('4.1: ClubListItem accepts banner_url and bannerUrl simultaneously', () => {
      const club: ClubListItem = {
        id: 'club-1',
        name: 'Robotics Society',
        description: 'Building bots',
        status: 'ACTIVE',
        banner_url: 'https://cdn.nstsdc.org/banner.png',
        bannerUrl: 'https://cdn.nstsdc.org/banner.png',
        event_count: 5,
        member_count: 20,
      };

      expect(club.banner_url).toBe(club.bannerUrl);
    });

    it('4.2: ClubDetail includes members list and banner compatibility', () => {
      const detail: ClubDetail = {
        id: 'club-1',
        name: 'Robotics Society',
        description: 'Building bots',
        status: 'ACTIVE',
        banner_url: 'https://cdn.nstsdc.org/banner.png',
        bannerUrl: 'https://cdn.nstsdc.org/banner.png',
        event_count: 5,
        members: [
          {
            user_id: 'user-10',
            role: 'CLUB_ADMIN',
            full_name: 'Admin User',
            avatar_url: null,
          },
        ],
      };

      expect(detail.members.length).toBe(1);
      expect(detail.members[0].role).toBe('CLUB_ADMIN');
    });
  });

  describe('5. Registration Status DTO Contract', () => {
    it('5.1: MyRegistrationResponse supports FORMING, WAITLISTED, REGISTERED, NOT_REGISTERED', () => {
      const forming: MyRegistrationResponse = { status: 'FORMING', team_id: 'team-uuid' };
      const waitlisted: MyRegistrationResponse = { status: 'WAITLISTED', waitlist_position: 3 };
      const registered: MyRegistrationResponse = { status: 'REGISTERED', team_id: null };
      const notRegistered: MyRegistrationResponse = { status: 'NOT_REGISTERED' };

      expect(forming.status).toBe('FORMING');
      expect(waitlisted.waitlist_position).toBe(3);
      expect(registered.status).toBe('REGISTERED');
      expect(notRegistered.status).toBe('NOT_REGISTERED');
    });
  });
});
