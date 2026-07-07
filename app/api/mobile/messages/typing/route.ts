import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { asId, unauthorized, badRequest, forbidden, errorResponse } from "@/app/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const chatId = asId(body.chatId);
    const isTyping = body.isTyping === true;

    if (!chatId) return badRequest("chatId required");

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, users: { some: { id: user.id } } },
      select: { id: true },
    });

    if (!chat) return forbidden("Chat not found or access denied");

    await pusherServer.trigger(chatId, isTyping ? "typing-start" : "typing-stop", {
      userId: user.id,
      displayName: user.displayName || user.username,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "mobile-typing");
  }
}
