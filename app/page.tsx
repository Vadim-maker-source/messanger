import { headers } from "next/headers";
import Landing, { type LandingUser } from "@/components/Landing";
import { getCurrentUser } from "@/app/lib/api/user";

/**
 * Главная страница (лендинг).
 *
 * • На vercel-домене (pre-registration) — `getCurrentUser` не вызывается,
 *   чтобы не дёргать Prisma из Vercel-функции. Просто рендерим лендинг
 *   без user — header покажет кнопку «Войти».
 * • На основном сервере — забираем текущую сессию через NextAuth +
 *   подтягиваем профиль. Если есть — header показывает имя и аватар
 *   вместо кнопки «Войти».
 */
export default async function HomePage() {
  const h = await headers();
  const host = h.get("host") || "";
  const isVercel = host.endsWith(".vercel.app");

  let user: LandingUser | null = null;

  if (!isVercel) {
    try {
      const current = await getCurrentUser();
      if (current) {
        user = {
          id: current.id,
          displayName: current.displayName ?? null,
          username: current.username,
          avatarUrl: current.avatarUrl ?? null,
        };
      }
    } catch {
      user = null;
    }
  }

  return <Landing user={user} />;
}
