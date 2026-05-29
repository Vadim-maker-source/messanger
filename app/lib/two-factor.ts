/**
 * Серверное хранилище 2FA-кодов с TTL.
 *
 * Для production стоит заменить на Redis. Для одного инстанса VPS
 * достаточно in-memory Map с автоматической очисткой.
 *
 * Безопасность:
 *  • Код генерируется ТОЛЬКО на сервере и никогда не возвращается клиенту.
 *  • Срок жизни — 10 минут.
 *  • Лимит попыток ввода — 5; после превышения код инвалидируется.
 *  • Один пользователь+действие = один активный код. При создании нового —
 *    старый удаляется (предотвращает гонку).
 */

import crypto from "crypto";

const TTL_MS = 10 * 60 * 1000; // 10 минут
const MAX_ATTEMPTS = 5;

interface CodeEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

// userId|action -> CodeEntry
const store = new Map<string, CodeEntry>();

// Периодическая чистка устаревших кодов (раз в минуту)
let cleanupTimer: NodeJS.Timeout | null = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt < now) store.delete(key);
    }
  }, 60_000);
  // В Node.js — не блокировать event loop при выходе
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();
}

function key(userId: string, action: string): string {
  return `${userId}|${action || "default"}`;
}

/**
 * Генерирует криптографически случайный 6-значный код,
 * сохраняет его и возвращает для отправки пользователю.
 */
export function issueCode(userId: string, action: string): string {
  ensureCleanup();
  // crypto.randomInt — безопаснее Math.random
  const code = crypto.randomInt(100000, 1000000).toString();
  store.set(key(userId, action), {
    code,
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  });
  return code;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "invalid" | "too_many_attempts" | "not_found" };

/**
 * Проверяет код. При успешной проверке удаляет запись (одноразовое использование).
 * При превышении лимита попыток — также удаляет.
 */
export function verifyCode(userId: string, action: string, code: string): VerifyResult {
  return checkCode(userId, action, code, /* consume */ true);
}

/**
 * Проверка БЕЗ удаления (для предварительной валидации на UI-шаге OTP).
 * Счётчик попыток инкрементируется как обычно.
 */
export function peekCode(userId: string, action: string, code: string): VerifyResult {
  return checkCode(userId, action, code, /* consume */ false);
}

function checkCode(userId: string, action: string, code: string, consume: boolean): VerifyResult {
  const k = key(userId, action);
  const entry = store.get(k);

  if (!entry) return { ok: false, reason: "not_found" };

  if (entry.expiresAt < Date.now()) {
    store.delete(k);
    return { ok: false, reason: "expired" };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(k);
    return { ok: false, reason: "too_many_attempts" };
  }

  // constant-time сравнение через Buffer
  const a = Buffer.from(entry.code);
  const b = Buffer.from(code);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    entry.attempts++;
    return { ok: false, reason: "invalid" };
  }

  if (consume) store.delete(k);
  return { ok: true };
}

/** Отзывает активный код (используется при logout / password change). */
export function revokeCode(userId: string, action: string) {
  store.delete(key(userId, action));
}
