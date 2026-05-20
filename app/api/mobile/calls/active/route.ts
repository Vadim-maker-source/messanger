import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

const STREAM_CALL_TYPE = "default";

export async function GET(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const call = await prisma.call.findFirst({
      where: {
        status: { in: ["RINGING", "ACTIVE"] },
        chat: { users: { some: { id: user.id } } },
        createdById: { not: user.id }, // только входящие
      },
      include: {
        createdBy: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        chat: {
          select: {
            id: true,
            name: true,
            users: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!call) return NextResponse.json({ success: true, hasCall: false });

    const callId = call.streamCallId.includes(":")
      ? call.streamCallId.split(":").slice(1).join(":")
      : call.streamCallId;

    const chatName =
      call.chat.name ||
      call.chat.users.find((u) => u.id !== user.id)?.displayName ||
      "Звонок";

    return NextResponse.json({
      success: true,
      hasCall: true,
      call: {
        callId,
        callType: call.type === "AUDIO" ? "audio" : "video",
        chatId: call.chat.id,
        chatName,
        callerName: call.createdBy.displayName || call.createdBy.username,
        callerId: call.createdBy.id,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
