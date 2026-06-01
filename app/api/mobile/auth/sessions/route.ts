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

  // Lazy backfill — если текущая сессия не записана в БД, создаём
  if (currentHash) {
    const exists = await prisma.session.findUnique({
      where: { tokenHash: currentHash },
    });
    if (!exists) {
      const ua = req.headers.get("user-agent") || "";
      const { deviceType, deviceName } = parseDeviceInfo(ua);
      try {
        await prisma.session.create({
          data: {
            userId: user.id,
            tokenHash: currentHash,
            deviceType: deviceType === "mobile" ? "mobile" : "mobile",
            deviceName,
            ipAddress: getClientIp(req),
            userAgent: ua.slice(0, 500),
            expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
          },
        });
      } catch (e) {
        console.error("[sessions] backfill failed:", e);
      }
    } else {
      // Обновляем lastActiveAt раз в 5 минут (не на каждый запрос)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (exists.lastActiveAt < fiveMinAgo) {
        prisma.session
          .update({
            where: { id: exists.id },
            data: { lastActiveAt: new Date() },
          })
          .catch(() => {});
      }
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
