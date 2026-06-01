import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { hashSessionToken, parseDeviceInfo, getClientIp } from "@/app/lib/sessions";

/**
 * POST /api/auth/sessions/touch
 *
 * Поведение:
 *   - 200 created  → запись Session создана впервые (после signIn)
 *   - 200 ok       → запись существует, не отозвана, lastActiveAt обновлён
 *   - 401 revoked  → запись существует но revokedAt != null → клиент должен signOut
 *   - 401 unauth   → нет NextAuth-сессии
 *
 * Связка с jwt.sid:
 *   В auth.ts callbacks.jwt() при signIn выставляется token.sid (random hex).
 *   Этот sid живёт всю жизнь куки. Каждой куке соответствует одна Session
 *   запись с tokenHash = sha256("web_" + sid). Удалить запись можно через
 *   DELETE /api/mobile/auth/sessions/[id] — она помечается revokedAt,
 *   следующий touch вернёт 401 и веб-клиент вылогинится.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sid = (session as any).sid as string | undefined;
  if (!sid) {
    // Старая кука без sid (выпущена до релиза этой фичи) — пропускаем.
    return NextResponse.json({ success: true, legacy: true });
  }

  const tokenHash = hashSessionToken(`web_${sid}`);
  const ua = req.headers.get("user-agent") || "";
  const { deviceType, deviceName } = parseDeviceInfo(ua);
  const ipAddress = getClientIp(req);

  const existing = await prisma.session.findUnique({ where: { tokenHash } });

  // Сессия отозвана → 401 → клиент signOut
  if (existing?.revokedAt) {
    return NextResponse.json({ error: "Session revoked" }, { status: 401 });
  }

  if (!existing) {
    // Первый touch после signIn — создаём запись
    try {
      await prisma.session.create({
        data: {
          userId: session.user.id,
          tokenHash,
          deviceType,
          deviceName,
          ipAddress,
          userAgent: ua.slice(0, 500),
          expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      });
      return NextResponse.json({ success: true, created: true, tokenHash });
    } catch (e: any) {
      if (e?.code !== "P2002") {
        console.error("[sessions/touch] create failed:", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      // Гонка — параллельный запрос успел создать. Это ок.
    }
  }

  // Защита от подмены sid
  if (existing && existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Обновляем lastActiveAt не чаще раза в минуту
  if (existing) {
    const minuteAgo = new Date(Date.now() - 60 * 1000);
    if (existing.lastActiveAt < minuteAgo) {
      await prisma.session
        .update({
          where: { id: existing.id },
          data: { lastActiveAt: new Date() },
        })
        .catch(() => {});
    }
  }

  return NextResponse.json({ success: true, tokenHash });
}
