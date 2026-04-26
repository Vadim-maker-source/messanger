// app/lib/api/user.ts - исправленная версия

"use server"

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { authOptions } from "../auth";
import { pusherServer } from "../pusher";
import { randomBytes } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: process.env.YANDEX_ENDPOINT?.trim() || "https://storage.yandexcloud.net",
  region: process.env.YANDEX_REGION || "ru-central1",
  credentials: {
    accessKeyId: process.env.YANDEX_ACCESS!,
    secretAccessKey: process.env.YANDEX_SECRET!,
  },
  forcePathStyle: true,
});

export async function registerUser(data: any) {
  const { email, password, username, displayName } = data;

  if (!email || !password || !username || !displayName) {
    throw new Error("Заполните все поля");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }]
    }
  });

  if (existingUser) {
    throw new Error("Пользователь с таким email или username уже существует");
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName,
      hashedPassword,
    }
  });

  return { success: true, userId: user.id };
}

export async function getCurrentUser() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return null;
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!currentUser) return null;

    const { hashedPassword, ...userWithoutPassword } = currentUser;
    return userWithoutPassword;
  } catch (error) {
    return null;
  }
}

export async function getCurrentUser2() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return null;
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!currentUser) return null;

    return currentUser;
  } catch (error) {
    return null;
  }
}

export async function getUserById(id: string, currentUserId?: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        lastSeen: true,
        createdAt: true,
        isOnline: true,
        email: currentUserId === id,
        settings: {
          select: {
            profileVisibility: true,
            showLastSeen: true,
            showOnlineStatus: true
          }
        }
      }
    });
    if (!user) return null;

    const profileVisibility = user.settings?.profileVisibility || "public";
    const canSeePrivateData =
      currentUserId === id ||
      profileVisibility === "public";

    return {
      ...user,
      bio: canSeePrivateData ? user.bio : null,
      status: canSeePrivateData ? user.status : null,
      lastSeen: (canSeePrivateData && user.settings?.showLastSeen !== false) ? user.lastSeen : null,
      isOnline: user.settings?.showOnlineStatus === false && currentUserId !== id ? false : user.isOnline,
      settings: undefined
    };
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return null;
  }
}

export async function getUserByUsername(username: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
      }
    });
    return user;
  } catch (error) {
    console.error("Error fetching user by username:", error);
    return null;
  }
}

export async function updateUserStatus(userId: string, isOnline: boolean) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastActive: new Date()
      },
      select: {
        id: true,
        isOnline: true,
        lastActive: true,
        displayName: true,
        username: true,
        avatarUrl: true
      }
    });

    await pusherServer.trigger("presence", "user-status-change", {
      userId: updatedUser.id,
      isOnline: updatedUser.isOnline,
      lastActive: updatedUser.lastActive
    });

    return updatedUser;
  } catch (error) {
    console.error("Error updating user status:", error);
    throw error;
  }
}

export async function getUserStatus(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isOnline: true,
        lastActive: true,
        displayName: true,
        username: true,
        avatarUrl: true
      }
    });
    return user;
  } catch (error) {
    console.error("Error getting user status:", error);
    return null;
  }
}

export async function getUsersStatuses(userIds: string[]) {
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        isOnline: true,
        lastActive: true,
        displayName: true,
        username: true,
        avatarUrl: true
      }
    });
    return users;
  } catch (error) {
    console.error("Error getting users statuses:", error);
    return [];
  }
}

export async function getOnlineUsersInChat(chatId: string) {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                isOnline: true,
                lastActive: true,
                displayName: true,
                username: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    if (!chat) return [];

    const onlineUsers = chat.members
      .filter(member => member.user.isOnline)
      .map(member => member.user);

    return onlineUsers;
  } catch (error) {
    console.error("Error getting online users in chat:", error);
    return [];
  }
}

export async function updateUserHeartbeat(userId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActive: new Date() }
    });
  } catch (error) {
    console.error("Error updating user heartbeat:", error);
  }
}

export async function getUserStats(userId: string) {
  try {
    const [messagesCount, chatsCount, serversCount, reactionsCount] = await Promise.all([
      prisma.message.count({ where: { userId } }),
      prisma.chatMember.count({ where: { userId } }),
      prisma.server.count({ where: { members: { some: { id: userId } } } }),
      prisma.message.count({ where: { reactions: { path: ['$*'], array_contains: userId } } })
    ]);

    return { messagesCount, chatsCount, serversCount, reactionsCount };
  } catch (error) {
    console.error("Error getting user stats:", error);
    return null;
  }
}

