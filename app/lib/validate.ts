/**
 * Валидаторы и санитайзеры для входящих данных API.
 *
 * Принципы:
 *  • Whitelist > blacklist
 *  • Жёсткие лимиты длины везде, чтобы избежать DoS через гигабайтные строки
 *  • Никогда не передаём сырой `error.message` Prisma наружу
 */

import { ChatType, AccessType, ChatRole } from "@prisma/client";
import { NextResponse } from "next/server";

// ─── Лимиты ─────────────────────────────────────────────────────────────────

export const LIMITS = {
  MESSAGE_CONTENT: 10_000,
  PROFILE_BIO: 1_000,
  PROFILE_STATUS: 200,
  PROFILE_NAME: 100,
  CHAT_NAME: 100,
  SERVER_NAME: 100,
  CHANNEL_NAME: 80,
  SEARCH_QUERY: 200,
  PASSWORD_MIN: 6,
  PASSWORD_MAX: 200,
  USERNAME_MAX: 32,
  EMAIL_MAX: 255,
  URL_MAX: 500,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function asString(v: any, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  if (t.length > max) return null;
  return t;
}

export function asOptionalString(v: any, max: number): string | null | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return null;
  if (v.length > max) return null;
  return v;
}

const VALID_CHAT_TYPES: ChatType[] = ["PRIVATE", "GROUP", "CHANNEL"];
const VALID_ACCESS: AccessType[] = ["PUBLIC", "LINK_ONLY", "PRIVATE"];
const VALID_ROLES: ChatRole[] = ["CREATOR", "ADMIN", "MEMBER"];
const VALID_FILE_TYPES = ["IMAGE", "VIDEO", "AUDIO", "FILE", "ROUND"] as const;

export function asChatType(v: any): ChatType | null {
  if (typeof v !== "string") return null;
  const u = v.toUpperCase();
  // Flutter иногда присылает 'TEXT' для текстовых каналов
  if (u === "TEXT") return "GROUP";
  return VALID_CHAT_TYPES.includes(u as ChatType) ? (u as ChatType) : null;
}

export function asAccessType(v: any): AccessType | null {
  if (typeof v !== "string") return null;
  const u = v.toUpperCase();
  return VALID_ACCESS.includes(u as AccessType) ? (u as AccessType) : null;
}

export function asChatRole(v: any): ChatRole | null {
  if (typeof v !== "string") return null;
  const u = v.toUpperCase();
  return VALID_ROLES.includes(u as ChatRole) ? (u as ChatRole) : null;
}

export function asFileType(v: any): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return null;
  const u = v.toUpperCase();
  return (VALID_FILE_TYPES as readonly string[]).includes(u) ? u : null;
}

const ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
export function asId(v: any): string | null {
  if (typeof v !== "string") return null;
  return ID_REGEX.test(v) ? v : null;
}

export function asIdArray(v: any, max = 100): string[] | null {
  if (!Array.isArray(v)) return null;
  if (v.length > max) return null;
  const out: string[] = [];
  for (const item of v) {
    const id = asId(item);
    if (!id) return null;
    out.push(id);
  }
  return out;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function asEmail(v: any): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (t.length === 0 || t.length > LIMITS.EMAIL_MAX) return null;
  return EMAIL_REGEX.test(t) ? t : null;
}

const URL_ALLOWED_PROTOCOLS = ["https:", "http:"];
export function asUrl(v: any, max = LIMITS.URL_MAX): string | null {
  if (typeof v !== "string") return null;
  if (v.length === 0) return null;
  if (v.length > max) return null;
  try {
    const u = new URL(v);
    if (!URL_ALLOWED_PROTOCOLS.includes(u.protocol)) return null;
    return v;
  } catch {
    return null;
  }
}

export function asBool(v: any, def = false): boolean {
  if (typeof v === "boolean") return v;
  return def;
}

export function asPositiveInt(v: any, max = 1_000_000): number | null {
  const n = typeof v === "number" ? v : parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.floor(n);
}

// ─── Безопасная обработка ошибок ────────────────────────────────────────────

const isProd = process.env.NODE_ENV === "production";

/**
 * Возвращает безопасный JSON-ответ при ошибке. В проде — generic сообщение,
 * в dev — детали для отладки. Ошибки логируются в любом случае.
 */
export function errorResponse(e: unknown, label = "API"): NextResponse {
  console.error(`[${label}]`, e);
  if (isProd) {
    return NextResponse.json(
      { success: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
  const msg = e instanceof Error ? e.message : "Unknown error";
  return NextResponse.json({ success: false, error: msg }, { status: 500 });
}

export function badRequest(error = "Некорректный запрос"): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

export function unauthorized(error = "Unauthorized"): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 401 });
}

export function forbidden(error = "Forbidden"): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 403 });
}

export function notFound(error = "Не найдено"): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 404 });
}
