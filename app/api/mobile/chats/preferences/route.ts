import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { asId, asBool, unauthorized, badRequest, forbidden, errorResponse } from "@/app/lib/validate";

/**
 * PATCH /api/mobile/chats/preferences
 * Body: { chatId, isPinned?, isArchived?, isMuted? }
 *
 * Изменяет личные настройки чата. Доступно только участникам чата.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const chatId = asId(body.chatId);
    if (!chatId) return badRequest("chatId required");

    // Проверка членства в чате
    const member = await prisma.chat.findFirst({
      where: { id: chatId, users: { some: { id: user.id } } },
      select: { id: true },
    });
    if (!member) return forbidden("Вы не участник этого чата");

    const data: Record<string, boolean> = {};
    if (body.isPinned !== undefined) data.isPinned = asBool(body.isPinned);
    if (body.isArchived !== undefined) data.isArchived = asBool(body.isArchived);
    if (body.isMuted !== undefined) data.isMuted = asBool(body.isMuted);

    if (Object.keys(data).length === 0) {
      return badRequest("Нет полей для обновления");
    }

    const pref = await (prisma as any).chatUserPreference.upsert({
      where: { userId_chatId: { userId: user.id, chatId } },
      update: data,
      create: { userId: user.id, chatId, ...data },
    });

    return NextResponse.json({ success: true, data: pref });
  } catch (e) {
    return errorResponse(e, "chat-preferences");
  }
}
