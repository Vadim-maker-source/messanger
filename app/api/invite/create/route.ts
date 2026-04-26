import { NextRequest, NextResponse } from "next/server";
import { generateInviteCode } from "@/app/lib/api/invite";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, maxUses, expiresAt } = body;
    
    console.log("Creating invite for chat:", chatId);
    
    if (!chatId) {
      return NextResponse.json({ error: "Chat ID required" }, { status: 400 });
    }
    
    const invite = await generateInviteCode(
      chatId, 
      maxUses, 
      expiresAt ? new Date(expiresAt) : undefined
    );
    
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