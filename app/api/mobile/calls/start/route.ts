import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const chatId = String(body.chatId || "");
    const type = body.type === "audio" ? "AUDIO" : "VIDEO";
    if (!chatId) {
      return NextResponse.json({ success: false, error: "chatId is required" }, { status: 400 });
    }

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        users: { some: { id: user.id } },
      },
      select: { id: true },
    });

    if (!chat) {
      return NextResponse.json({ success: false, error: "Chat not found" }, { status: 404 });
    }

    const streamCallId = `default:chat_${chatId}_${Date.now()}`;
    const call = await prisma.call.create({
      data: {
        chatId,
        createdById: user.id,
        status: "RINGING",
        type,
        streamCallId,
      },
      select: { id: true, type: true, status: true, streamCallId: true },
    });

    const callId = call.streamCallId.replace(/^default:/, "");
    return NextResponse.json({
      success: true,
      call: {
        callId,
        type: call.type === "AUDIO" ? "audio" : "video",
        status: call.status,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to start call" },
      { status: 500 }
    );
  }
}