export async function getUserActivity(userId: string, days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const messages = await prisma.message.findMany({
      where: { userId, createdAt: { gte: startDate } },
      select: { createdAt: true, chatId: true },
      orderBy: { createdAt: 'asc' }
    });

    const activityByDay = new Map();
    const chatsActivity = new Map();

    messages.forEach(message => {
      const date = message.createdAt.toISOString().split('T')[0];
      activityByDay.set(date, (activityByDay.get(date) || 0) + 1);
      chatsActivity.set(message.chatId, (chatsActivity.get(message.chatId) || 0) + 1);
    });

    let mostActiveChat = null;
    let maxMessages = 0;
    for (const [chatId, count] of chatsActivity) {
      if (count > maxMessages) {
        maxMessages = count;
        mostActiveChat = chatId;
      }
    }

    let mostActiveChatInfo = null;
    if (mostActiveChat) {
      const chat = await prisma.chat.findUnique({
        where: { id: mostActiveChat },
        select: {
          id: true,
          name: true,
          type: true,
          users: {
            where: { id: { not: userId } },
            select: { id: true, displayName: true, username: true, avatarUrl: true }
          }
        }
      });
      
      if (chat) {
        mostActiveChatInfo = {
          id: chat.id,
          name: chat.type === 'PRIVATE' 
            ? chat.users[0]?.displayName || chat.users[0]?.username 
            : chat.name || 'Чат',
          type: chat.type,
          messagesCount: maxMessages
        };
      }
    }

    return {
      activityByDay: Object.fromEntries(activityByDay),
      totalMessages: messages.length,
      mostActiveChat: mostActiveChatInfo,
      activeDays: activityByDay.size
    };
  } catch (error) {
    console.error("Error getting user activity:", error);
    return null;
  }
}

export async function getMutualChats(userId1: string, userId2: string) {
  try {
    const mutualChats = await prisma.chat.findMany({
      where: {
        AND: [
          { users: { some: { id: userId1 } } },
          { users: { some: { id: userId2 } } }
        ]
      },
      include: {
        users: {
          where: { id: { not: userId1 } },
          select: { id: true, displayName: true, username: true, avatarUrl: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            content: true,
            createdAt: true,
            user: { select: { id: true, displayName: true, username: true } }
          }
        },
        _count: { select: { messages: true, users: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return mutualChats.map(chat => ({
      id: chat.id,
      name: chat.type === 'PRIVATE' 
        ? chat.users[0]?.displayName || chat.users[0]?.username 
        : chat.name || 'Групповой чат',
      type: chat.type,
      imageUrl: chat.imageUrl,
      lastMessage: chat.messages[0]?.content || 'Нет сообщений',
      lastMessageTime: chat.messages[0]?.createdAt,
      lastMessageAuthor: chat.messages[0]?.user,
      messagesCount: chat._count.messages,
      membersCount: chat._count.users,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }));
  } catch (error) {
    console.error("Error getting mutual chats:", error);
    return [];
  }
}

export async function getUserRecentActivity(userId: string, limit: number = 10) {
  try {
    const recentMessages = await prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        chat: {
          select: {
            id: true,
            name: true,
            type: true,
            users: {
              where: { id: { not: userId } },
              select: { id: true, displayName: true, username: true, avatarUrl: true }
            }
          }
        }
      }
    });

    return recentMessages.map(msg => ({
      id: msg.id,
      type: 'message',
      content: msg.content,
      chatId: msg.chatId,
      chatName: msg.chat.type === 'PRIVATE'
        ? msg.chat.users[0]?.displayName || msg.chat.users[0]?.username
        : msg.chat.name || 'Чат',
      chatType: msg.chat.type,
      createdAt: msg.createdAt,
      isFile: !!msg.fileUrl,
      fileType: msg.fileType
    }));
  } catch (error) {
    console.error("Error getting user recent activity:", error);
    return [];
  }
}

export async function getUserProfile(userId: string, currentUserId?: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        lastSeen: true,
        createdAt: true,
        isOnline: true,
        email: currentUserId === userId,
        settings: {
          select: {
            profileVisibility: true,
            preferences: true
          }
        }
      }
    });

    if (!user) return null;

    const stats = await getUserStats(userId);
    const activity = await getUserActivity(userId, 30);
    let mutualChats: any[] = [];
    
    if (currentUserId && currentUserId !== userId) {
      mutualChats = await getMutualChats(currentUserId, userId);
    }

    const profileVisibility = user.settings?.profileVisibility || "public";
    const canSeeProfileExtras =
      currentUserId === userId ||
      profileVisibility === "public" ||
      (profileVisibility === "contacts" && mutualChats.length > 0);

    const preferences = (user.settings?.preferences || {}) as Record<string, any>;
    const socialLinks = canSeeProfileExtras ? (preferences.socialLinks || null) : null;

    return {
      ...user,
      settings: undefined,
      stats,
      activity,
      mutualChats,
      socialLinks,
      canSeeProfileExtras
    };
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

