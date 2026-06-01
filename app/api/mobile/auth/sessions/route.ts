import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { hashSessionToken, parseDeviceInfo, getClientIp } from "@/app/lib/sessions";

/**
 * GET /api/mobile/auth/sessions
 * Auth: Bearer mobile JWT
 *
 * Список активных сессий юзера. При первом запросе автоматически
 * создаёт запись о текущей сессии (lazy backfill для юзеров,
 * залогинившихся до релиза этой фичи).
 */
export async function GET(req: NextRequest) {
  const user = await getMobileUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authHeader = req.headers.get("authorization") || "";
  const rawToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const currentHash = rawToken ? hashSessionToken(rawToken) : null;

  // Lazy backfill — если текущая сессия не записана в БД, создаём.
  // Делаем upsert чтобы избежать гонки между параллельными запросами.
  if (currentHash) {
    try {
      const ua = req.headers.get("user-agent") || "";
      const customName = req.headers.get("x-device-name");
      const { deviceType, deviceName } = parseDeviceInfo(ua, customName);
      await prisma.session.upsert({
        where: { tokenHash: currentHash },
        create: {
          userId: user.id,
          tokenHash: currentHash,
          deviceType,
          deviceName,
          ipAddress: getClientIp(req),
          userAgent: ua.slice(0, 500),
          expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
        },
        update: {
          // Если имя устройства теперь известно лучше — обновим
          deviceName,
          deviceType,
          lastActiveAt: new Date(),
        },
      });
    } catch (e) {
      console.error("[sessions] upsert failed:", e);
    }
  }

  const sessions = await prisma.session.findMany({
    where: {
      userId: user.id,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActiveAt: "desc" },
    select: {
      id: true,
      deviceType: true,
      deviceName: true,
      ipAddress: true,
      lastActiveAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return NextResponse.json({ sessions });
}
