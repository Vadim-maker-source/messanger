// ════════════════════════════════════════════════════════════════════════════
// socketServer — серверный wrapper, заменяющий pusherServer.
// ════════════════════════════════════════════════════════════════════════════
//
// API совместим с pusherServer:
//   await socketServer.trigger(channel, event, data)
//
// Двухуровневая стратегия отправки:
//   1) Прямой in-process emit через globalThis.__io (быстрее всего).
//      Работает когда API route и server.js — один процесс.
//   2) Fallback: HTTP POST на /__internal_emit нашего же сервера.
//      Срабатывает когда (1) недоступен — например при Turbopack-изоляции
//      runtime'а в Next.js 16 dev mode, или если код собирается в worker.
//
// ════════════════════════════════════════════════════════════════════════════

type IoLike = {
  to(room: string): { emit(event: string, ...args: unknown[]): unknown };
};

function getIo(): IoLike | null {
  // @ts-expect-error globalThis.__io положен из server.js
  const io = globalThis.__io;
  return (io as IoLike | undefined) ?? null;
}

let warnedNoIo = false;
let warnedNoSecret = false;

async function emitViaHttp(channel: string, event: string, data: unknown): Promise<boolean> {
  const secret = process.env.SOCKET_INTERNAL_SECRET;
  if (!secret) {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn(
        "[socketServer] SOCKET_INTERNAL_SECRET не установлен. " +
          "Убедитесь что Next.js запущен через `node server.js`.",
      );
    }
    return false;
  }
  const port = process.env.PORT || "3000";
  const url = `http://127.0.0.1:${port}/__internal_emit`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth": secret,
      },
      body: JSON.stringify({ channel, event, data }),
    });
    return res.ok;
  } catch (e) {
    console.error("[socketServer] HTTP emit failed:", e);
    return false;
  }
}

export const socketServer = {
  /**
   * Совместимо с pusherServer.trigger — отправляет событие на канал.
   * Сигнатура: trigger(channel, eventName, data)
   */
  async trigger(channel: string, event: string, data: unknown): Promise<void> {
    // Путь 1 — прямой in-process emit
    const io = getIo();
    if (io) {
      try {
        io.to(channel).emit(`${channel}:${event}`, data);
        return;
      } catch (e) {
        console.error("[socketServer] direct emit error:", channel, event, e);
      }
    }
    // Путь 2 — HTTP-fallback на /__internal_emit
    const ok = await emitViaHttp(channel, event, data);
    if (!ok && !warnedNoIo) {
      warnedNoIo = true;
      console.warn(
        "[socketServer] нет доступа к io. Не запущен ли Next.js не через server.js?",
      );
    }
  },
};
