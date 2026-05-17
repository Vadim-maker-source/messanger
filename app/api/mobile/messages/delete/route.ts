import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export async function DELETE(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { messageId } = await req.json();
    if (!messageId) return NextResponse.json({ success: false, error: "messageId required" }, { status: 400 });

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: { include: { server: true } } },
    });
    if (!message) return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 });

    const isAuthor = message.userId === user.id;
    const isOwner = message.chat.serverId ? message.chat.server?.ownerId === user.id : false;
    if (!isAuthor && !isOwner) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    await prisma.message.delete({ where: { id: messageId } });
    await pusherServer.trigger(message.chatId, "message-deleted", messageId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
