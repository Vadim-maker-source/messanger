import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

// GET /api/mobile/users/[userId]
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

    const visibility = target.settings?.profileVisibility || "public";
    const isSelf = user.id === userId;
    const canSee = isSelf || visibility === "public";

    const mutualChats = await prisma.chat.count({
      where: { AND: [{ users: { some: { id: user.id } } }, { users: { some: { id: userId } } }] },
    });

    const prefs = (target.settings?.preferences || {}) as Record<string, any>;
    const socialLinks = canSee || mutualChats > 0 ? (prefs.socialLinks || null) : null;

    return NextResponse.json({
      success: true,
      data: {
        id: target.id,
        username: target.username,
        displayName: target.displayName,
        avatarUrl: target.avatarUrl,
        bio: canSee ? target.bio : null,
        status: canSee ? target.status : null,
        lastSeen: (canSee && target.settings?.showLastSeen !== false) ? target.lastSeen : null,
        isOnline: target.settings?.showOnlineStatus === false && !isSelf ? false : target.isOnline,
        createdAt: target.createdAt,
        socialLinks,
        mutualChatsCount: mutualChats,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
