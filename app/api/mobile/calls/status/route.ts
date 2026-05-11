import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

const ALLOWED_STATUSES = new Set(["ACTIVE", "ENDED", "DECLINED"]);

export async function PATCH(request: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const callId = String(body.callId || "").trim();
    const status = String(body.status || "").trim().toUpperCase();
    if (!callId || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const streamCallId = `default:${callId}`;
    const existing = await prisma.call.findFirst({
      where: {
        streamCallId,
        chat: { users: { some: { id: user.id } } },
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Call not found" }, { status: 404 });
    }

    const updated = await prisma.call.update({
      where: { id: existing.id },
      data: { status: status as "ACTIVE" | "ENDED" | "DECLINED" },
      select: { id: true, status: true },
    });

    return NextResponse.json({ success: true, call: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update call status" },
      { status: 500 }
    );
  }
}
