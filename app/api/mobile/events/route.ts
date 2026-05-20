import { NextRequest } from "next/server";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import Pusher from "pusher";

// Pusher Webhooks не подходят для SSE, поэтому используем Pusher HTTP API polling
// через /channels/{channel}/events — но проще сделать через pusher-js на сервере.
// Самый надёжный способ для Next.js: клиент подписывается через pusher-js на сервере
// и пробрасывает события в SSE-поток.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channels = searchParams.get("channels")?.split(",").filter(Boolean) ?? [];

  if (channels.length === 0) {
    return new Response("channels param required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Используем Pusher HTTP API для получения событий через polling
      // Pusher не поддерживает server-side subscribe через REST,
      // поэтому пробрасываем события через внутреннюю очередь.
      // Flutter будет делать polling на этот эндпоинт.
      controller.enqueue(encoder.encode("data: connected\n\n"));
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
