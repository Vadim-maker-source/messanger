import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/app/lib/prisma";

const JWT_SECRET = process.env.NEXTAUTH_SECRET!;

export async function GET(request: NextRequest) {
  console.log("=== GET /api/mobile/chats ===");
  
  try {
    // Получаем токен из заголовка
    const authHeader = request.headers.get("authorization");
    console.log("Auth header:", authHeader ? "Present" : "Missing");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("No Bearer token");
      return NextResponse.json(
        { success: false, error: "Unauthorized - No token" },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    console.log("Token received:", token.substring(0, 20) + "...");
    
    // Верифицируем токен
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      console.log("Token verified for user:", decoded.userId);
    } catch (err) {
      console.log("Token verification failed:", err);
      return NextResponse.json(
        { success: false, error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }
    
    // Получаем пользователя из базы
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) {
      console.log("User not found:", decoded.userId);
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 401 }
      );
    }
    
    // Получаем чаты пользователя
    const chats = await prisma.chat.findMany({
      where: {
        users: { some: { id: user.id } }
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    console.log(`Found ${chats.length} chats for user ${user.id}`);
    
    // Форматируем результат
    const formattedChats = chats.map(chat => {
      let title = chat.name;
      let imageUrl = chat.imageUrl;
      
      if (chat.type === "PRIVATE") {
        const otherUser = chat.users.find(u => u.id !== user.id);
        title = otherUser?.displayName || otherUser?.username || "Chat";
        imageUrl = otherUser?.avatarUrl || null;
      } else if (!title) {
        title = chat.type === "GROUP" ? "Group Chat" : "Chat";
      }
      
      return {
        id: chat.id,
        title: title,
        imageUrl: imageUrl,
        lastMessage: chat.messages[0]?.content || null,
        type: chat.type,
      };
    });
    
    return NextResponse.json({
      success: true,
      chats: formattedChats,
    });
    
  } catch (error: any) {
    console.error("Chats API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}