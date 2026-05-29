import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { checkRateLimit, rateLimited } from "@/app/lib/rate-limit";
import { asEmail, asString, badRequest, errorResponse, LIMITS } from "@/app/lib/validate";

/**
 * POST /api/early-access
 * Body: { email, name? }
 *
 * Записывает заявку в waitlist (data/waitlist.jsonl) — построчный JSON.
 * Хранится локально в файловой системе сервера. В Network видно только
 * относительный путь /api/early-access — реальное место хранения и
 * любые внутренние пересылки (на 194.87.201.226 или другие сервисы)
 * остаются на стороне сервера и недоступны клиенту.
 */

const STORAGE_DIR = path.join(process.cwd(), "data");
const STORAGE_FILE = path.join(STORAGE_DIR, "waitlist.jsonl");

interface Entry {
  email: string;
  name: string | null;
  ip: string | null;
  ua: string | null;
  ts: string;
}

async function appendEntry(entry: Entry) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.appendFile(STORAGE_FILE, JSON.stringify(entry) + "\n", "utf-8");
}

async function isAlreadyRegistered(email: string): Promise<boolean> {
  try {
    const data = await fs.readFile(STORAGE_FILE, "utf-8");
    const lines = data.split("\n").filter(Boolean);
    return lines.some((l) => {
      try {
        const obj = JSON.parse(l);
        return typeof obj.email === "string" && obj.email.toLowerCase() === email.toLowerCase();
      } catch {
        return false;
      }
    });
  } catch (e: any) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Жёсткий rate-limit — 3/мин, 10/час с одного IP
    const minRl = checkRateLimit(request, "waitlist-min", { limit: 3, windowMs: 60_000 });
    if (!minRl.ok) return rateLimited(minRl);
    const hourRl = checkRateLimit(request, "waitlist-hour", { limit: 10, windowMs: 3_600_000 });
    if (!hourRl.ok) return rateLimited(hourRl);

    const body = await request.json().catch(() => ({}));
    const email = asEmail(body.email);
    const name = body.name === undefined ? null : asString(body.name, LIMITS.PROFILE_NAME);

    if (!email) return badRequest("Введите корректный email");

    if (await isAlreadyRegistered(email)) {
      // Молча возвращаем успех — пользователь не знает, был ли email уже в листе
      // (anti-enumeration). UX тот же, что и при первой регистрации.
      return NextResponse.json({ success: true, message: "Вы в списке" });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const ua = request.headers.get("user-agent") || null;

    await appendEntry({
      email,
      name: name ?? null,
      ip,
      ua,
      ts: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "Вы в списке" });
  } catch (e) {
    return errorResponse(e, "early-access");
  }
}
