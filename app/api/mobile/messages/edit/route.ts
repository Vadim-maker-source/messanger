import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { messageId, content } = await req.json();
    if (!messageId || !content?.trim())
      return NextResponse.json({ success: false, error: "messageId and content required" }, { status: 400 });

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 });
    if (message.userId !== user.id) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content: content.trim(), updatedAt: new Date() },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });

    await pusherServer.trigger(message.chatId, "message-updated", updated);
    return NextResponse.json({ success: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
