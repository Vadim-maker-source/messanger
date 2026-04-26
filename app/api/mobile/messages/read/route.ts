import { NextRequest, NextResponse } from "next/server";
import { markMessagesAsRead } from "@/app/lib/api/chat";

export async function POST(req: NextRequest) {
  try {
    const { chatId } = await req.json();

    const result = await markMessagesAsRead(chatId);

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