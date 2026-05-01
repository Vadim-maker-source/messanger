"use server"

import { AccessType, ChatRole, ChatType } from "@prisma/client";
import { prisma } from "../prisma";
import { getCurrentUser } from "./user";
import { pusherServer } from "../pusher";

interface CreateData {
  name: string;
  imageUrl?: string;
  access: string;
  type?: string;
}

// --- СОЗДАНИЕ ИЛИ ПОЛУЧЕНИЕ ПРИВАТНОГО ЧАТА ---
export async function getOrCreatePrivateChat(partnerId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  const partnerSettings = await prisma.userSettings.findUnique({
    where: { userId: partnerId },
    select: { allowDirectMessages: true }
  });
  const allowDirectMessages = partnerSettings?.allowDirectMessages || "everyone";
  if (allowDirectMessages === "nobody") {
    throw new Error("Этот пользователь запретил личные сообщения");
  }

  // Ищем существующий приватный чат между этими двумя юзерами
  const existingChat = await prisma.chat.findFirst({
    where: {
      type: "PRIVATE",
      AND: [
        { users: { some: { id: currentUser.id } } },
        { users: { some: { id: partnerId } } }
      ]
    },
    include: {
      users: true
    }
  });

  if (existingChat) return existingChat;

  // Если нет — создаем новый
  return await prisma.chat.create({
    data: {
      type: "PRIVATE",
      users: {
        connect: [{ id: currentUser.id }, { id: partnerId }]
      }
    },
    include: {
      users: true
    }
  });
}

// --- ПОЛУЧЕНИЕ ВСЕХ ЧАТОВ ПОЛЬЗОВАТЕЛЯ ---
export async function getUserChats() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const chats = await prisma.chat.findMany({
    where: {
      users: { some: { id: currentUser.id } },
      serverId: null // Получаем только личные и групповые чаты вне серверов
    },
    include: {
      users: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true
        }
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  // Логика отображения имени: если PRIVATE — берем имя собеседника
  return chats.map(chat => {
    if (chat.type === "PRIVATE") {
      const partner = chat.users.find(u => u.id !== currentUser.id);
      return {
        ...chat,
        displayTitle: partner?.displayName || partner?.username || "Чат",
        displayImage: partner?.avatarUrl
      };
    }
    return {
      ...chat,
      displayTitle: chat.name,
      displayImage: chat.imageUrl
    };
  });
}

// --- СОЗДАНИЕ СЕРВЕРА ---

// --- СОЗДАНИЕ СЕРВЕРА С КАНАЛАМИ ---
export async function createServer(data: CreateData) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  return await prisma.server.create({
    data: {
      name: data.name,
      imageUrl: data.imageUrl,
      access: data.access as AccessType,
      ownerId: currentUser.id,
      inviteCode: Math.random().toString(36).substring(2, 12),
      members: { connect: [{ id: currentUser.id }] },
      chats: {
        create: [
          { 
            name: "общий", 
            type: "CHANNEL" as ChatType, 
            access: data.access as AccessType,
            users: { connect: [{ id: currentUser.id }] } 
          },
          { 
            name: "флуд", 
            type: "CHANNEL" as ChatType, 
            access: data.access as AccessType,
            users: { connect: [{ id: currentUser.id }] } 
          }
        ]
      }
    }
  });
}

