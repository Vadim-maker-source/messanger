import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { AccessType } from "@prisma/client";

// GET /api/mobile/chats/[chatId] — chat info (full, like web version)
export async function GET(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { chatId } = await params;

    // Сначала проверяем — это чат или сервер?
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, OR: [{ users: { some: { id: user.id } } }, { members: { some: { userId: user.id } } }] },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } } } },
        server: { select: { id: true, name: true, ownerId: true, imageUrl: true, access: true, createdAt: true } },
        invites: { orderBy: { createdAt: "desc" }, take: 10 },
        _count: { select: { users: true, messages: true } },
      },
    });

    if (chat) {
      // Определяем роль текущего юзера
      const myMembership = chat.members.find(m => m.user.id === user.id);
      const isServerOwner = chat.server?.ownerId === user.id;
      const role = myMembership?.role || (isServerOwner ? "CREATOR" : "MEMBER");
      const isAdmin = role === "CREATOR" || role === "ADMIN" || isServerOwner;

      // Если чат принадлежит серверу — подгружаем подканалы
      let subChats: any[] = [];
      if (chat.serverId) {
        subChats = await prisma.chat.findMany({
          where: { serverId: chat.serverId },
          select: { id: true, name: true, type: true, imageUrl: true },
          orderBy: { createdAt: "asc" },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          ...chat,
          role,
          isAdmin,
          chats: subChats,
        },
      });
    }

    // Может быть это сервер (не чат)?
    const server = await prisma.server.findFirst({
      where: { id: chatId, members: { some: { id: user.id } } },
      include: {
        members: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
        chats: { select: { id: true, name: true, type: true, imageUrl: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (server) {
      const isOwner = server.ownerId === user.id;
      // Загружаем инвайты сервера
      const invites = await prisma.invite.findMany({
        where: { serverId: server.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      return NextResponse.json({
        success: true,
        data: {
          id: server.id,
          name: server.name,
          imageUrl: server.imageUrl,
          type: "SERVER",
          access: server.access,
          createdAt: server.createdAt,
          ownerId: server.ownerId,
          members: server.members.map(u => ({ user: u, role: u.id === server.ownerId ? "CREATOR" : "MEMBER" })),
          chats: server.chats,
          invites,
          isAdmin: isOwner,
          role: isOwner ? "CREATOR" : "MEMBER",
        },
      });
    }

    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
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
