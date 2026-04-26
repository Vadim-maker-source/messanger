// app/api/mobile/route.ts
import { createChat, getMessages, getOrCreatePrivateChat, getUserChats, markMessagesAsRead, sendMessage } from "@/app/lib/api/chat";
import { getCurrentUser } from "@/app/lib/api/user";
import { NextRequest, NextResponse } from "next/server";

// POST /api/mobile - единый эндпоинт для всех действий
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    let result;

    switch (action) {
      // Auth actions
      case 'getCurrentUser':
        result = { user };
        break;

      // Chat actions
      case 'getChats':
        const chats = await getUserChats();
        result = { chats };
        break;

      case 'getMessages':
        const messages = await getMessages(data.chatId);
        result = { messages };
        break;

      case 'sendMessage':
        const newMessage = await sendMessage(data.chatId, data.content, data.fileUrl, data.fileType, data.replyToId);
        result = { message: newMessage };
        break;

      case 'markAsRead':
        await markMessagesAsRead(data.chatId, data.lastReadMessageId);
        result = { success: true };
        break;

      case 'getOrCreatePrivateChat':
        const privateChat = await getOrCreatePrivateChat(data.partnerId);
        result = { chat: privateChat };
        break;

      case 'createGroupChat':
        const groupChat = await createChat({
          name: data.name,
          imageUrl: data.imageUrl,
          access: data.access || "PUBLIC",
          type: "GROUP",
          userIds: data.userIds
        });
        result = { chat: groupChat };
        break;

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET /api/mobile?action=getChats
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    let result;

    switch (action) {
      case 'getChats':
        const chats = await getUserChats();
        result = { chats };
        break;

      case 'getMessages':
        const chatId = searchParams.get('chatId');
        if (!chatId) {
          return NextResponse.json({ success: false, error: "chatId required" }, { status: 400 });
        }
        const messages = await getMessages(chatId);
        result = { messages };
        break;

      case 'getCurrentUser':
        result = { user };
        break;

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}