export async function getUserSidebarData() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  console.log("Loading sidebar data for user:", currentUser.id);

  // Получаем ВСЕ чаты пользователя (и PRIVATE, и GROUP, и CHANNEL), которые не на сервере
  const allChats = await prisma.chat.findMany({
    where: {
      users: { some: { id: currentUser.id } },
      serverId: null,
    },
    include: {
      users: {
        select: { id: true, username: true, displayName: true, avatarUrl: true }
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          readReceipts: {
            select: { userId: true, readAt: true }
          }
        }
      },
      members: {
        where: { userId: currentUser.id },
        select: { role: true }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  // Подсчет непрочитанных сообщений для каждого чата
  const chatsWithUnread = await Promise.all(
    allChats.map(async (chat) => {
      const unreadCount = await prisma.message.count({
        where: {
          chatId: chat.id,
          userId: { not: currentUser.id },
          readReceipts: {
            none: { userId: currentUser.id }
          }
        }
      });

      return { ...chat, unreadCount };
    })
  );

  // Форматируем чаты
  const formattedChats = chatsWithUnread.map(chat => {
    let displayTitle = chat.name;
    let displayImage = chat.imageUrl;

    if (chat.type === "PRIVATE") {
      const partner = chat.users.find(u => u.id !== currentUser.id);
      displayTitle = partner?.displayName || partner?.username || "Чат";
      displayImage = String(partner?.avatarUrl);
    }

    const lastMessage = chat.messages[0];
    let lastMessageFormatted = null;
    
    if (lastMessage) {
      let messageStatus = null;
      if (lastMessage.userId === currentUser.id) {
        const readers = lastMessage.readReceipts.length;
        const totalMembers = chat.type === 'PRIVATE' ? 2 : chat.users.length;
        if (readers >= totalMembers - 1) {
          messageStatus = 'READ';
        } else if (readers > 0) {
          messageStatus = 'DELIVERED';
        } else {
          messageStatus = 'SENT';
        }
      }
      
      lastMessageFormatted = {
        content: lastMessage.content,
        createdAt: lastMessage.createdAt,
        status: messageStatus,
        senderId: lastMessage.userId
      };
    }

    return {
      id: chat.id,
      uiType: "CHAT",
      type: chat.type,
      title: displayTitle,
      image: displayImage,
      lastMessage: lastMessageFormatted,
      unreadCount: chat.unreadCount, // Только непрочитанные
      updatedAt: chat.updatedAt,
      isTyping: false,
    };
  });

  // Получаем серверы с каналами и их непрочитанными
  const servers = await prisma.server.findMany({
    where: {
      members: { some: { id: currentUser.id } }
    },
    include: {
      chats: {
        orderBy: { createdAt: "asc" },
        include: {
          _count: {
            select: { users: true }
          }
        }
      },
      _count: {
        select: { members: true }
      }
    }
  });

  // Подсчет непрочитанных для каналов серверов
  const serversWithUnread = await Promise.all(
    servers.map(async (server) => {
      const chatsWithUnreadCounts = await Promise.all(
        server.chats.map(async (chat) => {
          const unreadCount = await prisma.message.count({
            where: {
              chatId: chat.id,
              userId: { not: currentUser.id },
              readReceipts: {
                none: { userId: currentUser.id }
              }
            }
          });

          return {
            ...chat,
            unreadCount
          };
        })
      );

      return {
        ...server,
        chats: chatsWithUnreadCounts
      };
    })
  );

  const formattedServers = serversWithUnread.map(server => ({
    id: server.id,
    uiType: "SERVER",
    type: "SERVER",
    title: server.name,
    image: server.imageUrl,
    updatedAt: server.updatedAt,
    chats: server.chats.map(chat => ({
      id: chat.id,
      name: chat.name || `Канал ${chat.id.slice(0, 6)}`,
      type: chat.type,
      access: chat.access,
      unreadCount: chat.unreadCount
    }))
  }));

  const allItems = [...formattedChats, ...formattedServers];
  
  return allItems.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getChatMessagesWithStatus(chatId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const messages = await prisma.message.findMany({
    where: { chatId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        }
      },
      replyTo: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            }
          }
        }
      },
      readReceipts: {
        select: {
          userId: true,
          readAt: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  // Добавляем статус для каждого сообщения
  const messagesWithStatus = messages.map(message => {
    const isOwn = message.userId === user.id;
    let status = null;
    
    if (isOwn) {
      const readersCount = message.readReceipts.length;
      const chat = message.chatId;
      // Для приватного чата нужно 2 прочтения (отправитель + получатель)
      // Для группы нужно, чтобы все участники прочитали
      if (readersCount >= 2) { // Упрощенно, в реальности нужно знать количество участников
        status = 'READ';
      } else if (readersCount >= 1) {
        status = 'DELIVERED';
      } else {
        status = 'SENT';
      }
    }

    return {
      ...message,
      status,
      readBy: message.readReceipts.map(r => r.user)
    };
  });

  return messagesWithStatus;
}

export type FileType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'ROUND' | 'FILE';

export async function getMessages(chatId: string) {
  const user = await getCurrentUser();
  
  return await prisma.message.findMany({
    where: { chatId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        }
      },
      replyTo: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            }
          }
        }
      },
      readReceipts: { // Добавляем отчеты о прочтении
        select: {
          userId: true,
          readAt: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function createGroupChat({ name, imageUrl, access, userIds }: any) {
  const user = await getCurrentUser();
  if (!user) return null;

  const allParticipants = Array.from(new Set([...(userIds || []), user.id]));
  
  console.log("Creating group chat with participants:", allParticipants);
  
  // Проверка настроек приватности
  const restrictedUsers = await prisma.userSettings.findMany({
    where: {
      userId: { in: allParticipants.filter((id: string) => id !== user.id) },
      allowAddToChats: "nobody"
    },
    select: { userId: true }
  });

  if (restrictedUsers.length > 0) {
    throw new Error("Некоторых пользователей нельзя добавить в чат из-за настроек приватности");
  }

  // Создаем группу
  const chat = await prisma.chat.create({
    data: {
      name: name || "Группа",
      imageUrl,
      type: "GROUP",
      access: access as AccessType,
    }
  });
  
  console.log("Group chat created:", chat.id);
  
  // Добавляем участников с ролями
  for (const participantId of allParticipants) {
    const role = participantId === user.id ? 'CREATOR' : 'MEMBER';
    await prisma.chatMember.create({
      data: {
        userId: participantId,
        chatId: chat.id,
        role
      }
    });
    console.log(`Added member ${participantId} with role ${role}`);
  }
  
  // Обновляем updatedAt
  await prisma.chat.update({
    where: { id: chat.id },
    data: { updatedAt: new Date() }
  });
  
  // Добавляем пользователя в список users чата (для связи many-to-many)
  await prisma.chat.update({
    where: { id: chat.id },
    data: {
      users: {
        connect: allParticipants.map(id => ({ id }))
      }
    }
  });
  
  console.log("Group chat fully created with users");
  
  return chat;
}

export async function searchMessages(chatId: string, query: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      OR: [
        { users: { some: { id: user.id } } },
        { members: { some: { userId: user.id } } }
      ]
    },
    select: { id: true }
  });

  if (!chat) {
    throw new Error("Not authorized to access this chat");
  }

  return await prisma.message.findMany({
    where: {
      chatId,
      deleted: false,
      content: {
        contains: normalizedQuery,
        mode: "insensitive"
      }
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true
        }
      },
      replyTo: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          }
        }
      },
      readReceipts: {
        select: {
          userId: true,
          readAt: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" },
    take: 100
  });
}


