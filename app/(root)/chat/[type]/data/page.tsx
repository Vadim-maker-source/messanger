// app/chat/[type]/settings/page.tsx
import { getCurrentUser } from "@/app/lib/api/user";
import { prisma } from "@/app/lib/prisma";
import ChatSettings from "@/components/ChatSettinds";
import { redirect } from "next/navigation";

export default async function ChatSettingsPage({ params }: { params: Promise<{ type: string }> }) {
  const resolvedParams = await params;
  const chatId = resolvedParams.type;

  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  // Получаем информацию о чате
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      server: true,
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

  if (!chat) {
    return <div className="p-10 text-white">Чат не найден</div>;
  }

  // Получаем подканалы для сервера
  let subChats: any = [];
  if (chat.serverId) {
    subChats = await prisma.chat.findMany({
      where: {
        serverId: chat.serverId,
        id: { not: chatId }
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

  const isAdmin = userMember?.role === 'CREATOR' || userMember?.role === 'ADMIN';

  return (
    <ChatSettings
      chat={chat}
      currentUser={user}
      isAdmin={isAdmin}
      subChats={subChats}
    />
  );
}