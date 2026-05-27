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
    const { type, callId, targetUserId: explicitTargetId, sdp, candidate, sdpMLineIndex, sdpMid } = body;

    if (!type || !callId) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Извлекаем chatId из callId (формат: chat_<chatId>_<timestamp>)
    const chatId = callId.replace(/^chat_/, "").replace(/_\d+$/, "");

    // Определяем targetUserId: используем явный, если передан
    let targetUserId = explicitTargetId as string | undefined;

    if (!targetUserId) {

      // Получаем чат, чтобы найти других участников
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          users: { some: { id: user.id } },
        },
        select: {
          users: {
            select: { id: true, displayName: true, username: true },
          },
        },
      });

      if (!chat) {
        return NextResponse.json({ success: false, error: "Chat not found" }, { status: 404 });
      }

      // Находим targetUserId — любого участника чата, кроме отправителя
      const targetUser = chat.users.find((u) => u.id !== user.id);
      if (!targetUser) {
        return NextResponse.json({ success: false, error: "No other participants" }, { status: 400 });
      }
      targetUserId = targetUser.id;
    }

    const signalPayload = {
      callId,
      fromUserId: user.id,
      fromDisplayName: user.displayName || user.username || "User",
      type,
      sdp,
      candidate,
      sdpMLineIndex,
      sdpMid,
    };

    // Отправляем сигнал целевому пользователю через Pusher
    await pusherServer.trigger(`user-${targetUserId}`, "webrtc-signal", signalPayload);

    console.log("[Mobile Signal] Sent", type, "to user", targetUserId, "for call", callId);

    // Если это первый offer — сохраняем SDP и отправляем уведомление
    if (type === 'offer') {
      try {
        const call = await prisma.call.findFirst({
          where: { streamCallId: callId },
          select: { status: true, type: true },
        });

        if (call && call.status === 'RINGING') {
          // Сохраняем offer SDP, чтобы получатель мог забрать его при опоздании
          if (sdp) {
            await prisma.call.update({
              where: { streamCallId: callId },
              data: { offerSdp: sdp as string },
            });
          }
          const callChat = await prisma.chat.findFirst({
            where: { id: chatId },
            include: {
              users: {
                select: { id: true, username: true, displayName: true, avatarUrl: true, fcmToken: true },
              },
            },
          });

          if (callChat) {
            const callee = callChat.users.find((u) => u.id === targetUserId);
            if (callee) {
              const chatNameForCallee =
                callChat.name ||
                callChat.users.find((u) => u.id !== callee.id)?.displayName ||
                callChat.users.find((u) => u.id !== callee.id)?.username ||
                'Личный чат';

              const callTypeStr = call.type === 'AUDIO' ? 'audio' : 'video';
              const callerName = (user.displayName || user.username) ?? 'Пользователь';

              await pusherServer.trigger(`user-${targetUserId}`, 'incoming-call', {
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
                chatName: chatNameForCallee,
              });

              if (callee.fcmToken) {
                const calleeSettings = await prisma.userSettings.findUnique({
                  where: { userId: targetUserId },
                  select: { pushNotifications: true, mutedChats: true },
                });
                const shouldSend = calleeSettings?.pushNotifications !== false
                  && !calleeSettings?.mutedChats?.includes(chatId);
                if (shouldSend) {
                  sendPushNotification({
                    token: callee.fcmToken,
                    title: callTypeStr === 'video' ? '📹 Входящий видеозвонок' : '📞 Входящий звонок',
                    body: callerName,
                    data: {
                      type: 'call',
                      callId,
                      callType: callTypeStr,
                      chatId,
                      chatName: chatNameForCallee,
                      callerName,
                      callerId: user.id,
                    },
                  }).catch(() => {});
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('[Mobile Signal] Failed to send incoming notification:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send signal" },
      { status: 500 }
    );
  }
}
