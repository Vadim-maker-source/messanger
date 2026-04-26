// app/api/mobile/chats/create/route.ts
import { createChat } from "@/app/lib/api/chat";
import { verifyToken } from "@/app/lib/token";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Получаем токен из заголовка
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - No token" },
        { status: 401 }
      );
    }
    
    // Верифицируем токен
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { name, userIds, type, imageUrl, access } = body;
    
    // Создаем чат
    const chat = await createChat({
      name,
      imageUrl,
      access: access || "PUBLIC",
      type: type || "GROUP",
      userIds: userIds || []
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