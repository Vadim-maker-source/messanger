import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

// PATCH /api/mobile/users/status  { isOnline }
export async function PATCH(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { isOnline } = await req.json();
    if (typeof isOnline !== "boolean") return NextResponse.json({ success: false, error: "isOnline (boolean) required" }, { status: 400 });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isOnline, lastActive: new Date() },
      select: { id: true, isOnline: true, lastActive: true },
    });

    await pusherServer.trigger("presence", "user-status-change", {
      userId: updated.id,
      isOnline: updated.isOnline,
      lastActive: updated.lastActive,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