// ============= НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ (исправленные) =============

export interface UserSettingsData {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowDirectMessages: string;
  allowAddToChats: string;
  profileVisibility: string;
  theme: string;
  chatTheme: string | null;
  messageFontSize: string;
  accentColor: string | null;
  chatBackground: string | null;
  pushNotifications: boolean;
  soundNotifications: boolean;
  vibration: boolean;
  showNotificationPreview: boolean;
  mutedChats: string[];
  sendReadReceipts: boolean;
  showTypingIndicator: boolean;
  autoDownloadMedia: string;
  compressImages: boolean;
  preferences: any;
}

export interface ProfileUpdatePayload {
  displayName?: string;
  bio?: string | null;
  status?: string | null;
  socialLinks?: {
    telegram?: string;
    vk?: string;
    github?: string;
    website?: string;
  };
}

export async function getUserSettings() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { settings: true }
    });

    if (!user) return null;

    if (!user.settings) {
      const defaultSettings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          showOnlineStatus: true,
          showLastSeen: true,
          allowDirectMessages: "everyone",
          allowAddToChats: "everyone",
          profileVisibility: "public",
          theme: "system",
          messageFontSize: "medium",
          pushNotifications: true,
          soundNotifications: true,
          vibration: true,
          showNotificationPreview: true,
          mutedChats: [],
          sendReadReceipts: true,
          showTypingIndicator: true,
          autoDownloadMedia: "wifi",
          compressImages: true
        }
      });
      return defaultSettings;
    }

    return user.settings;
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return null;
  }
}

export async function updateUserSettings(updates: Partial<UserSettingsData>) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Не авторизован");

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });
    if (!user) throw new Error("Пользователь не найден");

    let settings = await prisma.userSettings.findUnique({
      where: { userId: user.id }
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: user.id }
      });
    }

    const updatedSettings = await prisma.userSettings.update({
      where: { id: settings.id },
      data: updates
    });

    return updatedSettings;
  } catch (error) {
    console.error("Error updating user settings:", error);
    throw error;
  }
}

export async function updateOwnProfile(payload: ProfileUpdatePayload) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Не авторизован");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { settings: true }
  });

  if (!currentUser) throw new Error("Пользователь не найден");

  const displayName = payload.displayName?.trim();
  if (displayName !== undefined && displayName.length < 2) {
    throw new Error("Имя должно быть минимум 2 символа");
  }

  const updatedUser = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      displayName: displayName ?? currentUser.displayName,
      bio: payload.bio ?? null,
      status: payload.status ?? null
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      status: true
    }
  });

  if (payload.socialLinks) {
    const existingPreferences = (currentUser.settings?.preferences || {}) as Record<string, any>;
    await updateUserSettings({
      preferences: {
        ...existingPreferences,
        socialLinks: {
          telegram: payload.socialLinks.telegram || "",
          vk: payload.socialLinks.vk || "",
          github: payload.socialLinks.github || "",
          website: payload.socialLinks.website || ""
        }
      }
    });
  }

  return updatedUser;
}

export async function getOwnProfileEditorData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Не авторизован");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { settings: true }
  });

  if (!currentUser) throw new Error("Пользователь не найден");

  const preferences = (currentUser.settings?.preferences || {}) as Record<string, any>;

  return {
    id: currentUser.id,
    username: currentUser.username,
    displayName: currentUser.displayName,
    bio: currentUser.bio,
    status: currentUser.status,
    socialLinks: {
      telegram: preferences.socialLinks?.telegram || "",
      vk: preferences.socialLinks?.vk || "",
      github: preferences.socialLinks?.github || "",
      website: preferences.socialLinks?.website || ""
    },
    avatarUrl: currentUser.avatarUrl
  };
}

