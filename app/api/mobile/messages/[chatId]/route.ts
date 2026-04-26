import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/app/lib/api/chat";

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const messages = await getMessages(params.chatId);

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