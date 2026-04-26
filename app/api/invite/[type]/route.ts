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

    const invite = await prisma.invite.findUnique({
      where: { code },
      include: {
        chat: {
          include: {
            _count: {
              select: { members: true }
            }
          }
        }
      }
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    if (!invite.chat) {
      return NextResponse.json({ error: "Chat not found for this invite" }, { status: 404 });
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite link has expired" }, { status: 410 });
    }

    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return NextResponse.json({ error: "Invite link has reached its usage limit" }, { status: 410 });
    }

    return NextResponse.json({
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
  } catch (error) {
    console.error("Error fetching invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}