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

  const invite = await prisma.invite.findUnique({
    where: { code },
    include: { chat: true }
  });

  if (!invite) throw new Error("Invalid invite code");
  if (!invite.chat) throw new Error("Chat not found for this invite");
  if (!invite.chatId) throw new Error("Invalid invite");

  // Проверка срока действия
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new Error("Invite link has expired");
  }

  // Проверка лимита использований
  if (invite.maxUses && invite.uses >= invite.maxUses) {
    throw new Error("Invite link has reached its usage limit");
  }

  // Проверка, не в чате ли уже пользователь
  const existingMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId: user.id,
        chatId: invite.chatId
      }
    }
  });

  if (existingMember) {
    throw new Error("You are already a member of this chat");
  }

  // Проверка приватности настройки пользователя
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: user.id }
  });

  if (userSettings?.allowAddToChats === 'nobody' && invite.chat.access !== 'PUBLIC') {
    throw new Error("You cannot join this chat due to your privacy settings");
  }

  // Добавление пользователя в чат
  const member = await prisma.chatMember.create({
    data: {
      userId: user.id,
      chatId: invite.chatId,
      role: 'MEMBER'
    }
  });

  // Увеличиваем счетчик использований
  await prisma.invite.update({
    where: { id: invite.id },
    data: { uses: { increment: 1 } }
  });

  // Отправляем событие в чат (только если chatId не null)
  if (invite.chatId) {
    await pusherServer.trigger(invite.chatId, "new-member", {
      userId: user.id,
      userName: user.displayName || user.username,
      joinedAt: new Date()
    });
  }

  return { chat: invite.chat, member };
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

// Получение информации об инвайте по коду (без авторизации)
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
      }
    }
  });

  if (!invite) throw new Error("Invalid invite code");
  if (!invite.chat) throw new Error("Chat not found");

  // Проверка срока действия
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new Error("Invite link has expired");
  }

  // Проверка лимита использований
  if (invite.maxUses && invite.uses >= invite.maxUses) {
    throw new Error("Invite link has reached its usage limit");
  }

  return {
    chat: {
      id: invite.chat.id,
      name: invite.chat.name,
      type: invite.chat.type,
      imageUrl: invite.chat.imageUrl,
      access: invite.chat.access
    },
    invite: {
      uses: invite.uses,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt
    },
    memberCount: invite.chat._count.members
  };
}