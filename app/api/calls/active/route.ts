import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/api/user";

export const dynamic = "force-dynamic";

const STREAM_CALL_TYPE = "default";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const call = await prisma.call.findFirst({
      where: {
        status: { in: ["RINGING", "ACTIVE"] },
        chat: { users: { some: { id: user.id } } },
      },
      include: {
        createdBy: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        chat: {
          select: {
            name: true,
            users: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!call) {
      return NextResponse.json({ hasCall: false });
    }

    const streamCallId = call.streamCallId;
    const callId = streamCallId.includes(":")
      ? streamCallId.split(":").slice(1).join(":")
      : streamCallId;

    const chatName =
      call.chat.name ||
      call.chat.users.find((chatUser) => chatUser.id !== user.id)?.displayName ||
      call.chat.users.find((chatUser) => chatUser.id !== user.id)?.username ||
      "Личный чат";

    const payload = {
      callId,
      streamCallType: STREAM_CALL_TYPE,
      type: call.type === "AUDIO" ? "audio" : "video",
      chatId: call.chatId,
      chatName,
      from: {
        id: call.createdBy.id,
        username: call.createdBy.username,
        displayName: call.createdBy.displayName,
        avatarUrl: call.createdBy.avatarUrl ?? null,
      },
      createdAt: call.createdAt.toISOString(),
    };

    const role = call.createdById === user.id ? "outgoing" : "incoming";
    return NextResponse.json({ hasCall: true, role, payload });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Failed to get active call" },
      { status: 500 },
    );
  }
}
