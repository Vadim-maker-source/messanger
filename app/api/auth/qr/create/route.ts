import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { generateQrToken, parseDeviceInfo, getClientIp, QR_TTL_SECONDS } from "@/app/lib/sessions";

/**
 * POST /api/auth/qr/create
 *
 * Web вызывает при открытии страницы /sign-in/qr.
 * Возвращает токен который нужно закодировать в QR-код.
 * Токен живёт 90 секунд — после нужно создать новый.
 */
export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const ip = getClientIp(req);
  const { deviceName } = parseDeviceInfo(ua);

  const token = generateQrToken();
  const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000);

  await prisma.qrLoginAttempt.create({
    data: {
      token,
      status: "PENDING",
      webDeviceName: deviceName,
      webIp: ip,
      webUserAgent: ua.slice(0, 500),
      expiresAt,
    },
  });

  // Чистим протухшие попытки в фоне (best-effort)
  prisma.qrLoginAttempt
    .deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
    })
    .catch(() => {});

  return NextResponse.json({
    token,
    expiresAt: expiresAt.toISOString(),
    ttlSeconds: QR_TTL_SECONDS,
  });
}
