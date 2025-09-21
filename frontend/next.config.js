/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    emotion: true
  },
  // Environment-based configuration
  env: {
    // This will be available in both client and server
    APP_ENV: process.env.NODE_ENV || 'development',
  },
  // Public runtime config - available on both client and server
  publicRuntimeConfig: {
    // Will be available on both server and client
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6001',
    environment: process.env.NEXT_PUBLIC_ENV || 'development',
  },
  // Server runtime config - only available on the server side
  serverRuntimeConfig: {
    // Will only be available on the server side
    secretKey: process.env.SECRET_KEY,
  },
  // Webpack configuration for better development experience
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Development-specific client-side configuration
      config.devtool = 'eval-source-map';
    }
    return config;
  },
};

module.exports = nextConfig;
