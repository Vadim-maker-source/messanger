import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { asId, unauthorized, badRequest, forbidden, notFound, errorResponse } from "@/app/lib/validate";

/**
 * Пересылка сообщения. Проверки:
 *  1. Пользователь — участник исходного чата (иначе нельзя читать)
 *  2. Пользователь — участник целевого чата (иначе нельзя писать)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const messageId = asId(body.messageId);
    const targetChatId = asId(body.targetChatId);
    if (!messageId || !targetChatId) return badRequest("messageId and targetChatId required");

    const original = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        chat: { select: { id: true, name: true, type: true, users: { where: { id: user.id }, select: { id: true } } } },
      },
    });
    if (!original) return notFound("Сообщение не найдено");

    // 1. Имеет ли пользователь доступ к исходному чату?
    if (original.chat.users.length === 0) return forbidden("Нет доступа к исходному чату");

    // 2. Является ли пользователь участником целевого чата?
    const target = await prisma.chat.findFirst({
      where: { id: targetChatId, users: { some: { id: user.id } } },
      select: { id: true },
    });
    if (!target) return forbidden("Вы не участник целевого чата");

    const sourceName = original.chat.name || (original.chat.type === "PRIVATE" ? "Личный чат" : "Чат");

    const forwarded = await prisma.message.create({
      data: {
        content: original.content,
        fileUrl: original.fileUrl,
        fileType: original.fileType,
        userId: user.id,
        chatId: targetChatId,
        forwardedFromMessageId: original.id,
        forwardedFromChatId: original.chatId,
        forwardedFromChatName: sourceName,
        forwardedFromChatType: original.chat.type,
        forwardedFromUserId: original.userId,
        forwardedFromUserName: original.user.displayName || original.user.username,
      },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });

    pusherServer.trigger(targetChatId, "new-message", forwarded).catch(() => {});

    // sidebar-update всем участникам
    prisma.chatMember
      .findMany({ where: { chatId: targetChatId }, select: { userId: true } })
      .then((members) => {
        for (const m of members) {
          pusherServer.trigger(`user-${m.userId}`, "sidebar-update", { chatId: targetChatId }).catch(() => {});
        }
      })
      .catch(() => {});

    return NextResponse.json({ success: true, data: forwarded });
  } catch (e) {
    return errorResponse(e, "messages-forward");
  }
}
