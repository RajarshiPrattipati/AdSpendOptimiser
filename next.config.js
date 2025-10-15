/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable SWC minification for faster builds
  swcMinify: true,
  // Optimize build performance
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Skip trailing slash
  skipTrailingSlashRedirect: true,
  // Skip prerendering error pages to avoid Pages Router conflicts in App Router
  // App Router has its own error.tsx and global-error.tsx
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  // Explicitly use standalone output for better Netlify compatibility
  output: 'standalone',
}

module.exports = nextConfig
