import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/api/user";
import { buildIceConfig } from "@/app/lib/ice-config";

export const dynamic = "force-dynamic";

/**
 * Возвращает ICE-конфигурацию (STUN/TURN) для WebRTC-звонков.
 * Креды читаются из .env, так что никакие секреты не попадают в клиентский бандл.
 *
 * Переменные окружения:
 *   - TURN_URLS         (через запятую, например: "turn:turn.example.com:3478,turn:turn.example.com:443?transport=tcp")
 *   - TURN_USERNAME
 *   - TURN_CREDENTIAL
 *   - STUN_URLS         (опционально, через запятую; по умолчанию используются Google STUN)
 *
 * Если TURN_* не заданы — отдаём только STUN (звонки между «удобными» NAT-ами
 * будут работать, за симметричным NAT — нет; в лог пишется warning).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const config = buildIceConfig();
    return NextResponse.json({ success: true, ...config });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Failed to load ICE config" },
      { status: 500 },
    );
  }
}
