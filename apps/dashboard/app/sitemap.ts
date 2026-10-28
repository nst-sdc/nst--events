import { MetadataRoute } from 'next';
import { API_BASE_URL } from '@/lib/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/projects`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/students`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  const apiBase =
    API_BASE_URL && API_BASE_URL.startsWith('http')
      ? API_BASE_URL
      : process.env.INTERNAL_API_URL && process.env.INTERNAL_API_URL.startsWith('http')
        ? process.env.INTERNAL_API_URL
        : process.env.NODE_ENV === 'production'
          ? (process.env.INTERNAL_SERVICE_URL || 'http://nst-api-service')
          : '';

  if (!apiBase) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        `[sitemap] Incomplete production sitemap generated: Neither NEXT_PUBLIC_API_URL nor INTERNAL_API_URL was provided, and siteUrl fallback (${siteUrl}) is not an absolute HTTP URL.`
      );
    }
    return routes;
  }

  if (process.env.NODE_ENV === 'production' && (!API_BASE_URL || !API_BASE_URL.startsWith('http')) && !process.env.INTERNAL_API_URL) {
    console.warn(
      `[sitemap] NEXT_PUBLIC_API_URL is missing in production. Falling back to siteUrl (${siteUrl}) for dynamic routes.`
    );
  }

  // 1. Dynamic Public Events
  try {
    const res = await fetch(`${apiBase}/v1/events/public?limit=100`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      throw new Error(`Public events endpoint returned HTTP ${res.status} (${res.statusText})`);
    }
    const data = await res.json();
    const events = data?.data || [];
    for (const ev of events) {
      if (ev.slug) {
        routes.push({
          url: `${siteUrl}/event/${ev.slug}`,
          lastModified: new Date(ev.start_time || Date.now()),
          changeFrequency: 'daily',
          priority: 0.8,
        });
        routes.push({
          url: `${siteUrl}/event/${ev.slug}/results`,
          lastModified: new Date(ev.end_time || ev.start_time || Date.now()),
          changeFrequency: 'daily',
          priority: 0.7,
        });
      }
    }
  } catch (err) {
    console.error('Failed to generate dynamic events sitemap:', err);
    if (process.env.NODE_ENV === 'production') {
      console.warn('[sitemap] Incomplete production sitemap: dynamic public events could not be fetched.');
    }
  }

  // 2. Dynamic Published Projects
  try {
    const res = await fetch(`${apiBase}/v1/projects?limit=100`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      throw new Error(`Projects endpoint returned HTTP ${res.status} (${res.statusText})`);
    }
    const data = await res.json();
    const projects = data?.items || data?.data || [];
    for (const proj of projects) {
      if (proj.slug) {
        routes.push({
          url: `${siteUrl}/projects/${proj.slug}`,
          lastModified: new Date(proj.published_at || Date.now()),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }
  } catch (err) {
    console.error('Failed to generate dynamic projects sitemap:', err);
    if (process.env.NODE_ENV === 'production') {
      console.warn('[sitemap] Incomplete production sitemap: dynamic published projects could not be fetched.');
    }
  }

  // 3. Dynamic Public Student Profiles & Directory
  try {
    const res = await fetch(`${apiBase}/v1/students?limit=100`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      throw new Error(`Students endpoint returned HTTP ${res.status} (${res.statusText})`);
    }
    const data = await res.json();
    const students = data?.data || data?.items || [];
    for (const st of students) {
      if (st.slug) {
        routes.push({
          url: `${siteUrl}/students/${st.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }
  } catch (err) {
    console.error('Failed to generate dynamic students sitemap:', err);
    if (process.env.NODE_ENV === 'production') {
      console.warn('[sitemap] Incomplete production sitemap: dynamic student profiles could not be fetched.');
    }
  }

  return routes;
}
