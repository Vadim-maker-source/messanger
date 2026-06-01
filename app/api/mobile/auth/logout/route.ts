import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { hashSessionToken } from "@/app/lib/sessions";

/**
 * POST /api/mobile/auth/logout
 * Auth: Bearer mobile JWT
 *
 * Удаляет запись Session текущего устройства из БД.
 * Сам JWT остаётся валидным до истечения, но в "Устройства" уже не появится.
 *
 * Не требует расшифровки JWT — мы хешируем raw-токен и удаляем
 * запись по hash (один dependency-call вместо двух).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const rawToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!rawToken) {
    return NextResponse.json({ success: true });
  }

  try {
    const tokenHash = hashSessionToken(rawToken);
    await prisma.session
      .deleteMany({ where: { tokenHash } })
      .catch(() => {});
  } catch (e) {
    console.error("[logout] error:", e);
  }

  return NextResponse.json({ success: true });
}
