'use server'

import { prisma } from "../prisma";
import { getCurrentUser } from "./user";

export async function globalSearch(query: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { users: [], chats: [], servers: [] };

  const searchTerm = query.toLowerCase();

  // Поиск пользователей
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: searchTerm, mode: 'insensitive' } },
        { displayName: { contains: searchTerm, mode: 'insensitive' } }
      ],
      id: { not: currentUser.id }
    },
    take: 10,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    }
  });

  // Поиск чатов (группы и приватные чаты, где пользователь участвует)
  const chats = await prisma.chat.findMany({
    where: {
      AND: [
        { users: { some: { id: currentUser.id } } },
        { serverId: null },
        {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { users: { some: { displayName: { contains: searchTerm, mode: 'insensitive' } } } }
          ]
        }
      ]
    },
    include: {
      users: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        }
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    },
    take: 10
  });

  // Форматируем чаты для отображения
  const formattedChats = chats.map(chat => {
    if (chat.type === 'PRIVATE') {
      const partner = chat.users.find(u => u.id !== currentUser.id);
      return {
        id: chat.id,
        type: chat.type,
        name: partner?.displayName || partner?.username || "Чат",
        displayTitle: partner?.displayName || partner?.username,
        lastMessage: chat.messages[0]?.content,
        imageUrl: partner?.avatarUrl
      };
    }
    return {
      id: chat.id,
      type: chat.type,
      name: chat.name,
      displayTitle: chat.name,
      lastMessage: chat.messages[0]?.content,
      imageUrl: chat.imageUrl
    };
  });

  // Поиск серверов
  const servers = await prisma.server.findMany({
    where: {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } }
      ],
      members: { some: { id: currentUser.id } }
    },
    include: {
      members: {
        select: { id: true }
      },
      _count: {
        select: { members: true }
      }
    },
    take: 10
  });

  const formattedServers = servers.map(server => ({
    id: server.id,
    name: server.name,
    imageUrl: server.imageUrl,
    memberCount: server._count.members
  }));

  return {
    users,
    chats: formattedChats,
    servers: formattedServers
  };
}

export async function getOrCreateDirectChat(userId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  // Ищем существующий приватный чат
  const existingChat = await prisma.chat.findFirst({
    where: {
      type: "PRIVATE",
      AND: [
        { users: { some: { id: currentUser.id } } },
        { users: { some: { id: userId } } }
      ]
    },
    include: {
      users: true
    }
  });

  if (existingChat) return existingChat;

  // Создаем новый приватный чат
  return await prisma.chat.create({
    data: {
      type: "PRIVATE",
      users: {
        connect: [{ id: currentUser.id }, { id: userId }]
      }
    },
    include: {
      users: true
    }
  });
}