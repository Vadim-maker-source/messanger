import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.109', 'localhost', '192.168.56.1'],
  // Пропускаем TypeScript-проверку при `next build` — на слабом VPS она съедает
  // ~500 MB heap'а и валит сборку. TS-проверку запускаем отдельно через
  // `tsc --noEmit` в dev/CI до коммита.
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      // 60 МБ — с запасом для видео; всё, что больше — отвергается.
      // Защита от DoS через гигантские payloads.
      bodySizeLimit: '60mb',
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
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },
};

export default nextConfig;