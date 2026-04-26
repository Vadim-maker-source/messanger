// app/chat/[type]/page.tsx
import { getCurrentUser } from "@/app/lib/api/user";
import { prisma } from "@/app/lib/prisma";
import RealTimeChat from "@/components/RealTimeChat";
import { redirect } from "next/navigation";
import { getUserRoleInChat, getChatInfo } from "@/app/lib/api/chat";

export default async function ChatPage({ params }: { params: Promise<{ type: string }> }) {
  const resolvedParams = await params;
  const chatId = resolvedParams.type;

  const user = await getCurrentUser();
  if (!user) redirect("/auth");

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
        }
      },
      _count: {
        select: {
          users: true
        }
      }
    }
  });

  if (!chat) return <div className="p-10 text-white">Чат не найден (ID: {chatId})</div>;

  const userRole = await getUserRoleInChat(chatId, user.id);
  const isServerAdmin = chat.serverId ? chat.server?.ownerId === user.id : false;
  const chatInfo = await getChatInfo(chatId);
  
  let partner = null;
  let chatDisplayName = chat.name;
  let chatAvatarUrl = chat.imageUrl;

  if (chat.type === "PRIVATE") {
    partner = chat.users.find(u => u.id !== user.id);
    chatDisplayName = partner?.displayName || partner?.username || "Чат";
    chatAvatarUrl = String(partner?.avatarUrl);
  }

  // Передаем полную информацию о пользователе
  const chatUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isIdAdmin: isServerAdmin || userRole === 'CREATOR' || userRole === 'ADMIN'
  };

  return (
    <RealTimeChat 
      chatId={chatId}
      currentUser={chatUser}
      userRole={userRole}
      chatMembers={chatInfo?.members || []}
      chatType={chat.type}
      initialMembersCount={chat._count.users}
      chatName={chatDisplayName}
      chatAvatar={chatAvatarUrl}
      partner={partner}
    />
  );
}