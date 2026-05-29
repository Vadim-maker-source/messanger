import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { pusherServer } from "@/app/lib/pusher";

/**
 * DELETE /api/mobile/servers/[serverId]
 * Удаляет сервер и все его каналы. Только владелец.
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
      select: {
        ownerId: true,
        members: { select: { id: true } },
        chats: { select: { id: true } },
      },
    });

    if (!server) {
      return NextResponse.json({ success: false, error: "Сервер не найден" }, { status: 404 });
    }
    if (server.ownerId !== user.id) {
      return NextResponse.json({ success: false, error: "Только владелец может удалить сервер" }, { status: 403 });
    }

    // Каскадное удаление через транзакцию
    await prisma.$transaction(async (tx) => {
      // Удаляем сообщения и членство во всех каналах сервера
      for (const chat of server.chats) {
        await tx.message.deleteMany({ where: { chatId: chat.id } });
        await tx.chatMember.deleteMany({ where: { chatId: chat.id } });
        await tx.chat.delete({ where: { id: chat.id } });
      }
      // Удаляем все инвайты
      await tx.invite.deleteMany({ where: { serverId } });
      // Удаляем сам сервер
      await tx.server.delete({ where: { id: serverId } });
    });

    // Уведомляем всех участников об обновлении сайдбара
    for (const member of server.members) {
      pusherServer.trigger(`user-${member.id}`, "sidebar-update", {
        type: "server_deleted",
        targetId: serverId,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[delete server] error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
