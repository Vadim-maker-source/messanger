import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { messageId, targetChatId } = await req.json();
    if (!messageId || !targetChatId)
      return NextResponse.json({ success: false, error: "messageId and targetChatId required" }, { status: 400 });

    const original = await prisma.message.findUnique({
      where: { id: messageId },
      include: { user: true, chat: true },
    });
    if (!original) return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 });

    const sourceName = original.chat.name || (original.chat.type === "PRIVATE" ? "Личный чат" : "Чат");

    const forwarded = await prisma.message.create({
      data: {
        content: original.content,
        fileUrl: original.fileUrl,
        fileType: original.fileType,
        userId: user.id,
        chatId: targetChatId,
        forwardedFromMessageId: original.id,
        forwardedFromChatId: original.chatId,
        forwardedFromChatName: sourceName,
        forwardedFromChatType: original.chat.type,
        forwardedFromUserId: original.userId,
        forwardedFromUserName: original.user.displayName || original.user.username,
      },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });

    await pusherServer.trigger(targetChatId, "new-message", forwarded);
    return NextResponse.json({ success: true, data: forwarded });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
