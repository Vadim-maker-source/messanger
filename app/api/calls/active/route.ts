import { NextResponse } from "next/server";
import { StreamClient } from "@stream-io/node-sdk";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/api/user";

export const dynamic = "force-dynamic";

const STREAM_CALL_TYPE = "default";

async function getStreamParticipantCount(callId: string): Promise<number> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;
    if (!apiKey || !apiSecret) return -1;

    const client = new StreamClient(apiKey, apiSecret);
    const response = await client.video.getCall({
      type: STREAM_CALL_TYPE,
      id: callId,
    });
    return response.call?.session?.participants?.length ?? 0;
  } catch {
    // Звонок не существует в Stream — считаем пустым
    return 0;
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const calls = await prisma.call.findMany({
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

    if (calls.length === 0) {
      return NextResponse.json({ hasCall: false });
    }

    // Для ACTIVE звонков проверяем реальных участников через Stream API
    // Только для Stream-звонков (streamCallId начинается с "default:")
    const toEnd: string[] = [];
    let activeCall = null;

    for (const call of calls) {
      if (call.status === "ACTIVE") {
        const isStreamCall = call.streamCallId.startsWith("default:");
        if (isStreamCall) {
          const streamCallId = call.streamCallId.split(":").slice(1).join(":");
          const participants = await getStreamParticipantCount(streamCallId);
          if (participants === 0) {
            toEnd.push(call.id);
            continue;
          }
        }
        // WebRTC звонок — не проверяем через Stream API
      }
      if (!activeCall) activeCall = call;
    }

    // Завершаем пустые звонки
    if (toEnd.length > 0) {
      await prisma.call.updateMany({
        where: { id: { in: toEnd } },
        data: { status: "ENDED" },
      });
    }

    if (!activeCall) {
      return NextResponse.json({ hasCall: false });
    }

    const streamCallId = activeCall.streamCallId;
    const callId = streamCallId.includes(":")
      ? streamCallId.split(":").slice(1).join(":")
      : streamCallId;

    const chatName =
      activeCall.chat.name ||
      activeCall.chat.users.find((u) => u.id !== user.id)?.displayName ||
      activeCall.chat.users.find((u) => u.id !== user.id)?.username ||
      "Личный чат";

    const payload = {
      callId,
      streamCallType: STREAM_CALL_TYPE,
      type: activeCall.type === "AUDIO" ? "audio" : "video",
      chatId: activeCall.chatId,
      chatName,
      from: {
        id: activeCall.createdBy.id,
        username: activeCall.createdBy.username,
        displayName: activeCall.createdBy.displayName,
        avatarUrl: activeCall.createdBy.avatarUrl ?? null,
      },
      createdAt: activeCall.createdAt.toISOString(),
    };

    const role = activeCall.createdById === user.id ? "outgoing" : "incoming";
    return NextResponse.json({ hasCall: true, role, payload });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Failed to get active call" },
      { status: 500 },
    );
  }
}
