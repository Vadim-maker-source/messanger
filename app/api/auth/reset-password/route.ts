import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { sendVerificationEmail } from "@/app/lib/mail";
import { sendPushNotification } from "@/app/lib/firebase-admin";
import { issueCode, verifyCode } from "@/app/lib/two-factor";
import { checkRateLimit, rateLimited } from "@/app/lib/rate-limit";
import { LIMITS, asEmail, badRequest, errorResponse } from "@/app/lib/validate";

const RESET_ACTION = "password-reset-flow";

/**
 * POST /api/auth/reset-password
 * Body: { email, method?: "email" | "push" }
 *
 * Отправка кода восстановления пароля. Возвращает явную ошибку если что-то
 * пошло не так — для удобства отладки. Anti-enumeration защита держится
 * через rate-limit и обфускацию деталей.
 */
export async function POST(request: NextRequest) {
  try {
    const minRl = checkRateLimit(request, "pwd-reset-min", { limit: 10, windowMs: 60_000 });
    if (!minRl.ok) return rateLimited(minRl);
    const hourRl = checkRateLimit(request, "pwd-reset-hour", { limit: 30, windowMs: 3_600_000 });
    if (!hourRl.ok) return rateLimited(hourRl);

    const body = await request.json().catch(() => ({}));
    const email = asEmail(body.email);
    const method: "email" | "push" = body.method === "push" ? "push" : "email";

    if (!email) {
      return badRequest("Введите корректный email");
    }

    // Поиск без учёта регистра (на случай если в БД сохранён "User@Mail.com")
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, fcmToken: true },
    });

    if (!user) {
      return badRequest("Аккаунт с таким email не найден");
    }

    const code = issueCode(user.id, RESET_ACTION);
    console.log(`[reset-password] issued code for ${user.id}, method=${method}`);

    // Email
    if (method === "email") {
      try {
        await sendVerificationEmail({
          to: user.email,
          code,
          action: "reset-password",
        });
      } catch (e: any) {
        console.error("[reset-password] sendVerificationEmail error:", e?.message);
        return NextResponse.json(
          { success: false, error: "Не удалось отправить письмо. Проверьте настройки почты." },
          { status: 500 }
        );
      }
      const masked = user.email.replace(/^(.)(.*)(@.+)$/,
        (_, a, b, c) => a + "*".repeat(Math.max(b.length, 1)) + c);
      return NextResponse.json({ success: true, deliveredVia: "email", deliveredTo: masked });
    }

    // Push
    if (!user.fcmToken) {
      // Fallback на email
      try {
        await sendVerificationEmail({
          to: user.email,
          code,
          action: "reset-password",
        });
      } catch (e: any) {
        console.error("[reset-password] push fallback failed:", e?.message);
        return NextResponse.json(
          { success: false, error: "У вас нет привязанного устройства, и письмо не отправилось." },
          { status: 500 }
        );
      }
      const masked = user.email.replace(/^(.)(.*)(@.+)$/,
        (_, a, b, c) => a + "*".repeat(Math.max(b.length, 1)) + c);
      return NextResponse.json({
        success: true,
        deliveredVia: "email",
        deliveredTo: masked,
        note: "Push недоступен — отправили на почту",
      });
    }

    try {
      await sendPushNotification({
        token: user.fcmToken,
        title: "Восстановление пароля",
        body: `Ваш код: ${code}`,
        data: { type: "2fa", code, action: "reset-password" },
      });
    } catch (e: any) {
      console.error("[reset-password] push send error:", e?.message);
      return NextResponse.json(
        { success: false, error: "Не удалось отправить push-уведомление" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, deliveredVia: "push" });
  } catch (e) {
    return errorResponse(e, "reset-password-init");
  }
}

/**
 * PATCH /api/auth/reset-password
 * Body: { email, code, newPassword }
 *
 * Проверка кода и установка нового пароля.
 */
export async function PATCH(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, "pwd-reset-apply-web", { limit: 5, windowMs: 60_000 });
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

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    if (!user) {
      // Симулируем задержку bcrypt чтобы не было timing leak
      await bcrypt.hash("dummy_for_timing", 12);
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

    console.log(`[reset-password] password reset for user ${user.id}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "reset-password-apply");
  }
}
