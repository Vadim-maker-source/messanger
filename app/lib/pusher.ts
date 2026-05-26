// ════════════════════════════════════════════════════════════════════════════
// LEGACY MODULE — оставлен для обратной совместимости с импортами вида
//   import { pusherServer, pusherClient } from "@/app/lib/pusher"
// ════════════════════════════════════════════════════════════════════════════
//
// Реальная реализация теперь — Socket.io. Этот файл просто реэкспортит
// socketServer / socketClient под старыми именами, чтобы существующий код
// в API routes и компонентах не пришлось трогать.
//
// Когда будете удалять последние следы Pusher, можно будет:
//   1. Прогнать find/replace pusherServer → socketServer, pusherClient → socketClient
//   2. Заменить импорты pusher → socket-server / socket-client
//   3. Удалить этот файл и pusher из package.json
//
// ════════════════════════════════════════════════════════════════════════════

export { socketServer as pusherServer } from "./socket-server";

// pusherClient ранее был nullable (на сервере null). Теперь экспортим
// сам socketClient — он внутри сам обрабатывает SSR через стаб-объект
// (subscribe возвращает no-op channel когда window нет).
//
// Существующие проверки `if (!pusherClient) return` останутся корректными:
// на клиенте socketClient истинный, return не сработает.
export { socketClient as pusherClient } from "./socket-client";
