/**
 * Helpers для системных сообщений (Telegram-style плашки в чате)
 * и псевдо-чатов "Уведомления" / "Избранное".
 */

import { prisma } from "@/app/lib/prisma";
import { socketServer } from "@/app/lib/socket-server";
import type { Message, Chat, ChatType } from "@prisma/client";

// ─── Системное сообщение в обычном чате ──────────────────────────────────────

/**
 * Добавляет системное сообщение в чат (например, "X добавил Y").
 * Эмитит pusher-событие "new-message" чтобы все участники чата увидели сразу.
 *
 * @param chatId — куда писать
 * @param text — готовый текст сообщения (поддерживается простая разметка)
 * @param actorId — кто инициировал (для атрибуции; null если не привязано)
 */
export async function postSystemMessage(
  chatId: string,
  text: string,
  actorId: string | null = null
): Promise<Message | null> {
  try {
    // Если actorId не передан — берём первого участника чата как "владельца"
    // системного сообщения (нужно из-за NOT NULL на Message.userId).
    let userId = actorId;
    if (!userId) {
      const member = await prisma.chatMember.findFirst({
        where: { chatId },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      });
      userId = member?.userId || null;
    }
    if (!userId) return null;

    const msg = await prisma.message.create({
      data: {
        chatId,
        userId,
        content: text.slice(0, 500),
        isSystem: true,
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    await prisma.chat
      .update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      })
      .catch(() => {});

    // Real-time для подписчиков чата
    socketServer.trigger(chatId, "new-message", msg).catch(() => {});

    return msg;
  } catch (e) {
    console.error("[postSystemMessage] failed:", e);
    return null;
  }
}

// ─── Псевдо-чат "Уведомления" ────────────────────────────────────────────────

/**
 * Возвращает (создаёт если нет) персональный чат NOTIFICATIONS пользователя.
 * Это псевдо-чат, виден только владельцу. Только сервер может туда писать.
 */
export async function ensureNotificationsChat(userId: string): Promise<Chat> {
  // Ищем существующий
  const existing = await prisma.chat.findFirst({
    where: {
      type: "NOTIFICATIONS",
      members: { some: { userId } },
    },
  });
  if (existing) return existing;

  // Создаём — chat + chatMember + связь users
  const chat = await prisma.chat.create({
    data: {
      type: "NOTIFICATIONS",
      name: "Уведомления",
      access: "PRIVATE",
      members: {
        create: { userId, role: "CREATOR" },
      },
      users: {
        connect: { id: userId },
      },
    },
  });

  // Welcome-сообщение
  await postSystemMessage(
    chat.id,
    "👋 Здесь будут появляться важные уведомления — приглашения, действия в ваших чатах и серверах.",
    userId
  );

  return chat;
}

// ─── Псевдо-чат "Избранное" ──────────────────────────────────────────────────

export async function ensureFavoritesChat(userId: string): Promise<Chat> {
  const existing = await prisma.chat.findFirst({
    where: {
      type: "FAVORITES",
      members: { some: { userId } },
    },
  });
  if (existing) return existing;

  return prisma.chat.create({
    data: {
      type: "FAVORITES",
      name: "Избранное",
      access: "PRIVATE",
      members: {
        create: { userId, role: "CREATOR" },
      },
      users: {
        connect: { id: userId },
      },
    },
  });
}

// ─── Уведомление в чат NOTIFICATIONS ────────────────────────────────────────

/**
 * Создаёт системное сообщение в чате NOTIFICATIONS пользователя.
 * Используется для глобальных событий ("X добавил вас в чат Y").
 */
export async function postNotification(
  userId: string,
  text: string
): Promise<void> {
  try {
    const chat = await ensureNotificationsChat(userId);
    await postSystemMessage(chat.id, text, userId);

    // Refresh sidebar для счётчика непрочитанных
    socketServer.trigger(`user-${userId}`, "sidebar-update", {}).catch(() => {});
  } catch (e) {
    console.error("[postNotification] failed:", e);
  }
}

// ─── Проверка можно ли писать в чат ──────────────────────────────────────────

/**
 * Возвращает true если в чат данного типа разрешено писать обычным юзерам.
 * NOTIFICATIONS и FAVORITES — нельзя.
 */
export function canUserWriteToChatType(type: ChatType): boolean {
  return type !== "NOTIFICATIONS" && type !== "FAVORITES";
}
