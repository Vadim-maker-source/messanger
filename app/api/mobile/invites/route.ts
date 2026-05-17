import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { pusherServer } from "@/app/lib/pusher";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

// POST /api/mobile/invites  { chatId?, serverId?, maxUses?, expiresAt? } — generate
export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { chatId, serverId, maxUses, expiresAt } = await req.json();
    if (!chatId && !serverId) return NextResponse.json({ success: false, error: "chatId or serverId required" }, { status: 400 });

    if (serverId) {
      const server = await prisma.server.findUnique({ where: { id: serverId } });
      if (!server || server.ownerId !== user.id) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    } else {
      const member = await prisma.chatMember.findUnique({ where: { userId_chatId: { userId: user.id, chatId } } });
      if (member?.role !== "CREATOR" && member?.role !== "ADMIN")
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 8);
    const invite = await prisma.invite.create({
      data: {
        code,
        ...(chatId && { chatId }),
        ...(serverId && { serverId }),
        createdBy: user.id,
        maxUses: maxUses || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        uses: 0,
      },
    });

    return NextResponse.json({ success: true, data: invite });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// GET /api/mobile/invites?code=... — info
export async function GET(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const code = new URL(req.url).searchParams.get("code");
    if (!code) return NextResponse.json({ success: false, error: "code required" }, { status: 400 });

    const invite = await prisma.invite.findUnique({
      where: { code },
      include: {
        chat: { include: { _count: { select: { members: true } } } },
        server: { include: { _count: { select: { members: true } } } },
      },
    });

    if (!invite) return NextResponse.json({ success: false, error: "Invalid invite" }, { status: 404 });
    if (!invite.isActive) return NextResponse.json({ success: false, error: "Invite revoked" }, { status: 410 });
    if (invite.expiresAt && invite.expiresAt < new Date()) return NextResponse.json({ success: false, error: "Invite expired" }, { status: 410 });
    if (invite.maxUses && invite.uses >= invite.maxUses) return NextResponse.json({ success: false, error: "Invite limit reached" }, { status: 410 });

    const isServer = !!invite.serverId;
    return NextResponse.json({
      success: true,
      data: {
        type: isServer ? "SERVER" : "CHAT",
        target: isServer
          ? { id: invite.server?.id, name: invite.server?.name, imageUrl: invite.server?.imageUrl }
          : { id: invite.chat?.id, name: invite.chat?.name, type: invite.chat?.type, imageUrl: invite.chat?.imageUrl },
        memberCount: isServer ? invite.server?._count?.members : invite.chat?._count?.members,
        uses: invite.uses,
        maxUses: invite.maxUses,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// PATCH /api/mobile/invites  { code } — join
export async function PATCH(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { code } = await req.json();
    if (!code) return NextResponse.json({ success: false, error: "code required" }, { status: 400 });

    const invite = await prisma.invite.findUnique({
      where: { code },
      include: { chat: true, server: { include: { chats: { select: { id: true } } } } },
    });

    if (!invite || !invite.isActive) return NextResponse.json({ success: false, error: "Invalid or revoked invite" }, { status: 404 });
    if (invite.expiresAt && invite.expiresAt < new Date()) return NextResponse.json({ success: false, error: "Invite expired" }, { status: 410 });
    if (invite.maxUses && invite.uses >= invite.maxUses) return NextResponse.json({ success: false, error: "Invite limit reached" }, { status: 410 });

    if (invite.serverId && invite.server) {
      const already = await prisma.server.findFirst({ where: { id: invite.serverId, members: { some: { id: user.id } } } });
      if (already) return NextResponse.json({ success: false, error: "Already a member" }, { status: 409 });

      await prisma.server.update({ where: { id: invite.serverId }, data: { members: { connect: { id: user.id } } } });
      for (const chat of invite.server.chats) {
        await prisma.chatMember.upsert({
          where: { userId_chatId: { userId: user.id, chatId: chat.id } },
          update: {},
          create: { userId: user.id, chatId: chat.id, role: "MEMBER" },
        });
        await prisma.chat.update({ where: { id: chat.id }, data: { users: { connect: { id: user.id } } } });
      }
      await prisma.invite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
      await pusherServer.trigger(`user-${user.id}`, "sidebar-update", { type: "server_joined", targetId: invite.serverId });
      return NextResponse.json({ success: true, data: { type: "SERVER", targetId: invite.serverId } });
    }

    if (invite.chatId && invite.chat) {
      const already = await prisma.chatMember.findUnique({ where: { userId_chatId: { userId: user.id, chatId: invite.chatId } } });
      if (already) return NextResponse.json({ success: false, error: "Already a member" }, { status: 409 });

      await prisma.chatMember.create({ data: { userId: user.id, chatId: invite.chatId, role: "MEMBER" } });
      await prisma.chat.update({ where: { id: invite.chatId }, data: { users: { connect: { id: user.id } } } });
      await prisma.invite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
      await pusherServer.trigger(`user-${user.id}`, "sidebar-update", { type: "chat_joined", targetId: invite.chatId });
      return NextResponse.json({ success: true, data: { type: "CHAT", targetId: invite.chatId } });
    }

    return NextResponse.json({ success: false, error: "Invalid invite" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// DELETE /api/mobile/invites  { inviteId } — revoke
export async function DELETE(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { inviteId } = await req.json();
    if (!inviteId) return NextResponse.json({ success: false, error: "inviteId required" }, { status: 400 });

    const invite = await prisma.invite.findUnique({ where: { id: inviteId }, include: { chat: true } });
    if (!invite) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    if (invite.chatId) {
      const member = await prisma.chatMember.findUnique({ where: { userId_chatId: { userId: user.id, chatId: invite.chatId } } });
      if (member?.role !== "CREATOR" && member?.role !== "ADMIN")
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    } else if (invite.serverId) {
      const server = await prisma.server.findUnique({ where: { id: invite.serverId } });
      if (server?.ownerId !== user.id) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.invite.delete({ where: { id: inviteId } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
