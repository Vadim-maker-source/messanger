import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/api/user";
import { pusherServer } from "@/app/lib/pusher";


export const dynamic = "force-dynamic";

type StartCallBody = {
  chatId: string;
  type: "audio" | "video";
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Partial<StartCallBody>;
    const chatId = String(body.chatId || "");
    const type = body.type === "audio" ? "audio" : "video";

    if (!chatId) {
      return NextResponse.json({ message: "chatId is required" }, { status: 400 });
    }

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, users: { some: { id: user.id } } },
      include: {
        users: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, fcmToken: true },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ message: "Chat not found" }, { status: 404 });
    }

    const callId = `chat_${chatId}_${Date.now()}`;

    await (prisma as any).call.create({
      data: {
        chatId,
        createdById: user.id,
        type: type === "audio" ? "AUDIO" : "VIDEO",
        status: "RINGING",
        streamCallId: callId,
      },
    });

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

    const chatNameForCreator =
      chat.name ||
      chat.users.find((chatUser) => chatUser.id !== user.id)?.displayName ||
      chat.users.find((chatUser) => chatUser.id !== user.id)?.username ||
      "Личный чат";

    pusherServer.trigger(`user-${user.id}`, "outgoing-call", {
      ...payload,
      chatName: chatNameForCreator,
    }).catch(() => {});

    return NextResponse.json({ callId, type });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Failed to start call" },
      { status: 500 },
    );
  }
}