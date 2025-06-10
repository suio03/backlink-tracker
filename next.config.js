/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Optimize for production
  poweredByHeader: false,
  generateEtags: false,
  
  // Compression and performance
  compress: true,
  
  // Image optimization for Docker
  images: {
    unoptimized: false,
    domains: [
      'localhost',
      // Add your domain here when deploying
    ],
  },
  
  // External packages for server components (moved from experimental in Next.js 15)
  serverExternalPackages: ['pg', 'postgres'],
  
  // Environment variables validation
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Webpack optimization for production
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent bundling of certain packages on the server
      config.externals.push('pg-native');
    }
    
    return config;
  },
};

module.exports = nextConfig; 