// Поиск людей для приглашения
export async function getInviteSuggestions(query: string = "") {
  const user = await getCurrentUser();
  if (!user) return [];

  // 1. Получаем ID всех людей, с которыми есть приватные чаты
  const privateChats = await prisma.chat.findMany({
    where: {
      type: "PRIVATE",
      users: { some: { id: user.id } }
    },
    include: { users: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
  });

  const recentUserIds = privateChats
    .flatMap(chat => chat.users)
    .filter(u => u.id !== user.id);

  // 2. Если есть запрос — ищем по всей базе, если нет — отдаем недавних
  if (query.length > 0) {
    return await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: user.id } },
          { OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } }
          ]}
        ]
      },
      take: 10
    });
  }

  return recentUserIds;
}

// Создание сервера с каналами и участниками
export async function createFullServer({ name, imageUrl, access, channels, userIds }: any) {
  const user = await getCurrentUser();
  if (!user) return null;

  // Добавляем создателя в список участников
  const allMemberIds = Array.from(new Set([...(userIds || []), user.id]));

  // Сначала создаем сервер
  const server = await prisma.server.create({
    data: {
      name: name || "Новый сервер",
      imageUrl,
      access: access as AccessType,
      ownerId: user.id,
      members: {
        connect: allMemberIds.map(id => ({ id }))
      }
    }
  });

  // Создаем каналы и добавляем в них участников
  const createdChats = [];
  for (const ch of channels) {
    const chatName = ch.name?.trim() || (ch.type === "CHANNEL" ? "канал" : "группа");
    
    const chat = await prisma.chat.create({
      data: {
        name: chatName,
        type: ch.type === "CHANNEL" ? "CHANNEL" : "GROUP",
        access: access as AccessType,
        serverId: server.id,
        users: {
          connect: allMemberIds.map(id => ({ id }))
        }
      }
    });

    // Добавляем участников с ролями в каналы
    for (const memberId of allMemberIds) {
      const role = memberId === user.id ? 'CREATOR' : 'MEMBER';
      await prisma.chatMember.create({
        data: {
          userId: memberId,
          chatId: chat.id,
          role: ch.type === "CHANNEL" && memberId !== user.id ? 'MEMBER' : role
        }
      });
    }
    
    createdChats.push(chat);
  }

  return {
    ...server,
    chats: createdChats
  };
}

