"use client";

// ════════════════════════════════════════════════════════════════════════════
// socketClient — клиентский singleton, заменяющий pusherClient.
// ════════════════════════════════════════════════════════════════════════════
//
// API совместим с pusher-js:
//   const channel = socketClient.subscribe("user-123");
//   channel.bind("incoming-call", handler);
//   channel.unbind("incoming-call", handler);
//   socketClient.unsubscribe("user-123");
//
// Внутри:
//   - Один Socket.io-коннект на всё приложение (как у Pusher).
//   - При первом subscribe устанавливает соединение и забирает JWT через
//     /api/auth/socket-token. Дальше переиспользует.
//   - События приходят с именем `${channel}:${event}` — wrapper фильтрует.
//   - Если bind()/unbind() вызваны до подключения сокета — они кладутся в
//     очередь и применяются при подключении.
//
// ════════════════════════════════════════════════════════════════════════════

import { io, Socket } from "socket.io-client";

// pusher-js не типизирует callback'и, поэтому совместимый wrapper берёт
// произвольный handler. Реальные данные приходят с сервера и матчатся
// при использовании.
type Handler = (data: any) => void;

class SocketChannel {
  // event → set of user handlers
  private handlers = new Map<string, Set<Handler>>();
  // user handler → "raw" wrapper that мы регистрируем на socket'е
  // (нужно чтобы потом точно его же снять через .off)
  private rawListeners = new Map<Handler, (data: unknown) => void>();

  constructor(
    private getSocket: () => Socket | null,
    private channel: string,
  ) {}

  bind(event: string, handler: Handler) {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);

    const raw = (data: unknown) => handler(data);
    this.rawListeners.set(handler, raw);

    const sock = this.getSocket();
    if (sock) {
      sock.on(`${this.channel}:${event}`, raw);
    }
    // Если socket'а ещё нет — не страшно, applyPending() прицепит после
    // подключения (см. SocketClientImpl).
    return this;
  }

  unbind(event: string, handler?: Handler) {
    const sock = this.getSocket();
    if (!handler) {
      const set = this.handlers.get(event);
      if (set) {
        for (const h of set) {
          const raw = this.rawListeners.get(h);
          if (raw && sock) sock.off(`${this.channel}:${event}`, raw);
          this.rawListeners.delete(h);
        }
        this.handlers.delete(event);
      }
      return this;
    }
    const set = this.handlers.get(event);
    if (set?.has(handler)) {
      const raw = this.rawListeners.get(handler);
      if (raw && sock) sock.off(`${this.channel}:${event}`, raw);
      this.rawListeners.delete(handler);
      set.delete(handler);
      if (set.size === 0) this.handlers.delete(event);
    }
    return this;
  }

  /** Применить все накопленные bindings к свежему socket'у (после connect). */
  applyPending(sock: Socket) {
    for (const [event, set] of this.handlers.entries()) {
      for (const h of set) {
        let raw = this.rawListeners.get(h);
        if (!raw) {
          raw = (data: unknown) => h(data);
          this.rawListeners.set(h, raw);
        }
        // Сначала снимаем старый (если был), чтобы не было дубликатов после
        // реконнекта.
        sock.off(`${this.channel}:${event}`, raw);
        sock.on(`${this.channel}:${event}`, raw);
      }
    }
  }

  destroy() {
    const sock = this.getSocket();
    for (const [event, set] of this.handlers.entries()) {
      for (const h of set) {
        const raw = this.rawListeners.get(h);
        if (raw && sock) sock.off(`${this.channel}:${event}`, raw);
      }
    }
    this.handlers.clear();
    this.rawListeners.clear();
  }
}

class SocketClientImpl {
  private socket: Socket | null = null;
  private channels = new Map<string, SocketChannel>();
  private connectPromise: Promise<void> | null = null;

  private getSocket = (): Socket | null => this.socket;

  private async ensureConnected(): Promise<void> {
    if (this.socket?.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      try {
        const res = await fetch("/api/auth/socket-token", { credentials: "include" });
        if (!res.ok) {
          console.warn(`[socketClient] failed to get socket token (status=${res.status})`);
          return;
        }
        const { token } = await res.json();
        if (!token) {
          console.warn("[socketClient] no token returned");
          return;
        }

        const url =
          process.env.NEXT_PUBLIC_SOCKET_URL ||
          (typeof window !== "undefined" ? window.location.origin : "");

        const sock = io(url, {
          path: "/socket.io",
          auth: { token },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10_000,
          withCredentials: true,
        });

        this.socket = sock;

        sock.on("connect", () => {
          console.log("[socketClient] connected", sock.id);
          // Подписать на все каналы заново и переапплаить bindings
          for (const [name, ch] of this.channels.entries()) {
            sock.emit("subscribe", name, (resp: { success: boolean; error?: string }) => {
              if (!resp?.success) {
                console.warn("[socketClient] subscribe rejected:", name, resp?.error);
              }
            });
            ch.applyPending(sock);
          }
        });
        sock.on("connect_error", (err) => {
          console.warn("[socketClient] connect_error:", err.message);
        });
        sock.on("disconnect", (reason) => {
          console.log("[socketClient] disconnected:", reason);
        });
      } finally {
        this.connectPromise = null;
      }
    })();
    return this.connectPromise;
  }

  subscribe(channel: string): SocketChannel {
    const existing = this.channels.get(channel);
    if (existing) return existing;

    const ch = new SocketChannel(this.getSocket, channel);
    this.channels.set(channel, ch);

    // Lazy-инициализация коннекта; потом emit subscribe
    this.ensureConnected().then(() => {
      const sock = this.socket;
      if (!sock) return;
      sock.emit("subscribe", channel, (resp: { success: boolean; error?: string }) => {
        if (!resp?.success) {
          console.warn("[socketClient] subscribe rejected:", channel, resp?.error);
        }
      });
      ch.applyPending(sock);
    });

    return ch;
  }

  unsubscribe(channel: string) {
    const ch = this.channels.get(channel);
    if (ch) {
      ch.destroy();
      this.channels.delete(channel);
    }
    this.socket?.emit("unsubscribe", channel);
  }

  disconnect() {
    for (const ch of this.channels.values()) ch.destroy();
    this.channels.clear();
    this.socket?.disconnect();
    this.socket = null;
  }
}

// Singleton — создаётся только в браузере
let _instance: SocketClientImpl | null = null;
function getInstance(): SocketClientImpl | null {
  if (typeof window === "undefined") return null;
  if (!_instance) _instance = new SocketClientImpl();
  return _instance;
}

// SSR-заглушка с no-op чтобы код в render не падал
const SSR_CHANNEL = {
  bind: () => SSR_CHANNEL,
  unbind: () => SSR_CHANNEL,
};

export const socketClient = {
  subscribe(channel: string) {
    const inst = getInstance();
    if (!inst) return SSR_CHANNEL as unknown as SocketChannel;
    return inst.subscribe(channel);
  },
  unsubscribe(channel: string) {
    getInstance()?.unsubscribe(channel);
  },
  disconnect() {
    getInstance()?.disconnect();
  },
};
