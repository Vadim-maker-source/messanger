import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Сводный middleware:
 *
 * 1. **Vercel-режим** (preview-домен `*.vercel.app`):
 *    Лендинг — это публичный «pre-registration». Доступны только лендинг
 *    и страницы аутентификации. Чат, настройки, профили, mobile API и
 *    инвайты — недоступны и редиректятся на `/`.
 *
 *    Это сделано чтобы не светить через Vercel внутренние экраны
 *    приложения, которые требуют WebSocket/real-time/файловый upload —
 *    всё это работает только на основном сервере (194.87.201.226).
 *
 * 2. Маршруты `/api/mobile/...` — Bearer-аутентификация для приватных путей,
 *    CORS-заголовки, security headers.
 */

// ─── Конфиг ──────────────────────────────────────────────────────────────────

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

// Пути доступные без авторизации в /api/mobile/
const MOBILE_PUBLIC = [
  "/api/mobile/auth/login",
  "/api/mobile/auth/register",
  "/api/mobile/auth/reset-password",
  "/api/mobile/calls/ice-config",
];

// На Vercel-домене разрешены ТОЛЬКО эти страницы и API
const VERCEL_ALLOWED_PAGES = ["/", "/sign-in", "/sign-in/qr", "/sign-up", "/welcome", "/stack"];
const VERCEL_ALLOWED_API_PREFIXES = [
  "/api/auth",        // login, register, reset-password, send-2fa, verify, change-password, NextAuth
  "/api/early-access",
];
// Системные пути Next.js — никогда не блокируем
const SYSTEM_PREFIXES = ["/_next", "/favicon", "/images", "/.well-known"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isVercelHost(host: string | null): boolean {
  if (!host) return false;
  return host.endsWith(".vercel.app");
}

function isVercelAllowed(pathname: string): boolean {
  if (SYSTEM_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (VERCEL_ALLOWED_PAGES.includes(pathname)) return true;
  if (VERCEL_ALLOWED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  return false;
}

function isMobilePublic(pathname: string): boolean {
  return MOBILE_PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");

  // === 1. Vercel-домен: блокируем страницы и API приложения ===
  if (isVercelHost(host) && !isVercelAllowed(pathname)) {
    // Для API возвращаем 404 (а не редирект), чтобы клиент не залипал
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Not available on this host" },
        { status: 404 }
      );
    }
    // Для страниц — редирект на лендинг
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // === 2. /api/mobile/* — CORS + auth-проверка ===
  if (pathname.startsWith("/api/mobile")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
    }

    if (!isMobilePublic(pathname)) {
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

  // === 3. Остальные пути — пропускаем с security headers ===
  const response = NextResponse.next();
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  // Matcher для всех путей кроме статических ассетов
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.well-known/).*)",
  ],
};
