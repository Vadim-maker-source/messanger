import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

/**
 * POST /api/mobile/servers/[serverId]/members
 * Body: { userId }
 * Добавляет пользователя в сервер и во все его каналы.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ serverId: string }> }) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { serverId } = await params;
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId required" }, { status: 400 });
    }

    const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { ownerId: true, chats: { select: { id: true } } },
    });
    if (!server) {
      return NextResponse.json({ success: false, error: "Server not found" }, { status: 404 });
    }

    if (server.ownerId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const targetSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { allowAddToChats: true },
    });
    if ((targetSettings?.allowAddToChats || "everyone") === "nobody") {
      return NextResponse.json(
        { success: false, error: "Пользователь запретил добавление в чаты" },
        { status: 400 }
      );
    }

    await prisma.server.update({
      where: { id: serverId },
      data: { members: { connect: { id: userId } } },
    });

    for (const chat of server.chats) {
      await prisma.chat.update({
        where: { id: chat.id },
        data: { users: { connect: { id: userId } } },
      });
      await prisma.chatMember.upsert({
        where: { userId_chatId: { userId, chatId: chat.id } },
        update: {},
        create: { userId, chatId: chat.id, role: "MEMBER" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

/**
 * DELETE /api/mobile/servers/[serverId]/members
 * Текущий пользователь покидает сервер.
 * Владелец не может покинуть — должен сначала удалить сервер.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ serverId: string }> }) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { serverId } = await params;
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { ownerId: true, chats: { select: { id: true } } },
    });
    if (!server) {
      return NextResponse.json({ success: false, error: "Сервер не найден" }, { status: 404 });
    }
    if (server.ownerId === user.id) {
      return NextResponse.json(
        { success: false, error: "Владелец не может покинуть сервер. Удалите его." },
        { status: 400 }
      );
    }

    // Удаляем себя из всех каналов сервера
    for (const chat of server.chats) {
      await prisma.chatMember.deleteMany({ where: { chatId: chat.id, userId: user.id } });
      await prisma.chat.update({
        where: { id: chat.id },
        data: { users: { disconnect: { id: user.id } } },
      });
    }

    // Удаляем из участников сервера
    await prisma.server.update({
      where: { id: serverId },
      data: { members: { disconnect: { id: user.id } } },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
