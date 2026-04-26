import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  images: {
    // Формат изображений (опционально)
    formats: ['image/avif', 'image/webp'],
    
    // Минимальная кэшируемость (в секундах)
    minimumCacheTTL: 60,
    
    // Удаленные паттерны вместо domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'your-storage-domain.com',
        port: '',
        pathname: '/**',
      },
    ],
    
    // Настройки оптимизации
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    
    // Отключить dangerouslyAllowSVG если не нужен (безопасность)
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Accept, Content-Type' },
        ],
      },
    ];
  },
};

export default nextConfig;