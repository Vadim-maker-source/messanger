import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const chatId = request.nextUrl.searchParams.get("chatId");
    if (!chatId) {
      return NextResponse.json({ success: false, error: "chatId is required" }, { status: 400 });
    }

    const call = await prisma.call.findFirst({
      where: {
        chatId,
        status: { in: ["RINGING", "ACTIVE"] },
        chat: { users: { some: { id: user.id } } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    if (!call) {
      return NextResponse.json({ success: true, hasCall: false });
    }

    return NextResponse.json({
      success: true,
      hasCall: true,
      call: {
        id: call.id,
        callId: call.streamCallId.replace(/^default:/, ""),
        status: call.status,
        type: call.type === "AUDIO" ? "audio" : "video",
        from: call.createdBy,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load active call" },
      { status: 500 }
    );
  }
}
