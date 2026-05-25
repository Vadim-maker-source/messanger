import { NextRequest, NextResponse } from "next/server";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { buildIceConfig } from "@/app/lib/ice-config";

export const dynamic = "force-dynamic";

/**
 * Возвращает ICE-конфигурацию для мобильного клиента.
 * См. /api/calls/ice-config — логика общая.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const config = buildIceConfig();
    return NextResponse.json({ success: true, ...config });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load ICE config" },
      { status: 500 },
    );
  }
}
