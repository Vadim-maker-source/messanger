import { NextRequest, NextResponse } from "next/server";
import { generateInviteCode, generateServerInviteCode } from "@/app/lib/api/invite";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, serverId, maxUses, expiresAt } = body;

    if (!chatId && !serverId) {
      return NextResponse.json({ error: "Chat ID or Server ID required" }, { status: 400 });
    }

    let invite;
    if (serverId) {
      console.log("Creating invite for server:", serverId);
      invite = await generateServerInviteCode(
        serverId,
        maxUses,
        expiresAt ? new Date(expiresAt) : undefined
      );
    } else if (chatId) {
      console.log("Creating invite for chat:", chatId);
      invite = await generateInviteCode(
        chatId,
        maxUses,
        expiresAt ? new Date(expiresAt) : undefined
      );
    }

    console.log("Invite created:", invite);

    return NextResponse.json(invite, { status: 201 });
  } catch (error: any) {
    console.error("Error creating invite:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Опционально: добавьте OPTIONS для CORS если нужно
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Allow': 'POST',
    },
  });
}