import { NextRequest, NextResponse } from "next/server";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { chatId } = await req.json();
    if (!chatId) {
      return NextResponse.json(
        { success: false, error: "chatId is required" },
        { status: 400 }
      );
    }

    const canAccess = await prisma.chat.findFirst({
      where: {
        id: chatId,
        users: { some: { id: user.id } },
      },
      select: { id: true },
    });

    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: "Chat not found or access denied" },
        { status: 403 }
      );
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId,
        userId: { not: user.id },
        readReceipts: { none: { userId: user.id } },
      },
      select: { id: true },
    });

    if (!messages.length) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const result = await prisma.$transaction(
      messages.map((message) =>
        prisma.readReceipt.create({
          data: {
            messageId: message.id,
            userId: user.id,
            chatId,
          },
        })
      )
    );

    await pusherServer.trigger(chatId, "messages-read", {
      userId: user.id,
      messageIds: messages.map((m) => m.id),
      readAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}