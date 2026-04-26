import { NextRequest, NextResponse } from "next/server";
import { revokeInvite } from "@/app/lib/api/invite";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Разворачиваем params если это Promise
    let id: string;
    if (params instanceof Promise) {
      const resolved = await params;
      id = resolved.id;
    } else {
      id = params.id;
    }
    
    if (!id) {
      return NextResponse.json({ error: "Invite ID required" }, { status: 400 });
    }
    
    await revokeInvite(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error revoking invite:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}