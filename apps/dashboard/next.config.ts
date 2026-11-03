import type { NextConfig } from "next";

const apiInternalUrl =
  process.env.API_INTERNAL_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'http://nst-api-service'
    : 'http://localhost:3001');

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  images: {
    dangerouslyAllowSVG: false,
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/clubs',
          has: [{ type: 'header', key: 'x-client-platform' }],
          destination: `${apiInternalUrl}/clubs`,
        },
        {
          source: '/clubs/:path*',
          has: [{ type: 'header', key: 'x-client-platform' }],
          destination: `${apiInternalUrl}/clubs/:path*`,
        },
        {
          source: '/users',
          has: [{ type: 'header', key: 'x-client-platform' }],
          destination: `${apiInternalUrl}/users`,
        },
        {
          source: '/users/:path*',
          has: [{ type: 'header', key: 'x-client-platform' }],
          destination: `${apiInternalUrl}/users/:path*`,
        },
        {
          source: '/v1/:path*',
          destination: `${apiInternalUrl}/v1/:path*`,
        },
        {
          source: '/auth/:path*',
          destination: `${apiInternalUrl}/auth/:path*`,
        },
      ],
      fallback: [
        {
          source: '/clubs',
          destination: `${apiInternalUrl}/clubs`,
        },
        {
          source: '/clubs/:path*',
          destination: `${apiInternalUrl}/clubs/:path*`,
        },
        {
          source: '/users',
          destination: `${apiInternalUrl}/users`,
        },
        {
          source: '/users/:path*',
          destination: `${apiInternalUrl}/users/:path*`,
        },
        {
          source: '/v1/:path*',
          destination: `${apiInternalUrl}/v1/:path*`,
        },
        {
          source: '/auth/:path*',
          destination: `${apiInternalUrl}/auth/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
