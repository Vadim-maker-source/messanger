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

    // FCM: отправляем всем участникам кроме отправителя
    const senderName = user.displayName || user.username;
    const msgText = fileUrl
      ? (fileType === "IMAGE" ? "📷 Фото" : fileType === "VIDEO" ? "🎥 Видео" : fileType === "AUDIO" ? "🎤 Голосовое" : "📎 Файл")
      : (String(content || "").trim() || "Сообщение");

    const chatTitle = (chat as any).name || senderName;

    chat.users
      .filter((u) => u.id !== user.id && u.fcmToken)
      .forEach((u) => {
        sendPushNotification({
          token: u.fcmToken!,
          title: chatTitle,
          body: `${senderName}: ${msgText}`,
          data: { type: "message", chatId, messageId: message.id },
        }).catch(() => {});
      });

    return NextResponse.json({ success: true, data: message });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
