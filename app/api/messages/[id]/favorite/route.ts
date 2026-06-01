import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/api/user";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

/**
 * Авторизация — поддерживаем и web (NextAuth) и mobile (Bearer JWT).
 * Возвращает userId или null.
 */
async function getUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const u = await getMobileUserFromRequest(req);
    return u?.id || null;
  }
  const u = await getCurrentUser();
  return u?.id || null;
}

/**
 * POST /api/messages/[id]/favorite — добавить в избранное
 * DELETE — убрать
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: messageId } = await params;

  // Проверяем что сообщение существует и юзер имеет к нему доступ (через chat membership)
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      chat: {
        include: {
          members: { where: { userId }, select: { userId: true } },
          users: { where: { id: userId }, select: { id: true } },
        },
      },
    },
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasAccess =
    message.chat.members.length > 0 || message.chat.users.length > 0;
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.favoriteMessage.upsert({
    where: { userId_messageId: { userId, messageId } },
    create: { userId, messageId },
    update: {},
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: messageId } = await params;
  await prisma.favoriteMessage.deleteMany({ where: { userId, messageId } });

  return NextResponse.json({ success: true });
}
