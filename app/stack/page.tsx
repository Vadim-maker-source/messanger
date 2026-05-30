import { headers } from "next/headers";
import StackContent from "@/components/StackContent";
import type { SiteHeaderUser } from "@/components/SiteHeader";
import { getCurrentUser } from "@/app/lib/api/user";

/**
 * Серверная обёртка вокруг client-компонента StackContent.
 * Подтягивает текущего пользователя через NextAuth (только на основном
 * домене — на vercel БД не дёргаем) и пробрасывает его в шапку.
 */
export default async function StackPage() {
  const h = await headers();
  const host = h.get("host") || "";
  const isVercel = host.endsWith(".vercel.app");

  let user: SiteHeaderUser | null = null;

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

  return <StackContent user={user} />;
}
