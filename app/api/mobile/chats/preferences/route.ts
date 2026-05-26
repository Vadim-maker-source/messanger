import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

/**
 * PATCH /api/mobile/chats/preferences
 * 
 * Тело: { chatId, isPinned?, isArchived?, isMuted? }
 * 
 * Обновляет настройки чата для текущего пользователя (закрепление,
 * архивирование, заглушение уведомлений).
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { chatId, isPinned, isArchived, isMuted } = await req.json();
    if (!chatId) return NextResponse.json({ success: false, error: "chatId required" }, { status: 400 });

    const data: any = {};
    if (isPinned !== undefined) data.isPinned = isPinned;
    if (isArchived !== undefined) data.isArchived = isArchived;
    if (isMuted !== undefined) data.isMuted = isMuted;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
    }

    // Upsert — создаст запись если нет, обновит если есть
    const pref = await (prisma as any).chatUserPreference.upsert({
      where: { userId_chatId: { userId: user.id, chatId } },
      update: data,
      create: { userId: user.id, chatId, ...data },
    });

    return NextResponse.json({ success: true, data: pref });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
