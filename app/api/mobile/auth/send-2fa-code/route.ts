import { NextRequest, NextResponse } from "next/server";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { sendPushNotification } from "@/app/lib/firebase-admin";
import { pusherServer } from "@/app/lib/pusher";
import { sendVerificationEmail } from "@/app/lib/mail";
import { prisma } from "@/app/lib/prisma";
import { issueCode } from "@/app/lib/two-factor";
import { checkRateLimit, rateLimited } from "@/app/lib/rate-limit";
import { unauthorized, badRequest, errorResponse } from "@/app/lib/validate";

/**
 * POST /api/mobile/auth/send-2fa-code
 * Body: { action?: string, method?: "push" | "email" }
 *
 * Сервер сам генерирует криптографически случайный код, сохраняет его с TTL
 * и отправляет на устройство пользователя через push или email.
 *
 * КЛИЕНТ НЕ ЗНАЕТ КОД — это ключевая защита: 2FA не может быть подделана.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(request);
    if (!user) return unauthorized();

    // Rate limit: 3 запроса в минуту, 10 в час — чтобы избежать спама пушей/email
    const minRl = checkRateLimit(request, "2fa-min", { limit: 3, windowMs: 60_000 }, user.id);
    if (!minRl.ok) return rateLimited(minRl);
    const hourRl = checkRateLimit(request, "2fa-hour", { limit: 10, windowMs: 3_600_000 }, user.id);
    if (!hourRl.ok) return rateLimited(hourRl);

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "verify";
    const method = body.method === "email" ? "email" : "push";

    // Сервер генерирует и хранит код. Клиент его не видит.
    const code = issueCode(user.id, action);

    const actionLabel =
      action === "change-password" ? "Подтверждение смены пароля"
        : action === "reset-password" ? "Восстановление пароля"
        : "Код подтверждения";

    if (method === "email") {
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true },
      });
      if (!userData?.email) {
        return badRequest("У аккаунта не указан email");
      }

      try {
        await sendVerificationEmail({ to: userData.email, code, action });
      } catch (e: any) {
        console.error("[send-2fa-code] email failed");
        return NextResponse.json(
          { success: false, error: "Не удалось отправить письмо" },
          { status: 500 }
        );
      }

      const masked = userData.email.replace(/^(.)(.*)(@.+)$/,
        (_, a, b, c) => a + "*".repeat(Math.max(b.length, 1)) + c);
      return NextResponse.json({ success: true, deliveredTo: masked });
    }

    // method === "push"
    pusherServer.trigger(`user-${user.id}`, "2fa-code", { action }).catch(() => {});

    const userWithToken = await prisma.user.findUnique({
      where: { id: user.id },
      select: { fcmToken: true },
    });

    if (userWithToken?.fcmToken) {
      sendPushNotification({
        token: userWithToken.fcmToken,
        title: actionLabel,
        body: `Ваш код: ${code}`,
        data: { type: "2fa", code, action },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "send-2fa-code");
  }
}