export async function editMessage(messageId: string, newContent: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { user: true }
  });

  if (!message) throw new Error("Message not found");
  if (message.userId !== user.id) throw new Error("Not authorized to edit this message");

  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { content: newContent, updatedAt: new Date() },
    include: { 
      user: { 
        select: { 
          id: true, 
          username: true, 
          displayName: true, 
          avatarUrl: true 
        } 
      } 
    }
  });

  // Приводим reactions к нужному типу
  const formattedMessage = {
    ...updatedMessage,
    reactions: updatedMessage.reactions as { [key: string]: string[] } | null
  };

  await pusherServer.trigger(message.chatId, "message-updated", formattedMessage);
  return formattedMessage;
}

export async function deleteMessage(messageId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { chat: { include: { server: true } } }
  });

  if (!message) throw new Error("Message not found");
  
  const chat = message.chat;
  const isOwner = chat.serverId ? chat.server?.ownerId === user.id : false;
  const isAuthor = message.userId === user.id;
  
  if (!isAuthor && !isOwner) throw new Error("Not authorized to delete this message");

  // Полное удаление сообщения из базы данных
  await prisma.message.delete({
    where: { id: messageId }
  });

  // Отправляем событие об удалении
  await pusherServer.trigger(message.chatId, "message-deleted", messageId);
  
  return { success: true };
}

export async function forwardMessage(messageId: string, targetChatId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const originalMessage = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      user: true,
      chat: {
        include: {
          users: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          }
        }
      }
    }
  });

  if (!originalMessage) throw new Error("Message not found");
  const sourceChat = originalMessage.chat;
  const sourceName =
    sourceChat.type === "CHANNEL"
      ? sourceChat.name || "Канал"
      : sourceChat.name || (sourceChat.type === "PRIVATE" ? "Личный чат" : "Чат");
  const forwardedData: any = {
    content: originalMessage.content,
    fileUrl: originalMessage.fileUrl,
    fileType: originalMessage.fileType,
    userId: user.id,
    chatId: targetChatId,
    forwardedFromMessageId: originalMessage.id,
    forwardedFromChatId: sourceChat.id,
    forwardedFromChatName: sourceName,
    forwardedFromChatType: sourceChat.type,
    forwardedFromUserId: originalMessage.userId,
    forwardedFromUserName: originalMessage.user.displayName || originalMessage.user.username
  };

  // Создаем новое сообщение с пометкой что это пересланное
  const forwardedMessage = await prisma.message.create({
    data: forwardedData,
    include: { 
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        }
      },
      replyTo: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            }
          }
        }
      }
    }
  });

  await pusherServer.trigger(targetChatId, "new-message", forwardedMessage);
  return forwardedMessage;
}

