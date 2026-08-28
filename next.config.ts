import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingExcludes: {
    '/*': ['./data/**/*'],
  },
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
