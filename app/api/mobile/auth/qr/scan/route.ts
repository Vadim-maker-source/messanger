import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

/**
 * POST /api/mobile/auth/qr/scan
 * Body: { token }
 * Auth: Bearer mobile JWT
 *
 * Шаг 1: мобила отсканировала QR. Помечаем как SCANNED и возвращаем
 * информацию об устройстве которое логинится — мобила покажет diff
 * пользователю перед approve/cancel.
 */
export async function POST(req: NextRequest) {
  const user = await getMobileUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = (body.token || "").toString();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const attempt = await prisma.qrLoginAttempt.findUnique({
    where: { token },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Неверный QR-код" }, { status: 404 });
  }
  if (attempt.expiresAt < new Date()) {
    return NextResponse.json({ error: "QR-код просрочен" }, { status: 400 });
  }
  if (attempt.status === "APPROVED" || attempt.status === "CANCELLED") {
    return NextResponse.json({ error: "QR-код уже использован" }, { status: 400 });
  }

  // Помечаем как SCANNED
  await prisma.qrLoginAttempt.update({
    where: { token },
    data: { status: "SCANNED", scannedAt: new Date() },
  });

  return NextResponse.json({
    webDeviceName: attempt.webDeviceName,
    webIp: attempt.webIp,
    expiresAt: attempt.expiresAt.toISOString(),
  });
}