export async function uploadChatWallpaper(chatId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Не авторизован");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email }
  });
  if (!currentUser) throw new Error("Пользователь не найден");

  const membership = await prisma.chat.findFirst({
    where: {
      id: chatId,
      OR: [
        { users: { some: { id: currentUser.id } } },
        { members: { some: { userId: currentUser.id } } }
      ]
    },
    select: { id: true }
  });

  if (!membership) throw new Error("Нет доступа к чату");

  const file = formData.get("file") as File;
  if (!file) throw new Error("Файл не найден");
  if (!file.type.startsWith("image/")) throw new Error("Можно загружать только изображения");
  if (file.size > 8 * 1024 * 1024) throw new Error("Размер файла не должен превышать 8MB");

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileKey = `chat-wallpapers/${chatId}/${Date.now()}-${randomBytes(4).toString("hex")}-${file.name}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.YANDEX_BUCKET!,
    Key: fileKey,
    Body: buffer,
    ContentType: file.type,
  }));

  const imageUrl = `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET}/${fileKey}`;
  const settings = await getUserSettings();
  const prefs = ((settings?.preferences || {}) as Record<string, any>);
  const wallpapers = { ...(prefs.chatWallpapers || {}), [chatId]: imageUrl };

  await updateUserSettings({
    preferences: {
      ...prefs,
      chatWallpapers: wallpapers
    }
  });

  return { success: true, url: imageUrl };
}

export async function removeChatWallpaper(chatId: string) {
  const settings = await getUserSettings();
  const prefs = ((settings?.preferences || {}) as Record<string, any>);
  const wallpapers = { ...(prefs.chatWallpapers || {}) };
  delete wallpapers[chatId];

  await updateUserSettings({
    preferences: {
      ...prefs,
      chatWallpapers: wallpapers
    }
  });

  return { success: true };
}

export async function exportHistoryWithUser(targetUserId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Не авторизован");

  const privateChats = await prisma.chat.findMany({
    where: {
      type: "PRIVATE",
      AND: [
        { users: { some: { id: currentUser.id } } },
        { users: { some: { id: targetUserId } } }
      ]
    },
    select: { id: true }
  });

  if (!privateChats.length) {
    return {
      meta: {
        exportedAt: new Date().toISOString(),
        currentUserId: currentUser.id,
        targetUserId
      },
      messages: []
    };
  }

  const chatIds = privateChats.map(chat => chat.id);
  const messages = await prisma.message.findMany({
    where: {
      chatId: { in: chatIds }
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return {
    meta: {
      exportedAt: new Date().toISOString(),
      currentUserId: currentUser.id,
      targetUserId
    },
    messages: messages.map(message => ({
      id: message.id,
      chatId: message.chatId,
      createdAt: message.createdAt.toISOString(),
      content: message.content,
      fileUrl: message.fileUrl,
      fileType: message.fileType,
      deleted: message.deleted,
      user: message.user
    }))
  };
}

export async function exportMyHistory() {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Не авторизован");

  const memberChats = await prisma.chatMember.findMany({
    where: { userId: currentUser.id },
    select: { chatId: true }
  });

  const userChats = await prisma.chat.findMany({
    where: { users: { some: { id: currentUser.id } } },
    select: { id: true }
  });

  const chatIds = Array.from(new Set([
    ...memberChats.map(chat => chat.chatId),
    ...userChats.map(chat => chat.id)
  ]));

  const messages = await prisma.message.findMany({
    where: { chatId: { in: chatIds } },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return {
    meta: {
      exportedAt: new Date().toISOString(),
      currentUserId: currentUser.id
    },
    messages: messages.map(message => ({
      id: message.id,
      chatId: message.chatId,
      createdAt: message.createdAt.toISOString(),
      content: message.content,
      fileUrl: message.fileUrl,
      fileType: message.fileType,
      deleted: message.deleted,
      user: message.user
    }))
  };
}

export async function canMessageUser(targetUserId: string, currentUserId?: string): Promise<boolean> {
  if (!currentUserId) return false;
  if (targetUserId === currentUserId) return true;

  const settings = await prisma.userSettings.findUnique({
    where: { userId: targetUserId },
    select: { allowDirectMessages: true }
  });

  const allow = settings?.allowDirectMessages || "everyone";
  
  if (allow === "nobody") return false;
  if (allow === "everyone") return true;
  
  const mutualChat = await prisma.chat.findFirst({
    where: {
      type: "PRIVATE",
      AND: [
        { users: { some: { id: currentUserId } } },
        { users: { some: { id: targetUserId } } }
      ]
    }
  });
  
  return !!mutualChat;
}

export async function isUserOnlineVisible(targetUserId: string, currentUserId?: string): Promise<boolean> {
  if (!currentUserId) return false;
  if (targetUserId === currentUserId) return true;

  const settings = await prisma.userSettings.findUnique({
    where: { userId: targetUserId },
    select: { showOnlineStatus: true }
  });

  return settings?.showOnlineStatus ?? true;
}

export async function canViewUserProfile(targetUserId: string): Promise<boolean> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return false;
  if (currentUser.id === targetUserId) return true;

  const settings = await prisma.userSettings.findUnique({
    where: { userId: targetUserId },
    select: { profileVisibility: true }
  });

  const visibility = settings?.profileVisibility || "public";
  if (visibility === "public") return true;
  if (visibility === "private") return false;

  const hasPrivateChat = await prisma.chat.findFirst({
    where: {
      type: "PRIVATE",
      AND: [
        { users: { some: { id: currentUser.id } } },
        { users: { some: { id: targetUserId } } }
      ]
    },
    select: { id: true }
  });

  return !!hasPrivateChat;
}

export async function uploadUserBackground(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Не авторизован");

    const file = formData.get("file") as File;
    if (!file) throw new Error("Файл не найден");

    // Проверка типа файла
    if (!file.type.startsWith("image/")) {
      throw new Error("Можно загружать только изображения");
    }

    // Проверка размера (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Размер файла не должен превышать 5MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = `backgrounds/${Date.now()}-${randomBytes(4).toString('hex')}-${file.name}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.YANDEX_BUCKET!,
      Key: fileKey,
      Body: buffer,
      ContentType: file.type,
    }));

    const imageUrl = `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET}/${fileKey}`;

    // Сохраняем URL в настройках пользователя
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) throw new Error("Пользователь не найден");

    let settings = await prisma.userSettings.findUnique({
      where: { userId: user.id }
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: user.id, chatBackground: imageUrl }
      });
    } else {
      settings = await prisma.userSettings.update({
        where: { id: settings.id },
        data: { chatBackground: imageUrl }
      });
    }

    return { success: true, url: imageUrl };
  } catch (error) {
    console.error("Error uploading background:", error);
    throw error;
  }
}

