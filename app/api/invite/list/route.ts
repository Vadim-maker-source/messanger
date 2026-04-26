import { NextRequest, NextResponse } from "next/server";
import { getChatInvites } from "@/app/lib/api/invite";

export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ error: "Chat ID required" }, { status: 400 });
  }

  try {
    const invites = await getChatInvites(chatId);
    return NextResponse.json(invites);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}