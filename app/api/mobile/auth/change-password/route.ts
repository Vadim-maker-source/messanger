import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { prisma } from "@/app/lib/prisma";
import { verifyCode } from "@/app/lib/two-factor";
import { checkRateLimit, rateLimited } from "@/app/lib/rate-limit";
import { LIMITS, unauthorized, badRequest, errorResponse } from "@/app/lib/validate";

/**
 * POST /api/mobile/auth/change-password
 * Body: { oldPassword?, newPassword, code? }
 *
 * Два сценария:
 *  1. Знает старый пароль:    { oldPassword, newPassword }
 *  2. Забыл (через 2FA-код):  { code, newPassword }
 *
 * Без кода или без старого пароля — нельзя.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getMobileUserFromRequest(request);
    if (!currentUser) return unauthorized();

    // Защита от brute-force старого пароля
    const rl = checkRateLimit(request, "change-pass", { limit: 5, windowMs: 60_000 }, currentUser.id);
    if (!rl.ok) return rateLimited(rl);

    const body = await request.json().catch(() => ({}));
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const oldPassword = typeof body.oldPassword === "string" ? body.oldPassword : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!newPassword) return badRequest("Введите новый пароль");
    if (newPassword.length < LIMITS.PASSWORD_MIN) {
      return badRequest(`Пароль должен быть не короче ${LIMITS.PASSWORD_MIN} символов`);
    }
    if (newPassword.length > LIMITS.PASSWORD_MAX) {
      return badRequest("Пароль слишком длинный");
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { hashedPassword: true },
    });

    if (!user?.hashedPassword) {
      return badRequest("Пользователь не найден");
    }

    // Проверка авторизации смены: либо старый пароль, либо валидный 2FA-код
    if (code) {
      const v = verifyCode(currentUser.id, "reset-password", code);
      if (!v.ok) {
        const msg =
          v.reason === "expired" ? "Код истёк, запросите новый"
            : v.reason === "too_many_attempts" ? "Превышено число попыток"
            : v.reason === "not_found" ? "Запросите код заново"
            : "Неверный код";
        return badRequest(msg);
      }
    } else {
      if (!oldPassword) return badRequest("Введите текущий пароль");
      const isValid = await bcrypt.compare(oldPassword, user.hashedPassword);
      if (!isValid) return badRequest("Старый пароль неверный");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "change-password");
  }
}
