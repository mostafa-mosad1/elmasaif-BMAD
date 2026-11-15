import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@elmasaif/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      },
      {
        protocol: 'http',
        hostname: 'localhost'
      }
    ]
  },
  async redirects() {
    return [
      { source: '/terms', destination: '/pages/terms-of-service', permanent: true },
      { source: '/privacy', destination: '/pages/privacy-policy', permanent: true },
      { source: '/faq', destination: '/pages/faq', permanent: true },
      { source: '/contact', destination: '/pages/contact', permanent: true },
      { source: '/calculator', destination: '/pages/calculator', permanent: true },
      { source: '/support', destination: '/pages/contact', permanent: true },
    ];
  },
  async rewrites() {
    const apiDestination =
      process.env.INTERNAL_API_URL ||
      process.env.API_URL ||
      'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiDestination}/api/:path*`,
      },
    ];
  }
};

export default nextConfig;
