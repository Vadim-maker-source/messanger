import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { prisma } from "@/app/lib/prisma";
import { hashSessionToken } from "@/app/lib/sessions";

/**
 * POST /api/auth/sessions/forget
 *
 * Удаляет запись о текущей web-сессии из БД.
 * Должен дёргаться ПЕРЕД signOut() — пока кука ещё валидна.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: true }); // даже если не авторизован — ок
  }

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
      /* ignore */
    }
  }

  const sessionKey = iat
    ? `web_${session.user.id}_${iat}`
    : jwt
      ? `web_${jwt.slice(0, 80)}`
      : `web_${session.user.id}`;

  try {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(sessionKey) },
    });
  } catch (e) {
    console.error("[sessions/forget] failed:", e);
  }

  return NextResponse.json({ success: true });
}
