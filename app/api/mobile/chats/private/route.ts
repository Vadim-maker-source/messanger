// app/api/mobile/chats/private/route.ts
import { getOrCreatePrivateChat } from "@/app/lib/api/chat";
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
    const { partnerId } = body;
    
    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: "partnerId required" },
        { status: 400 }
      );
    }
    
    // Создаем или получаем приватный чат
    const chat = await getOrCreatePrivateChat(partnerId);
    
    // Форматируем ответ для мобильного приложения
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