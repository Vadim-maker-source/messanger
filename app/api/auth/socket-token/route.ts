import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/api/user";
import { generateToken } from "@/app/lib/token";

export const dynamic = "force-dynamic";

/**
 * Возвращает короткоживущий JWT для аутентификации Socket.io-подключения.
 * Web-клиент дёргает его при инициализации сокета и передаёт в `auth.token`.
 *
 * Mobile использует свой Bearer-токен напрямую — этот endpoint только для web,
 * так как у него NextAuth-сессия в куках, а не JWT.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = generateToken(user.id, user.email);
  return NextResponse.json({ token, userId: user.id });
}
