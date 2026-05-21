import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

// Звонок считается "мёртвым" если он в статусе RINGING дольше этого времени
const RINGING_TIMEOUT_MS = 60_000; // 60 секунд

export async function GET(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    // Автоматически завершаем звонки, которые слишком долго висят в RINGING
    const expiredBefore = new Date(Date.now() - RINGING_TIMEOUT_MS);
    await prisma.call.updateMany({
      where: {
        status: "RINGING",
        createdAt: { lt: expiredBefore },
      },
      data: { status: "ENDED" },
    });

    const call = await prisma.call.findFirst({
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

    if (!call) return NextResponse.json({ success: true, hasCall: false });

    const callId = call.streamCallId.includes(":")
      ? call.streamCallId.split(":").slice(1).join(":")
      : call.streamCallId;

    const chatName =
      call.chat.name ||
      call.chat.users.find((u) => u.id !== user.id)?.displayName ||
      "Звонок";

    return NextResponse.json({
      success: true,
      hasCall: true,
      call: {
        callId,
        callType: call.type === "AUDIO" ? "audio" : "video",
        chatId: call.chat.id,
        chatName,
        callerName: call.createdBy.displayName || call.createdBy.username,
        callerId: call.createdBy.id,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
