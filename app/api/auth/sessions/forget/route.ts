import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { hashSessionToken } from "@/app/lib/sessions";

/**
 * POST /api/auth/sessions/forget
 *
 * Удаляет запись о текущей web-сессии перед signOut().
 * При отзыве с другого устройства используется DELETE на
 * /api/mobile/auth/sessions/[id] (soft-delete с revokedAt).
 * Здесь — физическое удаление, потому что юзер сам уходит
 * и ему не нужно потом получать 401.
 */
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: true });
  }

  const sid = (session as any).sid as string | undefined;
  if (!sid) {
    return NextResponse.json({ success: true, legacy: true });
  }

  const tokenHash = hashSessionToken(`web_${sid}`);

  try {
    await prisma.session.deleteMany({ where: { tokenHash } });
  } catch (e) {
    console.error("[sessions/forget] failed:", e);
  }

  return NextResponse.json({ success: true });
}
