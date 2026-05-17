import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { ChatRole } from "@prisma/client";

// POST — add member  { chatId, userId, role? }
export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { chatId, userId, role = "MEMBER" } = await req.json();
    if (!chatId || !userId) return NextResponse.json({ success: false, error: "chatId and userId required" }, { status: 400 });

    const chat = await prisma.chat.findUnique({ where: { id: chatId }, include: { server: true } });
    if (!chat || chat.type === "PRIVATE") return NextResponse.json({ success: false, error: "Invalid chat" }, { status: 400 });

    const myRole = await prisma.chatMember.findUnique({ where: { userId_chatId: { userId: user.id, chatId } } });
    const isOwner = chat.server?.ownerId === user.id;
    if (!isOwner && myRole?.role !== "CREATOR" && myRole?.role !== "ADMIN")
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const member = await prisma.chatMember.upsert({
      where: { userId_chatId: { userId, chatId } },
      update: { role: role as ChatRole },
      create: { userId, chatId, role: role as ChatRole },
    });
    await prisma.chat.update({ where: { id: chatId }, data: { users: { connect: { id: userId } } } });

    return NextResponse.json({ success: true, data: member });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// PATCH — update role  { chatId, userId, role }
export async function PATCH(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { chatId, userId, role } = await req.json();
    if (!chatId || !userId || !role) return NextResponse.json({ success: false, error: "chatId, userId, role required" }, { status: 400 });

    const myRole = await prisma.chatMember.findUnique({ where: { userId_chatId: { userId: user.id, chatId } } });
    if (myRole?.role !== "CREATOR" && myRole?.role !== "ADMIN")
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const targetRole = await prisma.chatMember.findUnique({ where: { userId_chatId: { userId, chatId } } });
    if (targetRole?.role === "CREATOR") return NextResponse.json({ success: false, error: "Cannot change creator role" }, { status: 403 });

    const updated = await prisma.chatMember.update({
      where: { userId_chatId: { userId, chatId } },
      data: { role: role as ChatRole },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// DELETE — remove member  { chatId, userId }
export async function DELETE(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { chatId, userId } = await req.json();
    if (!chatId || !userId) return NextResponse.json({ success: false, error: "chatId and userId required" }, { status: 400 });

    const myRole = await prisma.chatMember.findUnique({ where: { userId_chatId: { userId: user.id, chatId } } });
    const targetRole = await prisma.chatMember.findUnique({ where: { userId_chatId: { userId, chatId } } });

    if (targetRole?.role === "CREATOR") return NextResponse.json({ success: false, error: "Cannot remove creator" }, { status: 403 });

    const isSelf = user.id === userId;
    const canRemove = isSelf || myRole?.role === "CREATOR" || (myRole?.role === "ADMIN" && targetRole?.role !== "ADMIN");
    if (!canRemove) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    await prisma.chatMember.delete({ where: { userId_chatId: { userId, chatId } } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
