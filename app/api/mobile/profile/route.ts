import { NextRequest, NextResponse } from "next/server";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/mobile/profile — собственный профиль текущего пользователя.
 *
 * Возвращает то же, что и веб-страница `/profile/[type]` для своего id:
 *   • базовые поля User (id, email, username, displayName, avatarUrl, bio,
 *     status, isOnline, createdAt, lastSeen);
 *   • socialLinks из UserSettings.preferences.socialLinks;
 *   • stats: { messagesCount, chatsCount } для блоков на странице.
 */
export async function GET(request: NextRequest) {
  const user = await getMobileUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      status: true,
      isOnline: true,
      lastSeen: true,
      createdAt: true,
      settings: { select: { preferences: true } },
    },
  });
  if (!full) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const prefs = (full.settings?.preferences || {}) as Record<string, any>;
  const socialLinks = prefs.socialLinks || null;

  const [messagesCount, chatsCount] = await Promise.all([
    prisma.message.count({ where: { userId: user.id } }),
    prisma.chatMember.count({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    success: true,
    profile: {
      id: full.id,
      email: full.email,
      username: full.username,
      displayName: full.displayName,
      avatarUrl: full.avatarUrl,
      bio: full.bio,
      status: full.status,
      isOnline: full.isOnline,
      lastSeen: full.lastSeen,
      createdAt: full.createdAt,
      socialLinks,
      stats: { messagesCount, chatsCount },
    },
  });
}

/**
 * PATCH /api/mobile/profile — обновить профиль и/или соцссылки.
 *
 * Принимает любую комбинацию полей: displayName, bio, status, avatarUrl,
 * socialLinks ({ telegram, vk, github, website }). Соцссылки сохраняются в
 * UserSettings.preferences.socialLinks (как и на вебе).
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
    const bio = typeof body.bio === "string" ? body.bio : undefined;
    const status = typeof body.status === "string" ? body.status : undefined;
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl : undefined;
    const socialLinks = body.socialLinks && typeof body.socialLinks === "object"
      ? body.socialLinks as Record<string, string>
      : undefined;

    if (displayName !== undefined && displayName.length < 2) {
      return NextResponse.json(
        { success: false, error: "displayName should be at least 2 chars" },
        { status: 400 }
      );
    }

    // Обновляем поля User-а
    if (displayName !== undefined || bio !== undefined || status !== undefined || avatarUrl !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(displayName !== undefined ? { displayName } : {}),
          ...(bio !== undefined ? { bio } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        },
      });
    }

    // Обновляем socialLinks через UserSettings.preferences
    if (socialLinks !== undefined) {
      const cleaned: Record<string, string> = {};
      for (const k of ["telegram", "vk", "github", "website"]) {
        const v = (socialLinks[k] ?? "").trim();
        if (v) cleaned[k] = v;
      }
      const existing = await prisma.userSettings.findUnique({
        where: { userId: user.id },
        select: { preferences: true },
      });
      const prevPrefs = (existing?.preferences || {}) as Record<string, any>;
      const newPrefs = { ...prevPrefs, socialLinks: cleaned };

      await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: { preferences: newPrefs },
        create: { userId: user.id, preferences: newPrefs },
      });
    }

    // Возвращаем актуальный профиль (используем тот же шейп, что GET)
    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, email: true, username: true, displayName: true,
        avatarUrl: true, bio: true, status: true, isOnline: true,
        lastSeen: true, createdAt: true,
        settings: { select: { preferences: true } },
      },
    });
    const prefs = (refreshed?.settings?.preferences || {}) as Record<string, any>;

    return NextResponse.json({
      success: true,
      profile: {
        id: refreshed!.id,
        email: refreshed!.email,
        username: refreshed!.username,
        displayName: refreshed!.displayName,
        avatarUrl: refreshed!.avatarUrl,
        bio: refreshed!.bio,
        status: refreshed!.status,
        isOnline: refreshed!.isOnline,
        lastSeen: refreshed!.lastSeen,
        createdAt: refreshed!.createdAt,
        socialLinks: prefs.socialLinks || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
