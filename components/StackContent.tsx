"use client";

import { useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import SiteHeader, { type SiteHeaderUser } from "@/components/SiteHeader";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

interface Tech {
  name: string;
  category: string;
  description: string;
  /** simpleicons.org slug, либо null если используется customIcon */
  slug: string | null;
  /** Локальный путь к иконке, если её нет в simpleicons */
  customIcon?: string;
  /** Цвет для подсветки (hex, без #) */
  color: string;
}

const TECH_STACK: Tech[] = [
  // Frontend
  { name: "Next.js",       category: "Frontend",   description: "App Router, server actions, RSC",          slug: "nextdotjs",   color: "ffffff" },
  { name: "React",         category: "Frontend",   description: "UI-библиотека, hooks, suspense",           slug: "react",       color: "61DAFB" },
  { name: "TypeScript",    category: "Frontend",   description: "Типизация, строгий strict-mode",           slug: "typescript",  color: "3178C6" },
  { name: "Tailwind CSS",  category: "Frontend",   description: "Utility-first стилизация",                 slug: "tailwindcss", color: "06B6D4" },
  { name: "shadcn/ui",     category: "Frontend",   description: "Компоненты на Tailwind + Radix",           slug: "shadcnui",    color: "ffffff" },
  { name: "GSAP",          category: "Animations", description: "Скролл-анимации, морфинг, timelines",      slug: "greensock",   color: "88CE02" },
  { name: "Framer Motion", category: "Animations", description: "React-анимации UI и переходов",            slug: "framer",      color: "0055FF" },

  // Backend
  { name: "Node.js",       category: "Backend",    description: "Runtime для серверных функций",            slug: "nodedotjs",   color: "5FA04E" },
  { name: "Prisma",        category: "Backend",    description: "Type-safe ORM для PostgreSQL",             slug: "prisma",      color: "ffffff" },
  { name: "PostgreSQL",    category: "Database",   description: "Реляционная БД пользователей и сообщений", slug: "postgresql",  color: "4169E1" },
  { name: "NextAuth",      category: "Auth",       description: "Сессии, JWT, OAuth-провайдеры",            slug: null,          customIcon: "/images/auth-logo.png", color: "A855F7" },

  // Real-time
  { name: "WebRTC",        category: "Real-time",  description: "P2P видео-звонки и аудио",                 slug: "webrtc",      color: "FFFFFF" },
  { name: "Pusher",        category: "Real-time",  description: "Push-события и pub/sub каналы",            slug: "pusher",      color: "300D4F" },
  { name: "Socket.IO",     category: "Real-time",  description: "WebSocket fallback и комнаты",             slug: "socketdotio", color: "ffffff" },

  // Mobile
  { name: "Flutter",       category: "Mobile",     description: "Кросс-платформенное мобильное приложение", slug: "flutter",     color: "02569B" },
  { name: "Dart",          category: "Mobile",     description: "Язык для Flutter",                         slug: "dart",        color: "0175C2" },

  // Cloud & Infra
  { name: "Firebase",      category: "Cloud",      description: "FCM push-уведомления",                     slug: "firebase",    color: "FFCA28" },
  { name: "Yandex Cloud",  category: "Cloud",      description: "S3-совместимое хранилище медиа",           slug: "yandexcloud", color: "5282FF" },
  { name: "Vercel",        category: "Hosting",    description: "Хостинг лендинга и pre-registration",      slug: "vercel",      color: "ffffff" },

  // DevOps / Infrastructure
  { name: "Linux",         category: "DevOps",     description: "Серверная ОС, основа всей инфраструктуры", slug: "linux",       color: "FCC624" },
  { name: "Docker",        category: "DevOps",     description: "Контейнеризация сервисов и БД",            slug: "docker",      color: "2496ED" },
  { name: "Nginx",         category: "DevOps",     description: "Reverse-proxy и раздача статики",          slug: "nginx",       color: "009639" },
  { name: "GitHub",        category: "DevOps",     description: "Хранение кода и CI/CD-пайплайны",          slug: "github",      color: "ffffff" },
];

export default function StackContent({ user }: { user?: SiteHeaderUser | null }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Заголовок
      gsap.from(".stack-title-line", {
        yPercent: 110,
        duration: 1,
        ease: "expo.out",
        stagger: 0.08,
        delay: 0.1,
      });
      gsap.from(".stack-sub", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        ease: "expo.out",
        delay: 0.4,
      });

      // Карточки — gsap.set начальное состояние, gsap.to с scrollTrigger.
      // Быстрая волна: 0.5s каждая, stagger 0.04 — общая длительность ~0.7s.
      gsap.utils.toArray<HTMLElement>(".tech-grid").forEach((grid) => {
        const cards = grid.querySelectorAll(".tech-card");
        gsap.set(cards, { y: 20, opacity: 0 });
        gsap.to(cards, {
          y: 0,
          opacity: 1,
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.04,
          scrollTrigger: {
            trigger: grid,
            start: "top bottom",
            toggleActions: "play none none none",
          },
        });
      });

      ScrollTrigger.refresh();

      // Категории-якоря
      gsap.from(".cat-anchor", {
        opacity: 0,
        x: -20,
        duration: 0.6,
        ease: "expo.out",
        stagger: 0.1,
        delay: 0.7,
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="min-h-screen bg-black text-white relative overflow-x-hidden">
      {/* Шум */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }}
      />

      {/* Светящиеся блобы */}
      <div className="fixed -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[120px] pointer-events-none" />
      <div className="fixed top-1/2 -right-40 w-[600px] h-[600px] rounded-full bg-violet-700/10 blur-[140px] pointer-events-none" />

      {/* Header */}
      <SiteHeader user={user} />

      {/* Hero */}
      <section className="relative px-6 pt-28 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-violet-400 mb-6">
            / стек технологий
          </div>
          <h1 className="font-black tracking-tighter leading-[0.95] text-5xl md:text-7xl lg:text-8xl mb-6">
            <span className="inline-block overflow-hidden align-bottom">
              <span className="stack-title-line inline-block">из чего</span>
            </span>{" "}
            <br />
            <span className="inline-block overflow-hidden align-bottom">
              <span className="stack-title-line inline-block text-violet-500">сделан talky</span>
            </span>
          </h1>
          <p className="stack-sub max-w-2xl text-base md:text-lg text-white/55">
            Современный стек, минимум легаси. Всё что мы используем — работает быстро и проверено в бою.
          </p>

          {/* Якоря категорий */}
          <div className="mt-10 flex flex-wrap gap-2">
            {Array.from(new Set(TECH_STACK.map((t) => t.category))).map((cat) => (
              <a
                key={cat}
                href={`#cat-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                className="cat-anchor inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-md text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                {cat}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Сетка по категориям */}
      <section className="relative px-6 pb-24">
        <div className="max-w-6xl mx-auto space-y-16">
          {Array.from(new Set(TECH_STACK.map((t) => t.category))).map((cat) => {
            const items = TECH_STACK.filter((t) => t.category === cat);
            const id = `cat-${cat.toLowerCase().replace(/\s+/g, "-")}`;
            return (
              <div key={cat} id={id} className="scroll-mt-20">
                <div className="flex items-baseline justify-between mb-5">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{cat}</h2>
                  <span className="text-xs font-mono text-white/30 uppercase tracking-[0.2em]">
                    {items.length} {items.length === 1 ? "технология" : "технологии"}
                  </span>
                </div>
                <div className="tech-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((t, i) => (
                    <TechCard key={t.name} tech={t} index={i} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.06] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-sm text-white/40">
            всего: <span className="text-white font-semibold">{TECH_STACK.length}</span> технологий
          </div>
          <Link
            href="/"
            className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            ← вернуться на главную
          </Link>
        </div>
      </footer>
    </div>
  );
}

function TechCard({ tech, index }: { tech: Tech; index: number }) {
  return (
    <div className="tech-card group relative overflow-hidden rounded-3xl bg-white/[0.02] backdrop-blur-md border border-white/[0.05] p-7 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.12] hover:-translate-y-1">
      {/* Свечение в углу — в цвет технологии */}
      <div
        className="absolute -right-12 -top-12 w-44 h-44 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none"
        style={{ backgroundColor: `#${tech.color}` }}
      />

      <div className="relative flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-white/40 uppercase tracking-wider mb-2 font-mono">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="text-xl font-semibold tracking-tight text-white mb-2 truncate">
            {tech.name}
          </div>
          <p className="text-sm text-white/45 leading-relaxed line-clamp-2">
            {tech.description}
          </p>
        </div>

        {/* Аватарка с эффектом перехода */}
        <div className="relative shrink-0 w-16 h-16 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center justify-center overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 group-hover:rotate-[-6deg]">
          {tech.customIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tech.customIcon}
              alt={tech.name}
              className="w-9 h-9 object-contain transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          ) : tech.slug ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/images/${tech.slug}.svg`}
              alt={tech.name}
              className="w-8 h-8 transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <span
              className="text-3xl font-black"
              style={{ color: `#${tech.color}` }}
            >
              {tech.name.charAt(0)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
