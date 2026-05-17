import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

// POST /api/mobile/messages/reactions  { messageId, reaction }  — add
// DELETE /api/mobile/messages/reactions { messageId, reaction }  — remove

async function updateReaction(userId: string, messageId: string, reaction: string, add: boolean) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new Error("Message not found");

  let reactions: Record<string, string[]> = (message.reactions as any) || {};

  // Remove previous reaction by this user (only one allowed)
  for (const key of Object.keys(reactions)) {
    reactions[key] = reactions[key].filter((id) => id !== userId);
    if (reactions[key].length === 0) delete reactions[key];
  }

  if (add) {
    if (!reactions[reaction]) reactions[reaction] = [];
    reactions[reaction].push(userId);
  }

  const updated = await prisma.message.update({ where: { id: messageId }, data: { reactions } });
  await pusherServer.trigger(message.chatId, "reaction-updated", { messageId, reactions });
  return updated;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const { messageId, reaction } = await req.json();
    if (!messageId || !reaction) return NextResponse.json({ success: false, error: "messageId and reaction required" }, { status: 400 });
    const data = await updateReaction(user.id, messageId, reaction, true);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const { messageId, reaction } = await req.json();
    if (!messageId || !reaction) return NextResponse.json({ success: false, error: "messageId and reaction required" }, { status: 400 });
    const data = await updateReaction(user.id, messageId, reaction, false);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
