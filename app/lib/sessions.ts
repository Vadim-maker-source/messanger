import { randomBytes, createHash } from "crypto";

/**
 * Утилиты для работы с сессиями пользователей и QR-логином.
 */

// ─── QR-токен ───────────────────────────────────────────────────────────────

/** Срок жизни одного QR-кода. После истечения требуется новый. */
export const QR_TTL_SECONDS = 90;

/** Генерирует криптостойкий публичный токен для QR. 32 байта → 64 hex-символа. */
export function generateQrToken(): string {
  return randomBytes(32).toString("hex");
}

// ─── Парсинг User-Agent для отображения "Chrome on Windows" и т.д. ─────────

/**
 * Определяет тип устройства и читаемое имя из заголовков.
 * Если задан X-Device-Name (мобила сообщает явно через device_info_plus) —
 * используем его. Иначе парсим User-Agent.
 */
export function parseDeviceInfo(
  userAgent: string | null | undefined,
  customDeviceName?: string | null
): {
  deviceType: "web" | "mobile" | "desktop";
  deviceName: string;
} {
  // Приоритет — явное имя от мобильного клиента
  if (customDeviceName && customDeviceName.trim()) {
    return {
      deviceType: "mobile",
      deviceName: customDeviceName.trim().slice(0, 100),
    };
  }

  const ua = (userAgent || "").toLowerCase();

  if (!ua) return { deviceType: "web", deviceName: "Unknown device" };

  // Flutter / Dart UA — мобильный без названия устройства
  if (ua.includes("dart") || ua.includes("flutter")) {
    return { deviceType: "mobile", deviceName: "Talky Mobile" };
  }

  // Browser
  let browser = "Browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/") && !ua.includes("edg/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari";
  else if (ua.includes("opera/") || ua.includes("opr/")) browser = "Opera";

  // OS
  let os = "PC";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("iphone") || ua.includes("ios")) os = "iOS";
  else if (ua.includes("ipad")) os = "iPad";
  else if (ua.includes("android")) os = "Android";

  // Mobile detection
  const isMobile = /android|iphone|ipad|mobile/i.test(ua);
  const deviceType: "web" | "mobile" | "desktop" = isMobile ? "mobile" : "web";

  return {
    deviceType,
    deviceName: `${browser} · ${os}`,
  };
}

// ─── Хеширование токенов сессии ────────────────────────────────────────────

/** Хеш токена для хранения в БД. Используем SHA-256 — для длинных токенов этого достаточно. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Получить IP клиента из NextRequest ────────────────────────────────────

export function getClientIp(req: { headers: Headers }): string | null {
  // Forward от nginx
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const xri = req.headers.get("x-real-ip");
  if (xri) return xri;

  return null;
}
