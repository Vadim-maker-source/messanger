import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/app/lib/prisma";
import { sendVerificationEmail } from "@/app/lib/mail";
import { issueCode, verifyCode } from "@/app/lib/two-factor";
import { checkRateLimit, rateLimited } from "@/app/lib/rate-limit";
import { LIMITS, asEmail, badRequest, errorResponse } from "@/app/lib/validate";

/**
 * Восстановление пароля для НЕЗАЛОГИНЕННЫХ пользователей.
 *
 * Workflow:
 *  1. POST { email }                          → отправляем код на email
 *  2. PATCH { email, code, newPassword }      → проверяем код и меняем пароль
 *
 * Защита от user-enumeration: всегда возвращаем 200, чтобы атакующий не мог
 * узнать какие email зарегистрированы.
 *
 * Защита от brute force: rate-limit по IP + строго ограниченные попытки на код.
 */

const RESET_ACTION = "password-reset-flow";

export async function POST(request: NextRequest) {
  try {
    // Жёсткий rate-limit: 3 запроса в минуту, 10 в час с одного IP
    const minRl = checkRateLimit(request, "pwd-reset-min", { limit: 3, windowMs: 60_000 });
    if (!minRl.ok) return rateLimited(minRl);
    const hourRl = checkRateLimit(request, "pwd-reset-hour", { limit: 10, windowMs: 3_600_000 });
    if (!hourRl.ok) return rateLimited(hourRl);

    const body = await request.json().catch(() => ({}));
    const email = asEmail(body.email);

    if (!email) {
      // Намеренно одинаковое сообщение для невалидного email
      return NextResponse.json({ success: true });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    // ВАЖНО: возвращаем success=true даже если пользователя нет —
    // защита от user enumeration. Атакующий не должен узнать, кто зарегистрирован.
    if (user?.email) {
      const code = issueCode(user.id, RESET_ACTION);
      try {
        await sendVerificationEmail({
          to: user.email,
          code,
          action: "reset-password",
        });
      } catch (e) {
        console.error("[reset-password] email send failed");
      }
    } else {
      // Симулируем задержку, чтобы не было таймингового различия
      await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "reset-password-init");
  }
}

/**
 * Применяет новый пароль после успешной верификации кода.
 */
export async function PATCH(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, "pwd-reset-apply", { limit: 5, windowMs: 60_000 });
    if (!rl.ok) return rateLimited(rl);

    const body = await request.json().catch(() => ({}));
    const email = asEmail(body.email);
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!email) return badRequest("Некорректный email");
    if (!code) return badRequest("Введите код");
    if (!newPassword || newPassword.length < LIMITS.PASSWORD_MIN || newPassword.length > LIMITS.PASSWORD_MAX) {
      return badRequest(`Пароль должен быть от ${LIMITS.PASSWORD_MIN} до ${LIMITS.PASSWORD_MAX} символов`);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // Generic ошибка чтобы не раскрывать существование пользователя
    if (!user) {
      // Делаем dummy bcrypt чтобы время ответа было похожим
      await bcrypt.hash("dummy_value_for_timing", 12);
      return badRequest("Неверный код или email");
    }

    const v = verifyCode(user.id, RESET_ACTION, code);
    if (!v.ok) {
      const msg =
        v.reason === "expired" ? "Код истёк, запросите новый"
          : v.reason === "too_many_attempts" ? "Превышено число попыток"
          : v.reason === "not_found" ? "Запросите код заново"
          : "Неверный код";
      return badRequest(msg);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "reset-password-apply");
  }
}

// Удаляем старый небезопасный handler (был POST { email, newPassword } без проверок)
// Прямой POST без code теперь не работает — можно только запросить код через POST { email }
// Если пользователь не уверен в новой схеме, возвращаем понятную ошибку:
export const PUT = undefined;
export const DELETE = undefined;

void crypto; // на случай если потребуется в будущем; убирает unused warning