export async function createChat({ name, imageUrl, access, type, userIds }: any) {
  const user = await getCurrentUser();
  if (!user) return null;

  const allParticipants = Array.from(new Set([...(userIds || []), user.id]));
  
  console.log("Creating channel/group with participants:", allParticipants);
  
  // Проверка настроек приватности
  const restrictedUsers = await prisma.userSettings.findMany({
    where: {
      userId: { in: allParticipants.filter((id: string) => id !== user.id) },
      allowAddToChats: "nobody"
    },
    select: { userId: true }
  });
  
  if (restrictedUsers.length > 0) {
    throw new Error("Некоторых пользователей нельзя добавить в чат из-за настроек приватности");
  }

  // Создаем чат
  const chat = await prisma.chat.create({
    data: {
      name: name || (type === 'CHANNEL' ? 'Канал' : 'Группа'),
      imageUrl,
      type: type as ChatType,
      access: access as AccessType,
    }
  });
  
  console.log("Chat created:", chat.id);
  
  // Добавляем участников с ролями
  for (const participantId of allParticipants) {
    const role = participantId === user.id ? 'CREATOR' : 'MEMBER';
    await prisma.chatMember.create({
      data: {
        userId: participantId,
        chatId: chat.id,
        role
      }
    });
    console.log(`Added member ${participantId} with role ${role}`);
  }
  
  // Добавляем пользователей в связь many-to-many
  await prisma.chat.update({
    where: { id: chat.id },
    data: {
      users: {
        connect: allParticipants.map(id => ({ id }))
      }
    }
  });
  
  // Обновляем updatedAt
  await prisma.chat.update({
    where: { id: chat.id },
    data: { updatedAt: new Date() }
  });
  
  console.log("Chat fully created with users");
  
  return chat;
}

export async function canAccessChat(chatId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      OR: [
        { users: { some: { id: user.id } } },
        { members: { some: { userId: user.id } } }
      ]
    },
    select: { id: true }
  });

  return !!chat;
}

// Обновленная функция добавления реакции (только одна реакция)
export async function addReaction(messageId: string, reaction: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const message = await prisma.message.findUnique({
    where: { id: messageId }
  });

  if (!message) throw new Error("Message not found");

  let reactions = message.reactions as any || {};
  
  // Удаляем предыдущую реакцию пользователя
  for (const [key, users] of Object.entries(reactions)) {
    if (Array.isArray(users) && users.includes(user.id)) {
      reactions[key] = (users as string[]).filter(id => id !== user.id);
      if (reactions[key].length === 0) {
        delete reactions[key];
      }
    }
  }
  
  // Добавляем новую реакцию
  if (!reactions[reaction]) reactions[reaction] = [];
  if (!reactions[reaction].includes(user.id)) {
    reactions[reaction].push(user.id);
  }

  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { reactions: reactions }
  });

  const formattedReactions = reactions as { [key: string]: string[] } | null;
  
  await pusherServer.trigger(message.chatId, "reaction-updated", { 
    messageId, 
    reactions: formattedReactions 
  });
  
  return { ...updatedMessage, reactions: formattedReactions };
}

// Функция для удаления реакции
export async function removeReaction(messageId: string, reaction: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const message = await prisma.message.findUnique({
    where: { id: messageId }
  });

  if (!message) throw new Error("Message not found");

  let reactions = message.reactions as any || {};
  
  if (reactions[reaction]) {
    reactions[reaction] = reactions[reaction].filter((id: string) => id !== user.id);
    if (reactions[reaction].length === 0) {
      delete reactions[reaction];
    }
  }

  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { reactions: reactions }
  });

  const formattedReactions = reactions as { [key: string]: string[] } | null;
  
  await pusherServer.trigger(message.chatId, "reaction-updated", { 
    messageId, 
    reactions: formattedReactions 
  });
  
  return { ...updatedMessage, reactions: formattedReactions };
}

