import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cf/db', '@cf/scoring', '@cf/profile'],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
