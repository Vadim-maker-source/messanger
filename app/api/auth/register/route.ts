import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/register
 *
 * Прокси-эндпоинт для предварительной регистрации с лендинга.
 *
 * Браузер не знает куда уходит запрос — для него это относительный путь
 * `/api/auth/register`. Реальная обработка идёт на основном сервере
 * (TARGET_HOST), и адрес скрыт от Network-вкладки DevTools.
 *
 * Зачем proxy:
 *  • Vercel держит только лендинг + auth UI, без доступа к БД
 *  • Регистрация выполняется на основном сервере где есть Prisma и БД
 *  • IP сервера не светится в HTML / клиентских скриптах
 *  • CORS не нужен (запросы уходят с Vercel-функции, не с браузера)
 */

const TARGET_HOST = process.env.AUTH_PROXY_HOST || "http://194.87.201.226";
const TARGET_PATH = "/api/mobile/auth/register";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    const upstream = await fetch(`${TARGET_HOST}${TARGET_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Передаём IP клиента — чтобы серверный rate-limit считал по реальному IP,
        // а не по IP вершельной функции
        "X-Forwarded-For":
          request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "",
        "User-Agent": request.headers.get("user-agent") || "Talky-Vercel-Proxy",
      },
      body,
      // Не следуем редиректам автоматически — это auth, всё должно быть явным
      redirect: "manual",
    });

    const text = await upstream.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { success: upstream.ok, raw: text }; }

    return NextResponse.json(data, { status: upstream.status });
  } catch (e: any) {
    console.error("[proxy register] error:", e?.message);
    return NextResponse.json(
      { success: false, error: "Сервер регистрации недоступен" },
      { status: 502 }
    );
  }
}
