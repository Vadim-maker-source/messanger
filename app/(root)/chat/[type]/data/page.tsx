// app/chat/[type]/data/page.tsx
import { getCurrentUser } from "@/app/lib/api/user";
import { prisma } from "@/app/lib/prisma";
import ChatSettings from "@/components/ChatSettinds";
import ServerSettings from "@/components/ServerSettings";
import { redirect } from "next/navigation";

export default async function ChatSettingsPage({ params }: { params: Promise<{ type: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.type;

  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  // Сначала проверяем, это чат или сервер
  const chat = await prisma.chat.findUnique({
    where: { id },
    include: {
      server: {
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            }
          },
          chats: {
            select: {
              id: true,
              name: true,
              type: true,
              _count: {
                select: { users: true }
              }
            }
          },
          members: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              status: true,
              lastSeen: true,
              createdAt: true,
            }
          },
          _count: {
            select: {
              members: true,
              chats: true
            }
          }
        }
      },
      users: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          status: true,
          lastSeen: true,
          createdAt: true,
        }
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              status: true,
            }
          }
        }
      },
      _count: {
        select: {
          users: true,
          messages: true
        }
      }
    }
  });

  // Если чат не найден, проверяем, может это сервер
  if (!chat) {
    const server = await prisma.server.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          }
        },
        chats: {
          select: {
            id: true,
            name: true,
            type: true,
            _count: {
              select: { users: true }
            }
          }
        },
        members: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            status: true,
            lastSeen: true,
            createdAt: true,
          }
        },
        _count: {
          select: {
            members: true,
            chats: true
          }
        }
      }
    });

    if (server) {
      const isAdmin = server.ownerId === user.id;

      return (
        <ServerSettings
          server={server}
          currentUser={user}
          isAdmin={isAdmin}
        />
      );
    }

    return <div className="p-10 text-white">Чат или сервер не найден</div>;
  }

  // Получаем подканалы, если чат принадлежит серверу (используем serverId из схемы)
  let subChats: any = [];
  if (chat.serverId) {
    subChats = await prisma.chat.findMany({
      where: {
        serverId: chat.serverId,
        id: { not: id }
      },
      select: {
        id: true,
        name: true,
        type: true,
        _count: {
          select: { users: true }
        }
      }
    });
  }

  // Получаем роль текущего пользователя
  const userMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId: user.id,
        chatId: chat.id
      }
    }
  });

  const isAdmin = userMember?.role === 'CREATOR' || userMember?.role === 'ADMIN' || chat.server?.ownerId === user.id;

  return (
    <ChatSettings
      chat={chat}
      currentUser={user}
      isAdmin={isAdmin}
      subChats={subChats}
    />
  );
}