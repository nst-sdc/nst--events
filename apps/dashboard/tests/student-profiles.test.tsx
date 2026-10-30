// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { studentsApi } from '../lib/students-api';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Student Profiles & Directory Dashboard Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('studentsApi.getDirectory fetches directory with query params', async () => {
    const mockDirectoryResponse = {
      items: [
        {
          id: 'user-1',
          fullName: 'Alice Developer',
          slug: 'alice-dev',
          avatarUrl: 'https://images.unsplash.com/alice.jpg',
          headline: 'Systems Architect',
          bio: 'Building distributed systems',
          batch: '2026',
          program: 'B.Tech CS',
          campus: 'Pune',
          skills: ['rust', 'go', 'distributed-systems'],
          projectsCount: 2,
          achievementsCount: 1,
        },
      ],
      pagination: { total: 1, page: 1, limit: 12, totalPages: 1 },
      facets: {
        programs: ['B.Tech CS'],
        batches: ['2026'],
        skills: ['rust', 'go'],
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDirectoryResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await studentsApi.getDirectory({ search: 'alice', skill: 'rust' });
    expect(result.items.length).toBe(1);
    expect(result.items[0].fullName).toBe('Alice Developer');
    expect(result.items[0].slug).toBe('alice-dev');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('search=alice');
    expect(fetchMock.mock.calls[0][0]).toContain('skill=rust');
  });

  it('studentsApi.getDirectory normalizes raw backend data without facets or items key', async () => {
    const rawBackendResponse = {
      data: [
        {
          id: 'user-2',
          full_name: 'Bob Builder',
          slug: 'bob-builder',
          avatar_url: null,
          headline: 'Full-Stack Craftsman',
          bio: 'Building things',
          campus: 'Rishihood',
          academic: {
            program_code: 'BTECH_CSE',
            program_name: 'B.Tech CSE',
            graduation_year: 2027,
          },
          skills: ['typescript', 'react'],
          projects_count: 3,
          achievements_count: 1,
        },
      ],
      pagination: {
        total: 1,
        limit: 12,
        offset: 0,
        has_more: false,
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rawBackendResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await studentsApi.getDirectory();
    expect(result.items.length).toBe(1);
    expect(result.items[0].fullName).toBe('Bob Builder');
    expect(result.items[0].program).toBe('B.Tech CSE');
    expect(result.items[0].batch).toBe('2027');
    expect(result.facets).toBeDefined();
    expect(result.facets.programs).toContain('B.Tech CSE');
    expect(result.facets.batches).toContain('2027');
    expect(result.facets.skills).toEqual(['react', 'typescript']);
  });

  it('studentsApi.getPublicProfile fetches public dossier by slug', async () => {
    const mockProfile = {
      id: 'user-1',
      fullName: 'Alice Developer',
      slug: 'alice-dev',
      avatarUrl: 'https://images.unsplash.com/alice.jpg',
      headline: 'Systems Architect',
      bio: 'Building distributed systems',
      batch: '2026',
      program: 'B.Tech CS',
      campus: 'Pune',
      skills: ['rust', 'go'],
      interests: ['distributed algorithms'],
      externalLinks: {
        github: 'https://github.com/alice-dev',
        linkedin: 'https://linkedin.com/in/alice-dev',
      },
      projects: [
        {
          id: 'p-1',
          title: 'Distributed KV Store',
          slug: 'distributed-kv-store',
          tagline: 'Raft consensus KV store in Rust',
          category: 'SYSTEMS',
          tags: ['rust', 'raft'],
          cover_image_url: 'https://images.unsplash.com/kv.jpg',
          role: 'CREATOR',
          is_owner: true,
          published_at: new Date().toISOString(),
          featured: true,
          display_order: 1,
        },
      ],
      achievements: [
        {
          id: 'ach-1',
          award_name: '1st Place Winner',
          placement: '1',
          tier: 'GOLD',
          certificate_url: null,
          awarded_at: new Date().toISOString(),
          event: {
            id: 'e-1',
            title: 'Hackathon 2026',
            slug: 'hackathon-2026',
          },
        },
      ],
      clubs: [
        {
          id: 'cm-1',
          club_id: 'club-1',
          club_name: 'Developers Club',
          role: 'CLUB_ADMIN',
          joined_at: new Date().toISOString(),
        },
      ],
      isMinimal: false,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockProfile,
    });
    vi.stubGlobal('fetch', fetchMock);

    const profile = await studentsApi.getPublicProfile('alice-dev');
    expect(profile.fullName).toBe('Alice Developer');
    expect(profile.projects.length).toBe(1);
    expect(profile.achievements.length).toBe(1);
    expect(profile.clubs.length).toBe(1);
    expect(profile.externalLinks.github).toBe('https://github.com/alice-dev');
  });

  it('studentsApi.getPublicProfile throws NOT_FOUND for 404 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      text: async () => 'Not Found',
    });
    vi.stubGlobal('fetch', fetchMock);

    let caughtError: any = null;
    try {
      await studentsApi.getPublicProfile('unknown-slug');
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).not.toBeNull();
    expect(caughtError.message).toBe('NOT_FOUND');
  });

  it('studentsApi.getPublicProfile returns redirect payload for historical handles', async () => {
    const redirectPayload = {
      redirect: true,
      canonical_slug: 'alice-canonical',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => redirectPayload,
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await studentsApi.getPublicProfile('alice-old-slug');
    expect(res.redirect).toBe(true);
    expect(res.canonical_slug).toBe('alice-canonical');
  });

  it('studentsApi.updateMyVisibility sends visibility toggles and directoryListed flags', async () => {
    const payload = {
      section_visibility: {
        identity: false,
        avatar: false,
        academic: true,
      },
      directory_listed: false,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ message: 'Visibility updated' }),
      json: async () => ({ message: 'Visibility updated' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await studentsApi.updateMyVisibility(payload);
    expect(res.message).toBe('Visibility updated');
    expect(fetchMock).toHaveBeenCalled();
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.section_visibility.identity).toBe(false);
    expect(callBody.directory_listed).toBe(false);
  });

  it('studentsApi.curateItem sends item_type and flags for featuring and hiding items', async () => {
    const curationPayload = {
      item_type: 'PROJECT' as const,
      source_record_id: 'p-1',
      featured: true,
      hidden: false,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ message: 'Curated' }),
      json: async () => ({ message: 'Curated' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await studentsApi.curateItem(curationPayload);
    expect(res.message).toBe('Curated');
    expect(fetchMock).toHaveBeenCalled();
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.item_type).toBe('PROJECT');
    expect(callBody.featured).toBe(true);
  });

  it('correctly handles minimal profile with masked identity and avatar', async () => {
    const minimalProfile = {
      id: 'user-anon',
      fullName: null,
      slug: 'student-9c9c488e',
      avatarUrl: null,
      headline: null,
      bio: null,
      batch: '2026',
      program: 'B.Tech CS',
      campus: 'Pune',
      skills: [],
      interests: [],
      externalLinks: {},
      projects: [],
      achievements: [],
      clubs: [],
      isMinimal: true,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimalProfile,
    });
    vi.stubGlobal('fetch', fetchMock);

    const profile = await studentsApi.getPublicProfile('student-9c9c488e');
    expect(profile.fullName).toBeNull();
    expect(profile.avatarUrl).toBeNull();
    expect(profile.isMinimal).toBe(true);
    expect(profile.slug).toBe('student-9c9c488e');
  });
});
