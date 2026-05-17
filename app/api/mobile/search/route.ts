import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

// GET /api/mobile/search?q=...
export async function GET(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const q = new URL(req.url).searchParams.get("q")?.trim();
    if (!q) return NextResponse.json({ success: false, error: "q required" }, { status: 400 });

    const [users, chats, servers] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: { not: user.id },
          OR: [{ username: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }],
        },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
        take: 10,
      }),
      prisma.chat.findMany({
        where: {
          users: { some: { id: user.id } },
          serverId: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { users: { some: { displayName: { contains: q, mode: "insensitive" } } } },
          ],
        },
        include: {
          users: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          messages: { take: 1, orderBy: { createdAt: "desc" }, select: { content: true } },
        },
        take: 10,
      }),
      prisma.server.findMany({
        where: { members: { some: { id: user.id } }, name: { contains: q, mode: "insensitive" } },
        include: { _count: { select: { members: true } } },
        take: 10,
      }),
    ]);

    const formattedChats = chats.map((chat) => {
      if (chat.type === "PRIVATE") {
        const partner = chat.users.find((u) => u.id !== user.id);
        return { id: chat.id, type: chat.type, name: partner?.displayName || partner?.username, imageUrl: partner?.avatarUrl, lastMessage: chat.messages[0]?.content };
      }
      return { id: chat.id, type: chat.type, name: chat.name, imageUrl: chat.imageUrl, lastMessage: chat.messages[0]?.content };
    });

    return NextResponse.json({
      success: true,
      data: {
        users,
        chats: formattedChats,
        servers: servers.map((s) => ({ id: s.id, name: s.name, imageUrl: s.imageUrl, memberCount: s._count.members })),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
