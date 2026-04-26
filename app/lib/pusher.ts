import PusherServer from 'pusher';

// Серверная часть всегда доступна
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu",
  useTLS: true,
});

// Клиентская часть - ленивая инициализация с проверкой
export const getPusherClient = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Динамический импорт только на клиенте
  const PusherClient = require('pusher-js');
  return new PusherClient(
    process.env.NEXT_PUBLIC_PUSHER_KEY!, 
    {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu",
    }
  );
};

// Для удобства использования в компонентах
export const pusherClient = typeof window !== 'undefined' 
  ? (() => {
      const PusherClient = require('pusher-js');
      return new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_KEY!, 
        {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu",
        }
      );
    })()
  : null;