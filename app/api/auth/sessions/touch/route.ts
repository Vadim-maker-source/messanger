import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { prisma } from "@/app/lib/prisma";
import { hashSessionToken, parseDeviceInfo, getClientIp } from "@/app/lib/sessions";

/**
 * POST /api/auth/sessions/touch
 *
 * Регистрирует/обновляет запись Session для текущего web-юзера.
 * Дёргается из layout (chat)/layout.tsx один раз при монтировании,
 * после успешного NextAuth signIn.
 *
 * tokenHash формируется из (userId + iat) — это уникальный идентификатор
 * конкретной выпущенной NextAuth-куки. При логауте из NextAuth кука
 * протухнет, при следующем логине будет другой `iat` → новая запись.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Достаём raw JWT из куки чтобы получить iat — он уникальный
  // для каждой выпущенной сессии (даже при повторном signIn для
  // того же юзера будет другой iat).
  const cookieStore = await cookies();
  const jwt =
    cookieStore.get("__Secure-next-auth.session-token")?.value ||
    cookieStore.get("next-auth.session-token")?.value;

  let iat: number | undefined;
  if (jwt) {
    try {
      const decoded = await decode({
        token: jwt,
        secret: process.env.NEXTAUTH_SECRET!,
      });
      iat = typeof decoded?.iat === "number" ? decoded.iat : undefined;
    } catch {
      /* ignore — fallback ниже */
    }
  }

  // Если iat не получили — используем хеш самого JWT (тоже уникален).
  // Если и этого нет — использовать userId + 'web' (одна сессия на юзера, не идеально).
  const sessionKey = iat
    ? `web_${session.user.id}_${iat}`
    : jwt
      ? `web_${jwt.slice(0, 80)}`
      : `web_${session.user.id}`;

  const tokenHash = hashSessionToken(sessionKey);

  const ua = req.headers.get("user-agent") || "";
  const { deviceType, deviceName } = parseDeviceInfo(ua);
  const ipAddress = getClientIp(req);

  try {
    await prisma.session.upsert({
      where: { tokenHash },
      create: {
        userId: session.user.id,
        tokenHash,
        deviceType,
        deviceName,
        ipAddress,
        userAgent: ua.slice(0, 500),
        // NextAuth-сессия живёт 30 дней
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
      update: {
        // Обновляем имя устройства и lastActive — на случай смены браузера/UA
        deviceName,
        deviceType,
        ipAddress,
        userAgent: ua.slice(0, 500),
        lastActiveAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[sessions/touch] failed:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
