import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/app/lib/api/user";

/**
 * POST /api/auth/register
 *
 * Универсальный endpoint:
 *  • На Vercel — установлена `AUTH_PROXY_HOST=http://194.87.201.226` →
 *    запрос проксируется на основной сервер. Браузер видит только
 *    относительный путь `/api/auth/register`.
 *  • На основном сервере — переменная не установлена → регистрация
 *    идёт напрямую через серверную функцию.
 *
 * Это позволяет использовать один и тот же код в обоих деплоях без
 * бесконечной рекурсии.
 */

const PROXY_HOST = process.env.AUTH_PROXY_HOST?.trim();
const PROXY_PATH = "/api/mobile/auth/register";

export async function POST(request: NextRequest) {
  try {
    // ── Режим proxy (Vercel) ───────────────────────────────────────────────
    if (PROXY_HOST) {
      const body = await request.text();
      try {
        const upstream = await fetch(`${PROXY_HOST}${PROXY_PATH}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For":
              request.headers.get("x-forwarded-for") ||
              request.headers.get("x-real-ip") ||
              "",
            "User-Agent": request.headers.get("user-agent") || "Talky-Vercel-Proxy",
          },
          body,
          redirect: "manual",
        });

        const text = await upstream.text();
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          data = { success: upstream.ok, raw: text };
        }
        return NextResponse.json(data, { status: upstream.status });
      } catch (e: any) {
        console.error("[proxy register] upstream error:", e?.message);
        return NextResponse.json(
          { success: false, error: "Сервер регистрации недоступен. Попробуйте позже." },
          { status: 502 }
        );
      }
    }

    // ── Прямой режим (основной сервер) ─────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ success: false, error: "Некорректный email" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ success: false, error: "Пароль минимум 6 символов" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      return NextResponse.json(
        { success: false, error: "Username: только латиница, цифры, _, от 3 до 32" },
        { status: 400 }
      );
    }
    if (!displayName) {
      return NextResponse.json({ success: false, error: "Введите имя" }, { status: 400 });
    }

    const result = await registerUser({ email, password, username, displayName });
    return NextResponse.json({ success: true, userId: result.userId });
  } catch (e: any) {
    const msg = e?.message || "Registration failed";
    if (msg.includes("Unique constraint") || msg.includes("already") || msg.includes("уже существует")) {
      return NextResponse.json(
        { success: false, error: "Email или username уже заняты" },
        { status: 400 }
      );
    }
    console.error("[register] error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
