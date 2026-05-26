/* eslint-disable @typescript-eslint/no-require-imports */
// ════════════════════════════════════════════════════════════════════════════
// Custom Next.js server with Socket.io on the same port.
// ════════════════════════════════════════════════════════════════════════════
//
// Запускать: `node server.js` (без `next dev` — он подменяется).
//
// Что делает:
//   - Поднимает Next.js (как обычный custom server)
//   - На том же HTTP-сервере поднимает Socket.io (path: /socket.io)
//   - Авторизует socket-подключения по JWT (тот же что для /api/mobile)
//   - Управляет "rooms" = аналог Pusher channels (subscribe/unsubscribe events)
//   - Кладёт io-инстанс в globalThis.__io чтобы API routes могли его использовать
//     для emit'а событий (через app/lib/socket-server.ts)
//
// Каналы (rooms):
//   user-${userId}    — звонки/сайдбар, доступен только владельцу
//   sidebar-${userId} — сайдбар-апдейты, доступен только владельцу
//   presence          — глобальный online-статус, любой авторизованный
//   ${chatId}         — чат, доступен только участникам чата
//
// События в комнате присылаются под именем `${channel}:${event}` чтобы клиент
// мог фильтровать по каналу (см. app/lib/socket-client.ts).
//
// ════════════════════════════════════════════════════════════════════════════

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!NEXTAUTH_SECRET) {
  console.warn("[server] NEXTAUTH_SECRET is missing — socket auth will reject all connections");
}

// Shared secret для внутреннего HTTP emit endpoint. Если в .env не задан —
// генерим случайный при старте и кидаем в process.env, чтобы API routes
// (если они в том же процессе) могли его прочитать.
const INTERNAL_SECRET =
  process.env.SOCKET_INTERNAL_SECRET ||
  require("crypto").randomBytes(32).toString("hex");
process.env.SOCKET_INTERNAL_SECRET = INTERNAL_SECRET;

const prisma = new PrismaClient();
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Внутренний endpoint для HTTP-based emit (fallback если globalThis.__io
    // недоступен из API routes — например из-за Turbopack runtime isolation).
    // Authorized по shared secret в заголовке X-Internal-Auth.
    if (req.url === "/__internal_emit" && req.method === "POST") {
      const auth = req.headers["x-internal-auth"];
      if (auth !== INTERNAL_SECRET) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const { channel, event, data } = JSON.parse(body);
          if (typeof channel === "string" && typeof event === "string") {
            io.to(channel).emit(`${channel}:${event}`, data);
            res.writeHead(204);
            res.end();
          } else {
            res.writeHead(400);
            res.end("bad params");
          }
        } catch (e) {
          res.writeHead(400);
          res.end("bad json");
        }
      });
      return;
    }
    handle(req, res, parse(req.url, true));
  });

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || true, // позволяем dev-ориджины
      credentials: true,
    },
    path: "/socket.io",
    // Поддерживаем оба транспорта: WebSocket быстрее, polling — fallback
    transports: ["websocket", "polling"],
    // Долгий ping чтобы соединение не рвалось на медленных сетях
    pingInterval: 25_000,
    pingTimeout: 60_000,
  });

  // ─── Аутентификация ────────────────────────────────────────────────────
  // Подключение разрешается, только если есть валидный JWT-токен в auth.token
  // (mobile отправляет тот же что в Bearer; web — получает через
  // /api/auth/socket-token из своей сессии).
  io.use(async (socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;
      if (authToken && NEXTAUTH_SECRET) {
        try {
          const payload = jwt.verify(authToken, NEXTAUTH_SECRET);
          if (payload?.userId) {
            socket.data.userId = payload.userId;
            return next();
          }
        } catch (_) {
          // fall through
        }
      }
      // Fallback: cookie-based (используется?) — пока пропускаем.
      // Можно добавить decode NextAuth session-token здесь, но проще через
      // /api/auth/socket-token endpoint.
      return next(new Error("unauthorized"));
    } catch (err) {
      return next(new Error("unauthorized"));
    }
  });

  // ─── Connection handler ────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    if (dev) console.log(`[socket] connected: ${userId} (${socket.id})`);

    // Автоматически подписываем на user-канал — самый частый use case
    // (звонки, sidebar). Это эквивалентно `pusherClient.subscribe(user-${userId})`.
    socket.join(`user-${userId}`);
    socket.join(`sidebar-${userId}`);
    socket.join("presence");

    // Подписка на канал. Клиент шлёт `subscribe` с именем канала.
    // Server проверяет права и добавляет socket в room.
    socket.on("subscribe", async (channel, ack) => {
      try {
        if (typeof channel !== "string" || !channel) {
          ack?.({ success: false, error: "invalid_channel" });
          return;
        }
        let allowed = false;
        if (channel === "presence") {
          allowed = true;
        } else if (channel === `user-${userId}` || channel === `sidebar-${userId}`) {
          allowed = true; // уже в room через автоподписку, но noop
        } else if (channel.startsWith("user-") || channel.startsWith("sidebar-")) {
          // Чужой персональный канал — нельзя
          allowed = false;
        } else {
          // Считаем что это chatId — проверяем участие
          const member = await prisma.chat.findFirst({
            where: { id: channel, users: { some: { id: userId } } },
            select: { id: true },
          });
          allowed = !!member;
        }
        if (allowed) {
          socket.join(channel);
          if (dev) console.log(`[socket] ${userId} joined ${channel}`);
          ack?.({ success: true });
        } else {
          if (dev) console.log(`[socket] ${userId} DENIED ${channel}`);
          ack?.({ success: false, error: "forbidden" });
        }
      } catch (e) {
        ack?.({ success: false, error: "server_error" });
      }
    });

    socket.on("unsubscribe", (channel, ack) => {
      if (typeof channel === "string" && channel) {
        socket.leave(channel);
        if (dev) console.log(`[socket] ${userId} left ${channel}`);
      }
      ack?.({ success: true });
    });

    socket.on("disconnect", (reason) => {
      if (dev) console.log(`[socket] disconnected: ${userId} (${reason})`);
    });
  });

  // Кладём io в globalThis чтобы API routes (Next.js) могли использовать
  // его через app/lib/socket-server.ts.
  globalThis.__io = io;

  httpServer
    .once("error", (err) => {
      console.error("[server] HTTP error:", err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.io listening on /socket.io`);
    });
});
