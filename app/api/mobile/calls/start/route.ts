import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { pusherServer } from "@/app/lib/pusher";
import { sendPushNotification } from "@/app/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const chatId = String(body.chatId || "");
    const type = body.type === "audio" ? "AUDIO" : "VIDEO";
    if (!chatId) {
      return NextResponse.json({ success: false, error: "chatId is required" }, { status: 400 });
    }

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        users: { some: { id: user.id } },
      },
      include: {
        users: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, fcmToken: true },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ success: false, error: "Chat not found" }, { status: 404 });
    }

    // Проверка блокировки в приватных звонках
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

    const callId = `chat_${chatId}_${Date.now()}`;
    const call = await prisma.call.create({
      data: {
        chatId,
        createdById: user.id,
        status: "RINGING",
        type,
        streamCallId: callId,
      },
      select: { id: true, type: true, status: true, streamCallId: true },
    });

    const callTypeStr = type === "AUDIO" ? "audio" : "video";

    // === PUSHER: отправляем события всем участникам ===
    const payload = {
      callId,
      type: callTypeStr,
      chatId,
      from: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
      },
      createdAt: new Date().toISOString(),
    };

    // Входящий звонок — всем кроме отправителя
    await Promise.all(
      chat.users
        .filter((u) => u.id !== user.id)
        .map((u) => {
          const chatNameForRecipient =
            chat.name ||
            chat.users.find((chatUser) => chatUser.id !== u.id)?.displayName ||
            chat.users.find((chatUser) => chatUser.id !== u.id)?.username ||
            "Личный чат";

          return pusherServer.trigger(`user-${u.id}`, "incoming-call", {
            ...payload,
            chatName: chatNameForRecipient,
          });
        }),
    );

    // Исходящий звонок — отправителю
    const chatNameForCreator =
      chat.name ||
      chat.users.find((chatUser) => chatUser.id !== user.id)?.displayName ||
      chat.users.find((chatUser) => chatUser.id !== user.id)?.username ||
      "Личный чат";

    pusherServer.trigger(`user-${user.id}`, "outgoing-call", {
      ...payload,
      chatName: chatNameForCreator,
    }).catch(() => {});

    // FCM уведомления (с учётом настроек — замьюченные чаты не получают push)
    const callerName = (user.displayName || user.username) ?? "Пользователь";
    const callRecipientIds = chat.users.filter((u) => u.id !== user.id && u.fcmToken).map((u) => u.id);
    const callRecipientSettings = await prisma.userSettings.findMany({
      where: { userId: { in: callRecipientIds } },
      select: { userId: true, pushNotifications: true, mutedChats: true },
    });
    const callSettingsMap = new Map(callRecipientSettings.map((s) => [s.userId, s]));

    chat.users
      .filter((u) => u.id !== user.id && u.fcmToken)
      .forEach((u) => {
        const settings = callSettingsMap.get(u.id);
        if (settings?.pushNotifications === false) return;
        if (settings?.mutedChats?.includes(chatId)) return;

        const chatName = chat.name || user.displayName || user.username || "Звонок";
        sendPushNotification({
          token: u.fcmToken!,
          title: callTypeStr === "video" ? "📹 Входящий видеозвонок" : "📞 Входящий звонок",
          body: callerName,
          data: { type: "call", callId, callType: callTypeStr, chatId, chatName, callerName, callerId: user.id },
        }).catch(() => {});
      });

    return NextResponse.json({
      success: true,
      call: {
        callId,
        type: callTypeStr,
        status: call.status,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to start call" },
      { status: 500 }
    );
  }
}