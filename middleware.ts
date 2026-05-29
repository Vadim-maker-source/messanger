import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Базовый middleware для /api/mobile/*:
 *   • Обрабатывает CORS preflight (OPTIONS)
 *   • Добавляет CORS заголовки на все ответы
 *   • Добавляет защитные security-headers
 *   • Базовая проверка наличия Authorization (полная — в самих route handlers)
 *
 * Полная верификация JWT остаётся в `getMobileUserFromRequest()` per-route,
 * потому что Edge runtime middleware не может работать с Prisma напрямую.
 * Здесь — только sanity-check на наличие токена для не-публичных путей.
 */

// Список путей, доступных без авторизации
const PUBLIC_PATHS = [
  "/api/mobile/auth/login",
  "/api/mobile/auth/register",
  "/api/mobile/auth/reset-password",
  "/api/mobile/calls/ice-config",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=*, microphone=*, geolocation=()",
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/mobile")) {
    return NextResponse.next();
  }

  // Preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
  }

  // Базовая проверка: для приватных путей должен быть Bearer-токен.
  // Полная валидация JWT — в getMobileUserFromRequest() в route handlers.
  if (!isPublic(pathname)) {
    const auth = request.headers.get("authorization");
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: { ...CORS_HEADERS, ...SECURITY_HEADERS } }
      );
    }
  }

  const response = NextResponse.next();
  Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: "/api/mobile/:path*",
};
