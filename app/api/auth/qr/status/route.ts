import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/auth/qr/status?token=xxx
 *
 * Web polling. Возвращает текущий статус QR-попытки:
 *   PENDING   — ждёт сканирования
 *   SCANNED   — отсканирован, ждёт подтверждения
 *   APPROVED  — подтверждён, можно создавать сессию (web должен вызвать /finalize)
 *   EXPIRED   — токен протух
 *   CANCELLED — пользователь отказался на мобиле
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const attempt = await prisma.qrLoginAttempt.findUnique({
    where: { token },
    select: {
      status: true,
      expiresAt: true,
      userId: true,
    },
  });

  if (!attempt) {
    return NextResponse.json({ status: "EXPIRED" });
  }

  // Просрочен по времени? Помечаем
  if (attempt.expiresAt < new Date() && attempt.status === "PENDING") {
    await prisma.qrLoginAttempt.update({
      where: { token },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ status: "EXPIRED" });
  }

  return NextResponse.json({
    status: attempt.status,
    // userId не отдаём — finalize создаёт сессию по токену сам
  });
}
