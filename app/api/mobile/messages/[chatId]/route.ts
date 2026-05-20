import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/app/lib/api/chat";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { prisma } from "@/app/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { chatId } = await params;
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

    const since = req.nextUrl.searchParams.get("since");

    const messages = since
      ? await prisma.message.findMany({
          where: { chatId, createdAt: { gt: new Date(since) } },
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            replyTo: {
              include: {
                user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : await getMessages(chatId);

    return NextResponse.json({
      success: true,
      data: messages
    });

  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}