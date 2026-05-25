import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { pusherServer } from "@/app/lib/pusher";


export async function POST(request: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const chatId = String(body.chatId || "");
    const type = body.type === "audio" ? "audio" : "video";
    if (!chatId) {
      return NextResponse.json({ success: false, error: "chatId is required" }, { status: 400 });
    }

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        users: { some: { id: user.id } },
      },
      include: {
        users: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, fcmToken: true },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ success: false, error: "Chat not found" }, { status: 404 });
    }

    const callId = `chat_${chatId}_${Date.now()}`;
    await prisma.call.create({
      data: {
        chatId,
        createdById: user.id,
        status: "RINGING",
        type: type === "audio" ? "AUDIO" : "VIDEO",
        streamCallId: callId,
      },
    });

    // === PUSHER ===
    const payload = {
      callId,
      type,
      chatId,
      peerId: chat.users.find((u) => u.id !== user.id)?.id || null,
      from: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
      },
      createdAt: new Date().toISOString(),
    };

    // Исходящий — отправителю
    const chatNameForCreator =
      chat.name ||
      chat.users.find((chatUser) => chatUser.id !== user.id)?.displayName ||
      chat.users.find((chatUser) => chatUser.id !== user.id)?.username ||
      "Личный чат";

    pusherServer.trigger(`user-${user.id}`, "outgoing-call", {
      ...payload,
      chatName: chatNameForCreator,
    }).catch(() => {});

    return NextResponse.json({ success: true, callId, type });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to start call" },
      { status: 500 }
    );
  }
}