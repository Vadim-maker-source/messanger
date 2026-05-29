/**
 * Простой rate-limiter (sliding window) в памяти.
 *
 * Для нескольких инстансов нужен Redis. Для одного VPS — этого достаточно.
 *
 * Использование:
 *   const rl = await checkRateLimit(req, "login", { limit: 5, windowMs: 60_000 });
 *   if (!rl.ok) return rateLimited(rl);
 */

import { NextRequest, NextResponse } from "next/server";

interface Window {
  timestamps: number[];
}

// `${bucket}|${key}` -> Window
const store = new Map<string, Window>();

let cleanupTimer: NodeJS.Timeout | null = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    // Удаляем окна, где все таймстампы старше 1 часа
    for (const [k, w] of store.entries()) {
      w.timestamps = w.timestamps.filter((t) => now - t < 3_600_000);
      if (w.timestamps.length === 0) store.delete(k);
    }
  }, 60_000);
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();
}

function getClientKey(req: NextRequest): string {
  // x-forwarded-for от Nginx — IP клиента
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri;
  return "unknown";
}

interface RateLimitOptions {
  limit: number;     // максимум запросов
  windowMs: number;  // длина окна в ms
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Проверяет лимит. По умолчанию — по IP. Если передан `userId`, лимит ставится
 * совместно: ip + userId — это даёт более точную защиту от спама с одного юзера.
 */
export function checkRateLimit(
  req: NextRequest,
  bucket: string,
  options: RateLimitOptions,
  userId?: string
): RateLimitResult {
  ensureCleanup();
  const ip = getClientKey(req);
  const key = userId ? `${bucket}|${ip}|${userId}` : `${bucket}|${ip}`;

  const now = Date.now();
  const windowStart = now - options.windowMs;

  let win = store.get(key);
  if (!win) {
    win = { timestamps: [] };
    store.set(key, win);
  }

  // Удаляем устаревшие
  win.timestamps = win.timestamps.filter((t) => t > windowStart);

  if (win.timestamps.length >= options.limit) {
    const oldest = win.timestamps[0];
    const retryAfterSec = Math.ceil((oldest + options.windowMs - now) / 1000);
    return { ok: false, remaining: 0, retryAfterSec: Math.max(retryAfterSec, 1) };
  }

  win.timestamps.push(now);
  return {
    ok: true,
    remaining: options.limit - win.timestamps.length,
    retryAfterSec: 0,
  };
}

/** Готовый ответ 429 с правильным заголовком Retry-After. */
export function rateLimited(rl: RateLimitResult) {
  return NextResponse.json(
    { success: false, error: `Слишком много запросов. Попробуйте через ${rl.retryAfterSec} сек.` },
    {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSec) },
    }
  );
}