export async function removeUserBackground() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Не авторизован");

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) throw new Error("Пользователь не найден");

    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id }
    });

    if (settings) {
      await prisma.userSettings.update({
        where: { id: settings.id },
        data: { chatBackground: null }
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error removing background:", error);
    throw error;
  }
}

export async function uploadUserAvatar(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      throw new Error("Не авторизован");
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      throw new Error("Пользователь не найден");
    }

    const file = formData.get("file") as File;

    if (!file) throw new Error("Файл не найден");

    // ✅ Валидация
    if (!file.type.startsWith("image/")) {
      throw new Error("Можно загружать только изображения");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Максимальный размер — 5MB");
    }

    // ✅ Буфер
    const buffer = Buffer.from(await file.arrayBuffer());

    // ✅ Уникальный ключ
    const fileKey = `avatars/${user.id}/${Date.now()}-${randomBytes(4).toString("hex")}-${file.name}`;

    // ✅ Upload в S3 (Yandex)
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.YANDEX_BUCKET!,
        Key: fileKey,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const imageUrl = `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET}/${fileKey}`;

    // ✅ Обновляем пользователя
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        avatarUrl: imageUrl
      },
      select: {
        id: true,
        avatarUrl: true
      }
    });

    return {
      success: true,
      url: imageUrl,
      user: updatedUser
    };

  } catch (error) {
    console.error("Error uploading avatar:", error);
    throw error;
  }
}

export async function removeUserAvatar() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Не авторизован");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) throw new Error("Пользователь не найден");

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: null }
  });

  return { success: true };
}