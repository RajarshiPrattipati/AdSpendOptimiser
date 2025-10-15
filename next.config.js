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
  // Disable static optimization for error pages to prevent Pages Router issues in App Router
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Skip trailing slash
  skipTrailingSlashRedirect: true,
}

module.exports = nextConfig
