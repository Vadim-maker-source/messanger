import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { asId, unauthorized, badRequest, forbidden, notFound, errorResponse } from "@/app/lib/validate";

// Whitelist допустимых ключей реакций
const ALLOWED_REACTIONS = new Set(["heart", "like", "laugh", "wow", "sad", "angry"]);

async function updateReaction(userId: string, messageId: string, reaction: string, add: boolean) {
  // Проверяем доступ: пользователь должен быть в чате этого сообщения
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      chatId: true,
      reactions: true,
      chat: {
        select: { users: { where: { id: userId }, select: { id: true } } },
      },
    },
  });
  if (!message) return { error: "not_found" as const };
  if (message.chat.users.length === 0) return { error: "forbidden" as const };

  let reactions: Record<string, string[]> = (message.reactions as any) || {};

  // Удаляем все предыдущие реакции этого пользователя (только одна разрешена)
  for (const key of Object.keys(reactions)) {
    reactions[key] = reactions[key].filter((id) => id !== userId);
    if (reactions[key].length === 0) delete reactions[key];
  }

  if (add) {
    if (!reactions[reaction]) reactions[reaction] = [];
    reactions[reaction].push(userId);
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { reactions },
  });
  pusherServer.trigger(message.chatId, "reaction-updated", { messageId, reactions }).catch(() => {});
  return { ok: true as const, data: updated };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return unauthorized();
    const body = await req.json().catch(() => ({}));
    const messageId = asId(body.messageId);
    const reaction = typeof body.reaction === "string" ? body.reaction.toLowerCase() : "";
    if (!messageId || !reaction) return badRequest("messageId and reaction required");
    if (!ALLOWED_REACTIONS.has(reaction)) return badRequest("Недопустимая реакция");

    const result = await updateReaction(user.id, messageId, reaction, true);
    if ("error" in result) {
      return result.error === "not_found" ? notFound("Сообщение не найдено") : forbidden("Нет доступа к чату");
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (e) {
    return errorResponse(e, "reactions-add");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return unauthorized();
    const body = await req.json().catch(() => ({}));
    const messageId = asId(body.messageId);
    const reaction = typeof body.reaction === "string" ? body.reaction.toLowerCase() : "";
    if (!messageId || !reaction) return badRequest("messageId and reaction required");
    if (!ALLOWED_REACTIONS.has(reaction)) return badRequest("Недопустимая реакция");

    const result = await updateReaction(user.id, messageId, reaction, false);
    if ("error" in result) {
      return result.error === "not_found" ? notFound("Сообщение не найдено") : forbidden("Нет доступа к чату");
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (e) {
    return errorResponse(e, "reactions-remove");
  }
}
