import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { AccessType } from "@prisma/client";

// GET /api/mobile/chats/[chatId] — chat info
export async function GET(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { chatId } = await params;
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, OR: [{ users: { some: { id: user.id } } }, { members: { some: { userId: user.id } } }] },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } } } },
        server: { select: { id: true, name: true, ownerId: true } },
        _count: { select: { users: true, messages: true } },
      },
    });
    if (!chat) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: chat });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// PATCH /api/mobile/chats/[chatId] — update chat
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { chatId } = await params;
    const { name, imageUrl, access } = await req.json();

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { server: true, members: { where: { userId: user.id }, select: { role: true } } },
    });
    if (!chat) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const isServerOwner = chat.server?.ownerId === user.id;
    const role = chat.members[0]?.role;
    if (!isServerOwner && role !== "CREATOR" && role !== "ADMIN")
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const updated = await prisma.chat.update({
      where: { id: chatId },
      data: {
        ...(name !== undefined && { name }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(access !== undefined && { access: access as AccessType }),
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// DELETE /api/mobile/chats/[chatId] — delete chat
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { chatId } = await params;
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { server: true, members: { where: { userId: user.id }, select: { role: true } } },
    });
    if (!chat) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const isServerOwner = chat.server?.ownerId === user.id;
    const role = chat.members[0]?.role;
    const canDelete = chat.type === "PRIVATE" || isServerOwner || role === "CREATOR" || role === "ADMIN";
    if (!canDelete) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    await prisma.message.deleteMany({ where: { chatId } });
    await prisma.readReceipt.deleteMany({ where: { chatId } });
    await prisma.chatMember.deleteMany({ where: { chatId } });
    await prisma.chat.delete({ where: { id: chatId } });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
