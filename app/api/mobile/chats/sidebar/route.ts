import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const allChats = await prisma.chat.findMany({
      where: { users: { some: { id: user.id } }, serverId: null },
      include: {
        users: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { readReceipts: { select: { userId: true } } },
        },
        members: { where: { userId: user.id }, select: { role: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Загружаем настройки пользователя для всех чатов (pin/archive/mute)
    const chatIds = allChats.map(c => c.id);
    let prefsMap: Record<string, any> = {};
    try {
      const prefs = await (prisma as any).chatUserPreference.findMany({
        where: { userId: user.id, chatId: { in: chatIds } },
      });
      prefsMap = Object.fromEntries(prefs.map((p: any) => [p.chatId, p]));
    } catch {
      // Таблица ещё не создана — игнорируем
    }

    const chatsWithUnread = await Promise.all(
      allChats.map(async (chat) => {
        const unreadCount = await prisma.message.count({
          where: { chatId: chat.id, userId: { not: user.id }, readReceipts: { none: { userId: user.id } } },
        });
        const lastMsg = chat.messages[0];
        let displayTitle = chat.name;
        let displayImage = chat.imageUrl;
        let partnerId: string | null = null;
        if (chat.type === "PRIVATE") {
          const partner = chat.users.find((u) => u.id !== user.id);
          displayTitle = partner?.displayName || partner?.username || "Чат";
          displayImage = partner?.avatarUrl || null;
          partnerId = partner?.id ?? null;
        }
        const pref = prefsMap[chat.id];
        return {
          id: chat.id,
          type: chat.type,
          title: displayTitle,
          image: displayImage,
          unreadCount,
          updatedAt: chat.updatedAt,
          role: chat.members[0]?.role || null,
          partnerId,
          isPinned: pref?.isPinned ?? false,
          isArchived: pref?.isArchived ?? false,
          isMuted: pref?.isMuted ?? false,
          lastMessage: lastMsg
            ? { content: lastMsg.content, createdAt: lastMsg.createdAt, senderId: lastMsg.userId }
            : null,
        };
      })
    );

    const servers = await prisma.server.findMany({
      where: { members: { some: { id: user.id } } },
      include: {
        chats: {
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, type: true, access: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: { chats: chatsWithUnread, servers } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
