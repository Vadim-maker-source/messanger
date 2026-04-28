'use server'

import { prisma } from "../prisma";
import { getCurrentUser } from "./user";
import { pusherServer } from "../pusher";

// Генерация инвайт-кода
export async function generateInviteCode(chatId: string, maxUses?: number, expiresAt?: Date) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      OR: [
        { users: { some: { id: user.id } } },
        { members: { some: { userId: user.id } } }
      ]
    },
    include: {
      server: true
    }
  });

  if (!chat) throw new Error("Chat not found");

  // Проверка прав (только создатель или админ могут создавать инвайты)
  const userRole = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId: user.id,
        chatId: chat.id
      }
    }
  });

  const isOwner = chat.serverId ? chat.server?.ownerId === user.id : false;
  const isAdmin = userRole?.role === 'CREATOR' || userRole?.role === 'ADMIN';

  if (!isOwner && !isAdmin && chat.type !== 'PRIVATE') {
    throw new Error("Not authorized to create invites");
  }

  const inviteCode = Math.random().toString(36).substring(2, 15) + 
    Math.random().toString(36).substring(2, 8);

  const invite = await prisma.invite.create({
    data: {
      code: inviteCode,
      chatId: chat.id,
      createdBy: user.id,
      maxUses: maxUses || null,
      expiresAt: expiresAt || null,
      uses: 0
    }
  });

  return invite;
}

// Получение всех инвайтов для чата
export async function getChatInvites(chatId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const invites = await prisma.invite.findMany({
    where: { chatId },
    orderBy: { createdAt: 'desc' }
  });

  return invites;
}

// Удаление инвайта
export async function revokeInvite(inviteId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    include: { chat: true }
  });

  if (!invite) throw new Error("Invite not found");
  if (!invite.chat) throw new Error("Chat not found for this invite");

  // Проверка прав
  const userRole = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId: user.id,
        chatId: invite.chat.id
      }
    }
  });

  const isOwner = invite.chat.serverId ? 
    await prisma.server.findFirst({
      where: { id: invite.chat.serverId, ownerId: user.id }
    }) : false;

  if (!isOwner && userRole?.role !== 'CREATOR' && userRole?.role !== 'ADMIN') {
    throw new Error("Not authorized to revoke invite");
  }

  await prisma.invite.delete({ where: { id: inviteId } });
  return { success: true };
}

// Присоединение по инвайту
export async function joinByInvite(code: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  // Ищем инвайт
  const invite = await prisma.invite.findUnique({
    where: { code },
    include: { 
      chat: true,
      server: {
        include: {
          chats: {
            take: 1,
            select: { id: true, name: true }
          }
        }
      }
    }
  });

  if (!invite) throw new Error("Invalid invite code");
  
  // Проверяем, активен ли инвайт
  if (!invite.isActive) {
    throw new Error("Invite link has been revoked");
  }

  // Проверка срока действия
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new Error("Invite link has expired");
  }

  // Проверка лимита использований
  if (invite.maxUses && invite.uses >= invite.maxUses) {
    throw new Error("Invite link has reached its usage limit");
  }

  // Определяем тип инвайта
  const isServerInvite = !!invite.serverId && invite.server;
  const isChatInvite = !!invite.chatId && invite.chat;

  // Обработка приглашения в СЕРВЕР
  if (isServerInvite && invite.server) {
    // Проверяем, не состоит ли уже пользователь в сервере
    const isMember = await prisma.server.findFirst({
      where: {
        id: String(invite.serverId),
        members: { some: { id: user.id } }
      }
    });

    if (isMember) {
      throw new Error("You are already a member of this server");
    }

    // Проверка настроек приватности пользователя
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id }
    });

    if (userSettings?.allowAddToChats === 'nobody' && invite.server.access !== 'PUBLIC') {
      throw new Error("You cannot join this server due to your privacy settings");
    }

    // Добавляем пользователя в сервер
    const updatedServer = await prisma.server.update({
      where: { id: String(invite.serverId) },
      data: {
        members: {
          connect: { id: user.id }
        }
      },
      include: {
        chats: {
          select: { id: true, name: true }
        }
      }
    });

    // Добавляем пользователя во все каналы сервера
    for (const chat of updatedServer.chats) {
      await prisma.chatMember.upsert({
        where: {
          userId_chatId: {
            userId: user.id,
            chatId: chat.id
          }
        },
        update: {},
        create: {
          userId: user.id,
          chatId: chat.id,
          role: 'MEMBER'
        }
      });

      // Также добавляем в связь users чата
      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          users: {
            connect: { id: user.id }
          }
        }
      });
    }

    // Увеличиваем счетчик использований инвайта
    await prisma.invite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } }
    });

    // Отправляем событие для обновления сайдбара
    await pusherServer.trigger(`user-${user.id}`, "sidebar-update", {
      type: 'server_joined',
      targetId: invite.serverId,
      timestamp: new Date()
    });

    const firstChat = updatedServer.chats[0];
    return { 
      server: updatedServer, 
      chat: firstChat,
      type: 'SERVER' 
    };
  }

  // Обработка приглашения в ЧАТ (GROUP или CHANNEL)
  if (isChatInvite && invite.chat) {
    // Проверяем, не состоит ли уже пользователь в чате
    const existingMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: user.id,
          chatId: String(invite.chatId)
        }
      }
    });

    if (existingMember) {
      throw new Error("You are already a member of this chat");
    }

    // Проверка настроек приватности пользователя
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id }
    });

    if (userSettings?.allowAddToChats === 'nobody' && invite.chat.access !== 'PUBLIC') {
      throw new Error("You cannot join this chat due to your privacy settings");
    }

    // Добавляем пользователя в чат
    const member = await prisma.chatMember.create({
      data: {
        userId: user.id,
        chatId: String(invite.chatId),
        role: 'MEMBER'
      }
    });

    // Добавляем пользователя в связь users чата
    await prisma.chat.update({
      where: { id: String(invite.chatId) },
      data: {
        users: {
          connect: { id: user.id }
        }
      }
    });

    // Увеличиваем счетчик использований инвайта
    await prisma.invite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } }
    });

    // Отправляем событие в чат
    await pusherServer.trigger(String(invite.chatId), "new-member", {
      userId: user.id,
      userName: user.displayName || user.username,
      joinedAt: new Date()
    });

    // Отправляем событие для обновления сайдбара
    await pusherServer.trigger(`user-${user.id}`, "sidebar-update", {
      type: 'chat_joined',
      targetId: invite.chatId,
      timestamp: new Date()
    });

    return { chat: invite.chat, member, type: 'CHAT' };
  }

  throw new Error("Invalid invite: neither chat nor server found");
}

