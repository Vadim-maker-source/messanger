import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { sendPushNotification } from "@/app/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { chatId, content, fileUrl, fileType, replyToId } = body;
    if (!chatId || (!String(content || "").trim() && !fileUrl)) {
      return NextResponse.json({ success: false, error: "chatId and content/file are required" }, { status: 400 });
    }

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, users: { some: { id: user.id } } },
      include: {
        users: { select: { id: true, fcmToken: true } },
      },
    });

    if (!chat) {
      return NextResponse.json({ success: false, error: "Chat not found or access denied" }, { status: 403 });
    }

    // Проверка блокировки в приватных чатах
    if (chat.type === "PRIVATE") {
      const partner = chat.users.find((u) => u.id !== user.id);
      if (partner) {
        const block = await (prisma as any).block.findFirst({
          where: {
            OR: [
              { blockerId: user.id, blockedId: partner.id },
              { blockerId: partner.id, blockedId: user.id },
            ],
          },
        });
        if (block) {
          const youBlocked = block.blockerId === user.id;
          return NextResponse.json(
            {
              success: false,
              error: youBlocked
                ? "Вы заблокировали этого пользователя"
                : "Этот пользователь заблокировал вас",
            },
            { status: 403 }
          );
        }
      }
    }

    const message = await prisma.message.create({
      data: {
        chatId,
        userId: user.id,
        content: String(content || "").trim() || "📎 Файл",
        fileUrl: fileUrl || null,
        fileType: fileType || null,
        replyToId: replyToId || null,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        replyTo: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });

    pusherServer.trigger(chatId, "new-message", message).catch(() => {});

    // FCM: отправляем всем участникам кроме отправителя (с учётом настроек)
    const senderName = user.displayName || user.username;
    const msgText = fileUrl
      ? (fileType === "IMAGE" ? "📷 Фото" : fileType === "VIDEO" ? "🎥 Видео" : fileType === "AUDIO" ? "🎤 Голосовое" : "📎 Файл")
      : (String(content || "").trim() || "Сообщение");

    const chatTitle = (chat as any).name || senderName;

    // Получаем настройки всех получателей
    const recipientIds = chat.users.filter((u) => u.id !== user.id && u.fcmToken).map((u) => u.id);
    const recipientSettings = await prisma.userSettings.findMany({
      where: { userId: { in: recipientIds } },
      select: { userId: true, pushNotifications: true, mutedChats: true },
    });
    const settingsMap = new Map(recipientSettings.map((s) => [s.userId, s]));

    chat.users
      .filter((u) => u.id !== user.id && u.fcmToken)
      .forEach((u) => {
        const settings = settingsMap.get(u.id);
        // Пропускаем если push отключены или чат замьючен
        if (settings?.pushNotifications === false) return;
        if (settings?.mutedChats?.includes(chatId)) return;

        sendPushNotification({
          token: u.fcmToken!,
          title: chatTitle,
          body: `${senderName}: ${msgText}`,
          data: { type: "message", chatId, messageId: message.id },
        }).catch((e) => console.error(`[FCM] failed for ${u.id}:`, e));
      });

    return NextResponse.json({ success: true, data: message });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