export async function getAvailableChats() {
  const user = await getCurrentUser();
  if (!user) return [];

  // Получаем все чаты пользователя (включая каналы на серверах)
  const allChats = await prisma.chat.findMany({
    where: {
      users: { some: { id: user.id } }
    },
    include: {
      users: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true
        }
      },
      server: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  const formattedChats = allChats.map(chat => {
    let title = chat.name;
    let image = chat.imageUrl;
    let subtitle = "";
    
    if (chat.type === "PRIVATE") {
      const partner = chat.users.find(u => u.id !== user.id);
      title = partner?.displayName || partner?.username || "Чат";
      image = String(partner?.avatarUrl);
    }
    
    // Добавляем информацию о сервере для каналов
    if (chat.server) {
      subtitle = chat.server.name;
    }
    
    return {
      id: chat.id,
      title: title || (chat.server ? "Канал" : "Чат"),
      image: image,
      type: chat.type,
      subtitle: subtitle
    };
  });

  return formattedChats;
}






export async function getUserRoleInChat(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId,
        chatId
      }
    }
  });
  
  return member?.role || null;
}

// Добавление участника в чат с ролью
export async function addChatMember(chatId: string, userId: string, role: ChatRole = 'MEMBER') {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { server: true }
  });
  
  if (!chat) throw new Error("Chat not found");
  
  // Проверяем, не является ли чат приватным
  if (chat.type === "PRIVATE") {
    throw new Error("Cannot add members to private chat");
  }

  const targetSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { allowAddToChats: true }
  });
  if ((targetSettings?.allowAddToChats || "everyone") === "nobody") {
    throw new Error("Пользователь запретил добавление в чаты");
  }
  
  return await prisma.chatMember.upsert({
    where: {
      userId_chatId: {
        userId,
        chatId
      }
    },
    update: { role },
    create: {
      userId,
      chatId,
      role
    }
  });
}

// Изменение роли участника
export async function updateMemberRole(chatId: string, targetUserId: string, newRole: ChatRole, currentUserId: string) {
  const currentUserRole = await getUserRoleInChat(chatId, currentUserId);
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { server: true }
  });
  
  if (!chat) throw new Error("Chat not found");
  
  // Проверка прав
  if (chat.type === "PRIVATE") {
    throw new Error("Cannot manage roles in private chat");
  }
  
  // Только создатель или админ могут менять роли
  if (currentUserRole !== 'CREATOR' && currentUserRole !== 'ADMIN') {
    throw new Error("Not authorized to manage roles");
  }
  
  // Нельзя понижать создателя
  const targetRole = await getUserRoleInChat(chatId, targetUserId);
  if (targetRole === 'CREATOR') {
    throw new Error("Cannot change creator's role");
  }
  
  // Если текущий пользователь админ, он не может менять роли других админов
  if (currentUserRole === 'ADMIN' && targetRole === 'ADMIN') {
    throw new Error("Admins cannot change other admins' roles");
  }
  
  return await prisma.chatMember.update({
    where: {
      userId_chatId: {
        userId: targetUserId,
        chatId
      }
    },
    data: { role: newRole }
  });
}

// Удаление участника из чата
export async function removeChatMember(chatId: string, targetUserId: string, currentUserId: string) {
  const currentUserRole = await getUserRoleInChat(chatId, currentUserId);
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { server: true }
  });
  
  if (!chat) throw new Error("Chat not found");
  
  // Нельзя удалить создателя
  const targetRole = await getUserRoleInChat(chatId, targetUserId);
  if (targetRole === 'CREATOR') {
    throw new Error("Cannot remove creator");
  }
  
  // Проверка прав
  if (currentUserRole === 'CREATOR' || 
      (currentUserRole === 'ADMIN' && targetRole !== 'ADMIN') ||
      currentUserId === targetUserId) {
    return await prisma.chatMember.delete({
      where: {
        userId_chatId: {
          userId: targetUserId,
          chatId
        }
      }
    });
  }
  
  throw new Error("Not authorized to remove this member");
}

