import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { AccessType, ChatType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { name, imageUrl, access = "PUBLIC", channels = [], userIds = [] } = await req.json();
    if (!name?.trim()) return NextResponse.json({ success: false, error: "name required" }, { status: 400 });

    const allMemberIds: string[] = Array.from(new Set([...userIds, user.id]));

    // Нормализуем тип канала. Flutter присылает 'TEXT' для текстовых чатов,
    // а Prisma enum допускает только PRIVATE | GROUP | CHANNEL.
    const normalizeType = (t: any): ChatType => {
      const v = String(t || "").toUpperCase();
      if (v === "TEXT" || v === "GROUP") return "GROUP";
      return "CHANNEL";
    };

    const defaultChannels = channels.length > 0 ? channels : [{ name: "общий", type: "CHANNEL" }];

    // Создаём всё атомарно. Если хоть один канал упадёт — всё откатывается.
    const result = await prisma.$transaction(async (tx) => {
      const server = await tx.server.create({
        data: {
          name: name.trim(),
          imageUrl: imageUrl || null,
          access: access as AccessType,
          ownerId: user.id,
          inviteCode: Math.random().toString(36).substring(2, 12),
          members: { connect: allMemberIds.map((id) => ({ id })) },
        },
      });

      const createdChats = [];
      for (const ch of defaultChannels) {
        const chat = await tx.chat.create({
          data: {
            name: String(ch.name || "канал").trim() || "канал",
            type: normalizeType(ch.type),
            access: access as AccessType,
            serverId: server.id,
            users: { connect: allMemberIds.map((id) => ({ id })) },
          },
        });
        for (const memberId of allMemberIds) {
          await tx.chatMember.create({
            data: { userId: memberId, chatId: chat.id, role: memberId === user.id ? "CREATOR" : "MEMBER" },
          });
        }
        createdChats.push(chat);
      }

      return { ...server, chats: createdChats };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: any) {
    console.error("[create server] error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// PATCH: добавить канал к существующему серверу
export async function PATCH(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { serverId, name, type } = await req.json();
    if (!serverId || !name?.trim()) {
      return NextResponse.json({ success: false, error: "serverId and name required" }, { status: 400 });
    }

    // Проверка прав — только владелец сервера может добавлять каналы
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { ownerId: true, access: true, members: { select: { id: true } } },
    });
    if (!server) return NextResponse.json({ success: false, error: "Server not found" }, { status: 404 });
    if (server.ownerId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const memberIds = server.members.map((m) => m.id);
    const chat = await prisma.chat.create({
      data: {
        name: name.trim(),
        type: (type as ChatType) || "CHANNEL",
        access: server.access,
        serverId: serverId,
        users: { connect: memberIds.map((id) => ({ id })) },
      },
    });
    for (const memberId of memberIds) {
      await prisma.chatMember.create({
        data: { userId: memberId, chatId: chat.id, role: memberId === user.id ? "CREATOR" : "MEMBER" },
      });
    }

    return NextResponse.json({ success: true, data: chat });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
