import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: process.env.INTERNAL_API_URL 
          ? `${process.env.INTERNAL_API_URL}/:path*`
          : 'http://nst-api-service.nst-events.svc.cluster.local:80/:path*',
      },
    ];
  },
};

export default nextConfig;

