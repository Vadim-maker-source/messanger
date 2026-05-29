import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/api/user";
import { sendPushNotification } from "@/app/lib/firebase-admin";
import { pusherServer } from "@/app/lib/pusher";
import { sendVerificationEmail } from "@/app/lib/mail";
import { prisma } from "@/app/lib/prisma";
import { issueCode } from "@/app/lib/two-factor";
import { checkRateLimit, rateLimited } from "@/app/lib/rate-limit";
import { unauthorized, badRequest, errorResponse } from "@/app/lib/validate";

/**
 * POST /api/auth/send-2fa-code
 * Body: { action?: string, method?: "push" | "email" }
 *
 * Сервер генерирует и хранит код. Клиент его не видит.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const minRl = checkRateLimit(request, "2fa-min", { limit: 3, windowMs: 60_000 }, user.id);
    if (!minRl.ok) return rateLimited(minRl);
    const hourRl = checkRateLimit(request, "2fa-hour", { limit: 10, windowMs: 3_600_000 }, user.id);
    if (!hourRl.ok) return rateLimited(hourRl);

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "verify";
    const method = body.method === "email" ? "email" : "push";

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
      if (!userData?.email) return badRequest("У аккаунта не указан email");

      try {
        await sendVerificationEmail({ to: userData.email, code, action });
      } catch {
        return NextResponse.json(
          { success: false, error: "Не удалось отправить письмо" },
          { status: 500 }
        );
      }

      const masked = userData.email.replace(/^(.)(.*)(@.+)$/,
        (_, a, b, c) => a + "*".repeat(Math.max(b.length, 1)) + c);
      return NextResponse.json({ success: true, deliveredTo: masked });
    }

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
    return errorResponse(e, "send-2fa-code-web");
  }
}