export async function sendMessage(
  chatId: string, 
  content: string, 
  fileUrl?: string | null, 
  fileType?: string | null,
  fileName?: string | null,
  replyToId?: string | null
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { server: true }
  });

  if (!chat) throw new Error("Chat not found");

  // Проверка прав для каналов
  if (chat.type === "CHANNEL") {
    const userRole = await getUserRoleInChat(chatId, user.id);
    const isOwner = chat.serverId ? chat.server?.ownerId === user.id : false;
    const canWrite = isOwner || userRole === 'CREATOR' || userRole === 'ADMIN';
    
    if (!canWrite) {
      throw new Error("Только администратор может писать в канал");
    }
  }

  // Для файлов без текста добавляем стандартное описание
  let finalContent = content;
  let finalFileName = fileName;
  
  if (fileUrl && !content?.trim()) {
    if (fileType === 'IMAGE') finalContent = "📷 Фото";
    else if (fileType === 'VIDEO') finalContent = "🎥 Видео";
    else if (fileType === 'AUDIO') finalContent = "🎤 Голосовое сообщение";
    else if (fileType === 'ROUND') finalContent = "📹 Видеосообщение";
    else finalContent = "📎 Файл";
  }

  const message = await prisma.message.create({
    data: {
      content: finalContent,
      fileUrl: fileUrl || null,
      fileName: finalFileName || null,
      fileType: fileType || null,
      userId: user.id,
      chatId: chatId,
      replyToId: replyToId || null
    },
    include: { 
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        }
      },
      replyTo: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            }
          }
        }
      }
    }
  });

  await pusherServer.trigger(chatId, "new-message", message);

  // Обновляем updatedAt чата
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() }
  });

  // Отправляем событие для обновления сайдбара
  const chatMembers = await prisma.chatMember.findMany({
    where: { chatId },
    select: { userId: true }
  });

  for (const member of chatMembers) {
    if (member.userId !== user.id) {
      await pusherServer.trigger(`user-${member.userId}`, "unread-update", {
        chatId,
        timestamp: new Date()
      });
    }
  }

  return message;
}



// Обновленная функция получения информации о чате с ролями
export async function getChatInfo(chatId: string) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            }
          }
        }
      },
      server: true
    }
  });
  
  return chat;
}

export async function checkCanWriteInChat(chatId: string, userId: string): Promise<boolean> {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { server: true }
  });
  
  if (!chat) return false;
  
  if (chat.type === "CHANNEL") {
    const userRole = await getUserRoleInChat(chatId, userId);
    const isOwner = chat.serverId ? chat.server?.ownerId === userId : false;
    return isOwner || userRole === 'CREATOR' || userRole === 'ADMIN';
  }
  
  // Для приватных чатов и групп все участники могут писать
  return true;
}








export async function markMessagesAsRead(chatId: string, lastReadMessageId?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  // Получаем все сообщения в чате, которые не прочитаны пользователем
  const messages = await prisma.message.findMany({
    where: {
      chatId,
      userId: { not: user.id }, // Не свои сообщения
      readReceipts: {
        none: { userId: user.id }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  if (messages.length === 0) return [];

  // Создаем записи о прочтении
  const readReceipts = await prisma.$transaction(
    messages.map(message => 
      prisma.readReceipt.create({
        data: {
          messageId: message.id,
          userId: user.id,
          chatId
        }
      })
    )
  );

  // Отправляем событие через Pusher о прочтении сообщений
  await pusherServer.trigger(chatId, "messages-read", {
    userId: user.id,
    messageIds: messages.map(m => m.id),
    readAt: new Date()
  });

  return readReceipts;
}

// Получить информацию о прочтении сообщений для чата
export async function getReadReceipts(chatId: string, messageIds?: string[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const where: any = { chatId };
  if (messageIds && messageIds.length > 0) {
    where.messageId = { in: messageIds };
  }

  const receipts = await prisma.readReceipt.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true
        }
      }
    },
    orderBy: { readAt: 'desc' }
  });

  // Группируем по сообщениям
  const receiptsByMessage = receipts.reduce((acc, receipt) => {
    if (!acc[receipt.messageId]) {
      acc[receipt.messageId] = [];
    }
    acc[receipt.messageId].push(receipt);
    return acc;
  }, {} as Record<string, typeof receipts>);

  return receiptsByMessage;
}

// Получить статус прочтения для конкретного сообщения
export async function getMessageReadStatus(messageId: string) {
  const receipts = await prisma.readReceipt.findMany({
    where: { messageId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true
        }
      }
    }
  });

  const totalReaders = receipts.length;
  const readers = receipts.map(r => r.user);

  return { totalReaders, readers };
}

