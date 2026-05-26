import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

// GET /api/mobile/users/[userId]
// Возвращает профиль пользователя + общие чаты + статистику + блок-статус.
// Шейп ответа максимально совпадает с веб-API getUserProfile (lib/api/user.ts).
export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { userId } = await params;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true,
        bio: true, status: true, lastSeen: true, createdAt: true, isOnline: true,
        settings: { select: { profileVisibility: true, showLastSeen: true, showOnlineStatus: true, preferences: true } },
      },
    });
    if (!target) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const isSelf = user.id === userId;

    // ─── Общие чаты (полный список, как в web getMutualChats) ───────────────
    const mutualRaw = isSelf ? [] : await prisma.chat.findMany({
      where: {
        AND: [
          { users: { some: { id: user.id } } },
          { users: { some: { id: userId } } },
        ],
      },
      include: {
        users: {
          where: { id: { not: user.id } },
          select: { id: true, displayName: true, username: true, avatarUrl: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true },
        },
        _count: { select: { messages: true, users: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const mutualChats = mutualRaw.map((c) => ({
      id: c.id,
      name: c.type === "PRIVATE"
        ? (c.users[0]?.displayName || c.users[0]?.username || "Чат")
        : (c.name || "Групповой чат"),
      type: c.type,
      imageUrl: c.imageUrl,
      lastMessage: c.messages[0]?.content || "",
      lastMessageTime: c.messages[0]?.createdAt || null,
      messagesCount: c._count.messages,
      membersCount: c._count.users,
    }));

    const visibility = target.settings?.profileVisibility || "public";
    const canSeeProfileExtras =
      isSelf ||
      visibility === "public" ||
      (visibility === "contacts" && mutualChats.length > 0);

    const prefs = (target.settings?.preferences || {}) as Record<string, any>;
    const socialLinks = canSeeProfileExtras ? (prefs.socialLinks || null) : null;

    // ─── Статус блока ───────────────────────────────────────────────────────
    const [iBlocked, theyBlocked] = isSelf ? [null, null] : await Promise.all([
      (prisma as any).block.findUnique({
        where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } },
      }).catch(() => null),
      (prisma as any).block.findUnique({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: user.id } },
      }).catch(() => null),
    ]);

    // ─── Статистика (messagesCount, chatsCount) ─────────────────────────────
    const [messagesCount, chatsCount] = await Promise.all([
      prisma.message.count({ where: { userId } }),
      prisma.chatMember.count({ where: { userId } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        id: target.id,
        username: target.username,
        displayName: target.displayName,
        avatarUrl: target.avatarUrl,
        bio: canSeeProfileExtras ? target.bio : null,
        status: canSeeProfileExtras ? target.status : null,
        lastSeen: (canSeeProfileExtras && target.settings?.showLastSeen !== false) ? target.lastSeen : null,
        isOnline: target.settings?.showOnlineStatus === false && !isSelf ? false : target.isOnline,
        createdAt: target.createdAt,
        socialLinks,
        canSeeProfileExtras,
        mutualChats,
        mutualChatsCount: mutualChats.length,
        stats: { messagesCount, chatsCount },
        iBlockedThem: !!iBlocked,
        theyBlockedMe: !!theyBlocked,
        isSelf,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
