import Image from "next/image";

/**
 * Главная страница приложения после входа.
 * Layout `(chat)` уже подключает Sidebar — здесь только центральный контент.
 */
export default function ChatsHome() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center px-6">
      <div className="relative w-40 h-40 mb-6">
        <Image
          src="/images/mascotGreeting.png"
          alt=""
          fill
          className="object-contain"
          priority
        />
      </div>

      <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
        Добро пожаловать в Talky
      </h1>
      <p className="text-white/50 max-w-md text-sm md:text-base">
        Выберите чат слева чтобы начать общение, или создайте новый.
      </p>

      <div className="mt-8 flex items-center gap-2 text-xs text-white/30 uppercase tracking-[0.2em]">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        вы онлайн
      </div>
    </div>
  );
}
