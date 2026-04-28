import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> | { type: string } }
) {
  try {
    // Поддержка как Promise, так и обычного объекта для совместимости
    let code: string;
    if (params instanceof Promise) {
      const resolved = await params;
      code = resolved.type;
    } else {
      code = params.type;
    }
    
    if (!code || code === 'undefined') {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    console.log("Looking for invite with code:", code);

    // Ищем инвайт с включением и чата, и сервера
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
            },
            chats: {
              take: 1,
              select: { 
                id: true,
                name: true  // Добавляем name
              }
            }
          }
        }
      }
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    // Проверка срока действия
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite link has expired" }, { status: 410 });
    }

    // Проверка лимита использований
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return NextResponse.json({ error: "Invite link has reached its usage limit" }, { status: 410 });
    }

    // Определяем тип инвайта (сервер или чат)
    const isServerInvite = !!invite.serverId && invite.server;
    
    if (isServerInvite && invite.server) {
      // Инвайт на сервер
      const firstChat = invite.server.chats[0];
      return NextResponse.json({
        type: 'SERVER',
        server: {
          id: invite.server.id,
          name: invite.server.name,
          imageUrl: invite.server.imageUrl,
          access: invite.server.access,
          inviteCode: invite.server.inviteCode
        },
        chat: firstChat ? {
          id: firstChat.id,
          name: firstChat.name
        } : null,
        invite: {
          uses: invite.uses,
          maxUses: invite.maxUses,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt
        },
        memberCount: invite.server._count.members
      });
    } 
    
    if (invite.chat) {
      // Инвайт на чат
      return NextResponse.json({
        type: 'CHAT',
        chat: {
          id: invite.chat.id,
          name: invite.chat.name,
          type: invite.chat.type,
          imageUrl: invite.chat.imageUrl,
          access: invite.chat.access,
          inviteCode: invite.chat.inviteCode
        },
        invite: {
          uses: invite.uses,
          maxUses: invite.maxUses,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt
        },
        memberCount: invite.chat._count.members
      });
    }

    return NextResponse.json({ error: "Invite target not found" }, { status: 404 });
  } catch (error) {
    console.error("Error fetching invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}