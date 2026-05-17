import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

const STREAM_CALL_TYPE = "default";

// POST /api/mobile/calls/stream  { chatId, type: "audio"|"video" }
export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { chatId, type = "audio" } = await req.json();
    if (!chatId) return NextResponse.json({ success: false, error: "chatId required" }, { status: 400 });

    const callType = type === "video" ? "video" : "audio";

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, users: { some: { id: user.id } } },
      include: { users: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    if (!chat) return NextResponse.json({ success: false, error: "Chat not found" }, { status: 404 });

    const callId = `chat_${chatId}_${Date.now()}`;
    const streamCallId = `${STREAM_CALL_TYPE}:${callId}`;

    await (prisma as any).call.create({
      data: {
        chatId,
        createdById: user.id,
        type: callType === "audio" ? "AUDIO" : "VIDEO",
        status: "RINGING",
        streamCallId,
      },
    });

    const payload = {
      callId,
      streamCallType: STREAM_CALL_TYPE,
      type: callType,
      chatId,
      from: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl ?? null },
      createdAt: new Date().toISOString(),
    };

    const chatName = chat.name || chat.users.find((u) => u.id !== user.id)?.displayName || "Чат";

    await Promise.all([
      ...chat.users
        .filter((u) => u.id !== user.id)
        .map((u) => pusherServer.trigger(`user-${u.id}`, "incoming-call", { ...payload, chatName })),
      pusherServer.trigger(`user-${user.id}`, "outgoing-call", { ...payload, chatName }),
    ]);

    return NextResponse.json({ success: true, data: { callId, streamCallType: STREAM_CALL_TYPE } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
