import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

// GET /api/mobile/users/media?userId=...
export async function GET(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) return NextResponse.json({ success: false, error: "userId required" }, { status: 400 });

    const chat = await prisma.chat.findFirst({
      where: {
        type: "PRIVATE",
        AND: [{ users: { some: { id: user.id } } }, { users: { some: { id: userId } } }],
      },
      select: { id: true },
    });

    if (!chat) return NextResponse.json({ success: true, data: { photos: [], videos: [], audio: [], files: [] } });

    const messages = await prisma.message.findMany({
      where: { chatId: chat.id, fileUrl: { not: null }, deleted: false },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });

    const fmt = (m: any) => ({ id: m.id, url: m.fileUrl, fileName: m.fileName, fileType: m.fileType, createdAt: m.createdAt, user: m.user });

    return NextResponse.json({
      success: true,
      data: {
        photos: messages.filter((m) => m.fileType?.startsWith("image/") || m.fileType === "IMAGE").map(fmt),
        videos: messages.filter((m) => m.fileType?.startsWith("video/") || m.fileType === "VIDEO").map(fmt),
        audio: messages.filter((m) => m.fileType?.startsWith("audio/") || m.fileType === "AUDIO" || m.fileType === "ROUND").map(fmt),
        files: messages.filter((m) => m.fileType && !["IMAGE","VIDEO","AUDIO","ROUND"].includes(m.fileType) && !m.fileType.match(/^(image|video|audio)\//)).map(fmt),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
