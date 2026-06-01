import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { getClientIp } from "@/app/lib/sessions";

/**
 * POST /api/mobile/auth/qr/approve
 * Body: { token, approve: true|false }
 * Auth: Bearer mobile JWT
 *
 * Шаг 2: пользователь подтвердил/отказался на мобиле.
 * При approve мобила привязывает свой userId к QR-токену.
 * Web на следующем polling'е увидит APPROVED и завершит логин.
 */
export async function POST(req: NextRequest) {
  const user = await getMobileUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = (body.token || "").toString();
  const approve = body.approve === true;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const attempt = await prisma.qrLoginAttempt.findUnique({ where: { token } });
  if (!attempt) return NextResponse.json({ error: "Не найден" }, { status: 404 });
  if (attempt.expiresAt < new Date()) {
    return NextResponse.json({ error: "QR просрочен" }, { status: 400 });
  }
  if (attempt.status === "APPROVED" || attempt.status === "CANCELLED") {
    return NextResponse.json({ error: "Уже использован" }, { status: 400 });
  }

  if (!approve) {
    await prisma.qrLoginAttempt.update({
      where: { token },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ success: true });
  }

  await prisma.qrLoginAttempt.update({
    where: { token },
    data: {
      status: "APPROVED",
      userId: user.id,
      approvedAt: new Date(),
      approvedFromIp: getClientIp(req),
    },
  });

  return NextResponse.json({ success: true });
}
