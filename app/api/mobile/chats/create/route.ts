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
    const { name, userIds = [], imageUrl, access } = body;
    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 }
      );
    }

    const participants = Array.from(
      new Set([currentUser.id, ...(Array.isArray(userIds) ? userIds : [])])
    );

    const chat = await prisma.chat.create({
      data: {
        name: String(name).trim(),
        imageUrl: imageUrl || null,
        access: access || "PUBLIC",
        type: "GROUP",
        users: {
          connect: participants.map((id) => ({ id })),
        },
      },
    });

    await prisma.chatMember.createMany({
      data: participants.map((userId) => ({
        userId,
        chatId: chat.id,
        role: userId === currentUser.id ? "CREATOR" : "MEMBER",
      })),
      skipDuplicates: true,
    });
    
    return NextResponse.json({
      success: true,
      chat: chat,
    });
  } catch (error: any) {
    console.error("Create chat API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}