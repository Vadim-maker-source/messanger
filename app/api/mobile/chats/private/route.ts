import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getMobileUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { partnerId } = body;

    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: "partnerId required" },
        { status: 400 }
      );
    }

    if (partnerId === currentUser.id) {
      return NextResponse.json(
        { success: false, error: "Cannot create chat with yourself" },
        { status: 400 }
      );
    }

    let chat = await prisma.chat.findFirst({
      where: {
        type: "PRIVATE",
        users: { some: { id: currentUser.id } },
        AND: [{ users: { some: { id: partnerId } } }],
      },
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          type: "PRIVATE",
          users: {
            connect: [{ id: currentUser.id }, { id: partnerId }],
          },
        },
      });

      await prisma.chatMember.createMany({
        data: [
          { userId: currentUser.id, chatId: chat.id, role: "CREATOR" },
          { userId: partnerId, chatId: chat.id, role: "MEMBER" },
        ],
        skipDuplicates: true,
      });
    }

    const formattedChat = {
      id: chat.id,
      name: chat.name,
      type: chat.type,
      imageUrl: chat.imageUrl,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
    
    return NextResponse.json({
      success: true,
      chat: formattedChat,
    });
  } catch (error: any) {
    console.error("Private chat API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}