import { NextRequest, NextResponse } from "next/server";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { prisma } from "@/app/lib/prisma";

const DEFAULT_SETTINGS = {
  showOnlineStatus: true,
  showLastSeen: true,
  allowDirectMessages: "everyone",
  profileVisibility: "public",
  theme: "system",
  pushNotifications: true,
  soundNotifications: true,
};

async function ensureSettings(userId: string) {
  const existing = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      id: true,
      showOnlineStatus: true,
      showLastSeen: true,
      allowDirectMessages: true,
      profileVisibility: true,
      theme: true,
      pushNotifications: true,
      soundNotifications: true,
    },
  });

  if (existing) return existing;

  return prisma.userSettings.create({
    data: { userId },
    select: {
      id: true,
      showOnlineStatus: true,
      showLastSeen: true,
      allowDirectMessages: true,
      profileVisibility: true,
      theme: true,
      pushNotifications: true,
      soundNotifications: true,
    },
  });
}

export async function GET(request: NextRequest) {
  const user = await getMobileUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const settings = await ensureSettings(user.id);
  return NextResponse.json({
    success: true,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const settings = await ensureSettings(user.id);
    const body = await request.json();

    const updated = await prisma.userSettings.update({
      where: { id: settings.id },
      data: {
        ...(typeof body.showOnlineStatus === "boolean" ? { showOnlineStatus: body.showOnlineStatus } : {}),
        ...(typeof body.showLastSeen === "boolean" ? { showLastSeen: body.showLastSeen } : {}),
        ...(typeof body.allowDirectMessages === "string" ? { allowDirectMessages: body.allowDirectMessages } : {}),
        ...(typeof body.profileVisibility === "string" ? { profileVisibility: body.profileVisibility } : {}),
        ...(typeof body.theme === "string" ? { theme: body.theme } : {}),
        ...(typeof body.pushNotifications === "boolean" ? { pushNotifications: body.pushNotifications } : {}),
        ...(typeof body.soundNotifications === "boolean" ? { soundNotifications: body.soundNotifications } : {}),
      },
      select: {
        showOnlineStatus: true,
        showLastSeen: true,
        allowDirectMessages: true,
        profileVisibility: true,
        theme: true,
        pushNotifications: true,
        soundNotifications: true,
      },
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
