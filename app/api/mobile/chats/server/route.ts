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

    const server = await prisma.server.create({
      data: {
        name: name.trim(),
        imageUrl: imageUrl || null,
        access: access as AccessType,
        ownerId: user.id,
        inviteCode: Math.random().toString(36).substring(2, 12),
        members: { connect: allMemberIds.map((id) => ({ id })) },
      },
    });

    const defaultChannels = channels.length > 0 ? channels : [{ name: "общий", type: "CHANNEL" }];
    const createdChats = [];

    for (const ch of defaultChannels) {
      const chat = await prisma.chat.create({
        data: {
          name: ch.name || "канал",
          type: (ch.type as ChatType) || "CHANNEL",
          access: access as AccessType,
          serverId: server.id,
          users: { connect: allMemberIds.map((id) => ({ id })) },
        },
      });
      for (const memberId of allMemberIds) {
        await prisma.chatMember.create({
          data: { userId: memberId, chatId: chat.id, role: memberId === user.id ? "CREATOR" : "MEMBER" },
        });
      }
      createdChats.push(chat);
    }

    return NextResponse.json({ success: true, data: { ...server, chats: createdChats } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
