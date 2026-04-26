import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@/app/lib/api/chat";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("SEND MESSAGE BODY:", body);

    const { chatId, content, fileUrl, fileType, replyToId } = body;

    const message = await sendMessage(
      chatId,
      content,
      fileUrl,
      fileType,
      replyToId
    );

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (e: any) {
    console.error("SEND MESSAGE ERROR:", e);

    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}