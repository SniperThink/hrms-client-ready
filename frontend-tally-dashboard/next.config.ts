import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // tell Next.js to use /dist instead of /.next
  distDir: 'dist',

  compiler: {
    // remove all console.* in production, keep console.error
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error'] }
        : false,
  },
};

export default nextConfig;
