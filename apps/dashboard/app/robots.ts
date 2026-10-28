import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/event/', '/projects/', '/students', '/privacy-policy'],
        disallow: ['/admin/', '/login', '/auth/', '/api/', '/events/', '/my/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