// Удаление чата
export async function deleteChat(chatId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  // Получаем чат с информацией о сервере
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      server: true,
      members: {
        where: { userId: user.id },
        select: { role: true }
      }
    }
  });

  if (!chat) throw new Error("Chat not found");

  // Проверка прав на удаление
  let canDelete = false;

  if (chat.type === "PRIVATE") {
    // Приватный чат может удалить любой из участников
    canDelete = true;
  } else if (chat.serverId) {
    // Канал на сервере - только создатель сервера
    if (chat.server?.ownerId === user.id) {
      canDelete = true;
    }
  } else {
    // Обычная группа или канал - только создатель или админ
    const userRole = chat.members[0]?.role;
    canDelete = userRole === 'CREATOR' || userRole === 'ADMIN';
  }

  if (!canDelete) {
    throw new Error("У вас нет прав на удаление этого чата");
  }

  // Удаляем все сообщения чата
  await prisma.message.deleteMany({
    where: { chatId }
  });

  // Удаляем все read receipts
  await prisma.readReceipt.deleteMany({
    where: { chatId }
  });

  // Удаляем всех участников
  await prisma.chatMember.deleteMany({
    where: { chatId }
  });

  // Удаляем сам чат
  await prisma.chat.delete({
    where: { id: chatId }
  });

  return { success: true };
}
// --- ОБНОВЛЕНИЕ СЕРВЕРА ---
export async function updateServer(serverId: string, data: { name?: string; imageUrl?: string; access?: string }) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { ownerId: true }
  });

  if (!server) throw new Error("Server not found");
  if (server.ownerId !== user.id) throw new Error("Only server owner can update server");

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.access !== undefined) updateData.access = data.access as AccessType;

  const updatedServer = await prisma.server.update({
    where: { id: serverId },
    data: updateData
  });

  return updatedServer;
}

// --- СОЗДАНИЕ КАНАЛА НА СЕРВЕРЕ ---
export async function createServerChannel(serverId: string, data: { name: string; type?: ChatType; access?: string }) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: {
      members: {
        select: { id: true }
      }
    }
  });

  if (!server) throw new Error("Server not found");
  if (server.ownerId !== user.id) throw new Error("Only server owner can create channels");

  // Создаем канал
  const channel = await prisma.chat.create({
    data: {
      name: data.name,
      type: data.type || "CHANNEL",
      access: (data.access as AccessType) || server.access,
      serverId: server.id,
      users: {
        connect: server.members.map(m => ({ id: m.id }))
      }
    }
  });

  // Создаем ChatMember для всех участников сервера
  await Promise.all(
    server.members.map(member =>
      prisma.chatMember.create({
        data: {
          userId: member.id,
          chatId: channel.id,
          role: member.id === server.ownerId ? 'CREATOR' : 'MEMBER'
        }
      })
    )
  );

  return channel;
}

// --- ОБНОВЛЕНИЕ ЧАТА ---
export async function updateChat(chatId: string, data: { name?: string; imageUrl?: string; access?: string }) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      server: true,
      members: {
        where: { userId: user.id },
        select: { role: true }
      }
    }
  });

  if (!chat) throw new Error("Chat not found");

  // Проверка прав на обновление
  let canUpdate = false;

  if (chat.type === "PRIVATE") {
    throw new Error("Cannot update private chat");
  } else if (chat.serverId) {
    // Канал на сервере - только создатель сервера
    canUpdate = chat.server?.ownerId === user.id;
  } else {
    // Обычная группа или канал - только создатель или админ
    const userRole = chat.members[0]?.role;
    canUpdate = userRole === 'CREATOR' || userRole === 'ADMIN';
  }

  if (!canUpdate) {
    throw new Error("У вас нет прав на обновление этого чата");
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.access !== undefined) updateData.access = data.access as AccessType;

  const updatedChat = await prisma.chat.update({
    where: { id: chatId },
    data: updateData
  });

  return updatedChat;
}