// Функция для получения информации об инвайте (для страницы предпросмотра)
export async function getInviteInfo(code: string) {
  const invite = await prisma.invite.findUnique({
    where: { code },
    include: {
      chat: {
        include: {
          _count: {
            select: { members: true }
          }
        }
      },
      server: {
        include: {
          _count: {
            select: { members: true }
          }
        }
      }
    }
  });

  if (!invite) {
    throw new Error("Invalid invite code");
  }

  // Определяем тип инвайта
  const isServerInvite = !!invite.serverId && invite.server;
  const target = isServerInvite ? invite.server : invite.chat;
  
  if (!target) {
    throw new Error("Invite target not found");
  }

  // Проверка срока действия
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new Error("Invite link has expired");
  }

  // Проверка лимита использований
  if (invite.maxUses && invite.uses >= invite.maxUses) {
    throw new Error("Invite link has reached its usage limit");
  }

  return {
    chat: isServerInvite ? null : {
      id: invite.chat?.id,
      name: invite.chat?.name,
      type: invite.chat?.type,
      imageUrl: invite.chat?.imageUrl,
      access: invite.chat?.access
    },
    server: isServerInvite ? {
      id: invite.server?.id,
      name: invite.server?.name,
      imageUrl: invite.server?.imageUrl,
      access: invite.server?.access
    } : null,
    invite: {
      uses: invite.uses,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt
    },
    memberCount: isServerInvite 
      ? (invite.server?._count?.members || 0)
      : (invite.chat?._count?.members || 0),
    type: isServerInvite ? 'SERVER' : 'CHAT'
  };
}

// Обновление инвайта
export async function updateInvite(inviteId: string, data: { maxUses?: number | null, expiresAt?: Date | null }) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    include: { chat: true }
  });

  if (!invite) throw new Error("Invite not found");
  if (!invite.chat) throw new Error("Chat not found for this invite");
  if (!invite.chatId) throw new Error("Invalid invite");

  // Проверка прав
  const userRole = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId: user.id,
        chatId: invite.chatId
      }
    }
  });

  const isOwner = invite.chat.serverId ? 
    await prisma.server.findFirst({
      where: { id: invite.chat.serverId, ownerId: user.id }
    }) : false;

  if (!isOwner && userRole?.role !== 'CREATOR' && userRole?.role !== 'ADMIN') {
    throw new Error("Not authorized to update invite");
  }

  const updated = await prisma.invite.update({
    where: { id: inviteId },
    data: {
      maxUses: data.maxUses,
      expiresAt: data.expiresAt
    }
  });

  return updated;
}