import { NextRequest, NextResponse } from "next/server";
import { StreamClient } from "@stream-io/node-sdk";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

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
    return 0;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const calls = await prisma.call.findMany({
      where: {
        status: { in: ["RINGING", "ACTIVE"] },
        chat: { users: { some: { id: user.id } } },
        createdById: { not: user.id }, // только входящие
      },
      include: {
        createdBy: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        chat: {
          select: {
            id: true,
            name: true,
            users: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (calls.length === 0) return NextResponse.json({ success: true, hasCall: false });

    // Для ACTIVE звонков проверяем реальных участников через Stream API
    const toEnd: string[] = [];
    let activeCall = null;

    for (const call of calls) {
      if (call.status === "ACTIVE") {
        const streamCallId = call.streamCallId.includes(":")
          ? call.streamCallId.split(":").slice(1).join(":")
          : call.streamCallId;

        const participants = await getStreamParticipantCount(streamCallId);
        if (participants === 0) {
          toEnd.push(call.id);
          continue;
        }
      }
      if (!activeCall) activeCall = call;
    }

    if (toEnd.length > 0) {
      await prisma.call.updateMany({
        where: { id: { in: toEnd } },
        data: { status: "ENDED" },
      });
    }

    if (!activeCall) return NextResponse.json({ success: true, hasCall: false });

    const callId = activeCall.streamCallId.includes(":")
      ? activeCall.streamCallId.split(":").slice(1).join(":")
      : activeCall.streamCallId;

    const chatName =
      activeCall.chat.name ||
      activeCall.chat.users.find((u) => u.id !== user.id)?.displayName ||
      "Звонок";

    return NextResponse.json({
      success: true,
      hasCall: true,
      call: {
        callId,
        callType: activeCall.type === "AUDIO" ? "audio" : "video",
        chatId: activeCall.chat.id,
        chatName,
        callerName: activeCall.createdBy.displayName || activeCall.createdBy.username,
        callerId: activeCall.createdBy.id,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
