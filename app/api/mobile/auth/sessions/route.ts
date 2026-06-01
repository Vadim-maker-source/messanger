import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

/**
 * GET /api/mobile/auth/sessions
 * Auth: Bearer mobile JWT
 *
 * Список всех устройств юзера с возможностью отозвать.
 * Используется в Settings → Устройства (Flutter).
 */
export async function GET(req: NextRequest) {
  const user = await getMobileUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
