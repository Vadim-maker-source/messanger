import { NextRequest, NextResponse } from "next/server";
import { getChatInvites, getServerInvites } from "@/app/lib/api/invite";

export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get("chatId");
  const serverId = request.nextUrl.searchParams.get("serverId");

  if (!chatId && !serverId) {
    return NextResponse.json({ error: "Chat ID or Server ID required" }, { status: 400 });
  }

  try {
    let invites;
    if (serverId) {
      invites = await getServerInvites(serverId);
    } else if (chatId) {
      invites = await getChatInvites(chatId);
    }
    return NextResponse.json(invites || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}