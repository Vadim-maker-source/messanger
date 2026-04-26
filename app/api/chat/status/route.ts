import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getOnlineUsersInChat, getUserStatus, updateUserStatus } from "@/app/lib/api/user";

// Обновить статус
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { isOnline } = await req.json();
    const updatedUser = await updateUserStatus(currentUser.id, isOnline);
    
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Получить статус
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const chatId = searchParams.get("chatId");

    if (userId) {
      const status = await getUserStatus(userId);
      return NextResponse.json(status);
    }

    if (chatId) {
      const onlineUsers = await getOnlineUsersInChat(chatId);
      return NextResponse.json(onlineUsers);
    }

    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  } catch (error) {
    console.error("Error getting status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}