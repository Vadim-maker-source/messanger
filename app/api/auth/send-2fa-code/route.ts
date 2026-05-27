import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/api/user";
import { sendPushNotification } from "@/app/lib/firebase-admin";
import { pusherServer } from "@/app/lib/pusher";
import { sendVerificationEmail } from "@/app/lib/mail";
import { prisma } from "@/app/lib/prisma";

/**
 * POST /api/auth/send-2fa-code
 * Принимает код от клиента и доставляет его пользователю выбранным способом.
 *
 * Body: { code: string, action?: string, method?: "push" | "email" }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { code, action, method } = await request.json();
    if (!code || typeof code !== "string" || code.length < 4) {
      return NextResponse.json({ success: false, error: "Invalid code" }, { status: 400 });
    }

    const deliveryMethod: "push" | "email" = method === "email" ? "email" : "push";
    const actionLabel =
      action === "change-password" ? "Подтверждение смены пароля"
        : action === "reset-password" ? "Восстановление пароля"
        : "Код подтверждения";

    if (deliveryMethod === "email") {
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true },
      });

      if (!userData?.email) {
        return NextResponse.json(
          { success: false, error: "У аккаунта не указан email" },
          { status: 400 }
        );
      }

      try {
        await sendVerificationEmail({ to: userData.email, code, action });
      } catch (e: any) {
        console.error("[send-2fa-code] email failed:", e?.message);
        return NextResponse.json(
          { success: false, error: "Не удалось отправить письмо" },
          { status: 500 }
        );
      }

      // Маскируем email для UI: a***@gmail.com
      const masked = userData.email.replace(/^(.)(.*)(@.+)$/, (_, a, b, c) => a + "*".repeat(Math.max(b.length, 1)) + c);
      return NextResponse.json({ success: true, deliveredTo: masked });
    }

    // method === "push"
    pusherServer.trigger(`user-${user.id}`, "2fa-code", { code, action }).catch(() => {});

    const userWithToken = await prisma.user.findUnique({
      where: { id: user.id },
      select: { fcmToken: true },
    });

    if (userWithToken?.fcmToken) {
      await sendPushNotification({
        token: userWithToken.fcmToken,
        title: actionLabel,
        body: `Ваш код: ${code}`,
        data: { type: "2fa", code, action: action || "verify" },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
