import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");
    const query = searchParams.get("q")?.trim();
    if (!chatId || !query) return NextResponse.json({ success: false, error: "chatId and q required" }, { status: 400 });

    const access = await prisma.chat.findFirst({
      where: { id: chatId, OR: [{ users: { some: { id: user.id } } }, { members: { some: { userId: user.id } } }] },
      select: { id: true },
    });
    if (!access) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const messages = await prisma.message.findMany({
      where: { chatId, deleted: false, content: { contains: query, mode: "insensitive" } },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: messages });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
