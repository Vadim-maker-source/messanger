import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

/**
 * GET /api/mobile/chats/available
 *
 * Все чаты пользователя (личные / группы / каналы серверов), куда он
 * может писать сообщения — для экранов пересылки и шеринга контента.
 *
 * Для каждого чата вычисляется `canWrite`:
 *   • PRIVATE / GROUP        → всегда true (если юзер участник)
 *   • CHANNEL без сервера    → true только если CREATOR / ADMIN
 *   • CHANNEL на сервере     → true если CREATOR / ADMIN или owner сервера
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const allChats = await prisma.chat.findMany({
      where: { users: { some: { id: user.id } } },
      include: {
        users: {
          where: { id: { not: user.id } },
          select: { id: true, displayName: true, username: true, avatarUrl: true },
        },
        members: { where: { userId: user.id }, select: { role: true } },
        server: { select: { id: true, name: true, ownerId: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const data = allChats.map((c) => {
      const role = c.members[0]?.role ?? null;
      const isServerOwner = c.server?.ownerId === user.id;

      let title: string | null = c.name;
      let image: string | null = c.imageUrl;
      let subtitle = "";

      if (c.type === "PRIVATE") {
        const partner = c.users[0];
        title = partner?.displayName || partner?.username || "Чат";
        image = partner?.avatarUrl ?? null;
      }

      if (c.server?.name) subtitle = c.server.name;

      let canWrite = true;
      if (c.type === "CHANNEL") {
        canWrite = isServerOwner || role === "CREATOR" || role === "ADMIN";
      }

      let partnerId: string | null = null;
      if (c.type === "PRIVATE") {
        const partner = c.users[0];
        partnerId = partner?.id ?? null;
      }

      return {
        id: c.id,
        title: title || (c.server ? "Канал" : "Чат"),
        image,
        type: c.type,
        subtitle,
        role,
        canWrite,
        serverId: c.server?.id ?? null,
        serverName: c.server?.name ?? null,
        partnerId,
        updatedAt: c.updatedAt,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
