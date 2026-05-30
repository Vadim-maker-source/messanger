"use client";

import Link from "next/link";
import Image from "next/image";

export interface SiteHeaderUser {
  id: string;
  displayName: string | null;
  username: string;
  avatarUrl?: string | null;
}

interface Props {
  user?: SiteHeaderUser | null;
  /** Домашняя страница для якорей (по умолчанию `/`) — ссылки навигации идут на /#... */
  home?: string;
}

/**
 * Liquid-glass pill хедер для лендинга и других публичных страниц.
 * Если `user` передан — показывает аватар+имя; иначе — кнопку "Войти".
 *
 * Якорные ссылки (#about, #facts, ...) ведут на `/` чтобы работать с любой
 * страницы — браузер откроет лендинг и проскроллит к нужной секции.
 */
export default function SiteHeader({ user, home = "/" }: Props) {
  const anchor = (h: string) => (home === "/" ? h : `${home}${h}`);
  return (
    <header className="fixed top-3 left-0 right-0 z-40 flex justify-center px-3">
      <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/[0.07] rounded-full shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] w-full max-w-3xl">
        <div className="pl-5 pr-2 h-12 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/images/icon.png" alt="Talky" width={28} height={28} className="rounded-full" />
            <span className="font-bold text-lg tracking-tight">talky</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-md font-medium text-white/70">
            <Link href={anchor("/#about")}  className="hover:text-white transition-colors">О проекте</Link>
            <Link href={anchor("/#facts")}  className="hover:text-white transition-colors">Возможности</Link>
            <Link href="/stack" className="hover:text-white transition-colors">Стек</Link>
            <Link href={anchor("/#team")}   className="hover:text-white transition-colors">Команда</Link>
            <Link href={anchor("/#donate")} className="hover:text-white transition-colors">Поддержать</Link>
          </nav>
          {user ? <UserChip user={user} /> : <LoginButton />}
        </div>
      </div>
    </header>
  );
}

function LoginButton() {
  return (
    <Link
      href="/sign-in"
      className="px-4 py-1.5 rounded-full bg-violet-500 text-white text-md font-semibold hover:bg-violet-400 transition-colors shrink-0"
    >
      Войти
    </Link>
  );
}

function UserChip({ user }: { user: SiteHeaderUser }) {
  const name = user.displayName || user.username;
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <Link
      href="/chats"
      className="group flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors shrink-0"
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          className="w-7 h-7 rounded-full object-cover"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-violet-500 grid place-items-center text-black font-bold text-sm">
          {initial}
        </div>
      )}
      <span className="text-[14px] font-medium text-white/85 group-hover:text-white max-w-[120px] truncate">
        {name}
      </span>
    </Link>
  );
}
