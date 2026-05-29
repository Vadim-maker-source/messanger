import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { peekCode } from "@/app/lib/two-factor";
import { checkRateLimit, rateLimited } from "@/app/lib/rate-limit";
import { asEmail, badRequest, errorResponse } from "@/app/lib/validate";

const RESET_ACTION = "password-reset-flow";

/**
 * POST /api/auth/verify-reset-code
 * Body: { email, code }
 *
 * Предварительная проверка кода восстановления пароля БЕЗ его расходования.
 * Используется UI-шагом «введите код» чтобы сразу показать «неверный код»
 * вместо того чтобы пускать пользователя дальше и ругаться только на финале.
 *
 * При финальной смене пароля код проверяется ещё раз (через verifyCode),
 * который уже consume'ит запись.
 */
export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, "pwd-verify", { limit: 10, windowMs: 60_000 });
    if (!rl.ok) return rateLimited(rl);

    const body = await request.json().catch(() => ({}));
    const email = asEmail(body.email);
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!email) return badRequest("Некорректный email");
    if (!code) return badRequest("Введите код");

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    if (!user) return badRequest("Аккаунт не найден");

    const v = peekCode(user.id, RESET_ACTION, code);
    if (!v.ok) {
      const msg =
        v.reason === "expired" ? "Код истёк, запросите новый"
          : v.reason === "too_many_attempts" ? "Превышено число попыток"
          : v.reason === "not_found" ? "Запросите код заново"
          : "Неверный код";
      return badRequest(msg);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "verify-reset-code");
  }
}
