import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/api/user";
import { leaveServer } from "@/app/lib/api/chat";
import { prisma } from "@/app/lib/prisma";

export default async function LeavePage({ params }: { params: Promise<{ type: string }> }) {
  const { type: id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Определяем: это сервер или чат
  const server = await prisma.server.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });

  if (server) {
    if (server.ownerId === user.id) {
      // Владелец не может покинуть — редирект обратно
      redirect("/");
    }
    await leaveServer(id);
  } else {
    // Это чат/группа — удаляем себя из участников
    await prisma.chatMember.deleteMany({ where: { chatId: id, userId: user.id } });
    await prisma.chat.update({
      where: { id },
      data: { users: { disconnect: { id: user.id } } },
    });
  }

  redirect("/");
}
