"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export interface LandingUser {
  id: string;
  displayName: string | null;
  username: string;
  avatarUrl?: string | null;
}

// ─── Данные ─────────────────────────────────────────────────────────────────

interface Developer {
  id: string;
  name: string;
  handle: string;
  role: string;
  about: string;
  experience: string;
  skills: string[];
  /** Буква (или эмодзи) на цветном фоне — fallback если не задан avatarImage */
  avatar: string;
  /** Путь к изображению аватара. Если задан — используется вместо буквы. */
  avatarImage?: string;
  accent: string;
}

const DEVELOPERS: Developer[] = [
  {
    id: "vadim",
    name: "Вадим",
    handle: "@vadim",
    role: "Founder · Full-stack & Web & Mobile & Desctop",
    about:
      "Строю Talky с нуля: frontend на Next.js, TypeScript, backend на Node.js, мобильное приложение на Flutter, WebRTC-звонки, real-time сообщения. Люблю чистую архитектуру и минимализм в UI.",
    experience: "2 месяца работы над Talky, 2 года опыта разработки Full-stack, 1 месяц разработки на Flutter, 2 недели опыта в DevOps и настройке серверов, 3 года в IT.",
    skills: [
      "Next.js", "TypeScript", "Flutter", "Dart", "Prisma", "SQL", "SQLite",
      "PostgreSQL", "Python", "WebRTC", "Pusher", "Socket.io", "Tailwind",
      "Framer Motion", "GSAP", "Firebase", "Yandex Cloud", "Linux", "Github", "Linux", "Docker", "Nginx", "C++", "Python", "Bash"
    ],
    avatar: "В",
    avatarImage: "/images/logo.jpg",
    accent: "#A855F7",
  },
];

const FACTS = [
  { kind: "violet", title: "Звонки",     text: "WebRTC P2P, HD-видео, демонстрация экрана, групповые звонки." },
  { kind: "dark",   title: "Real-time",  text: "Pusher + Socket.io. Сообщения, статусы и набор текста — мгновенно." },
  { kind: "violet", title: "Серверы",    text: "Каналы, роли, инвайты — как в Discord, но проще и быстрее." },
  { kind: "outline", title: "Шифрование", text: "TLS, 2FA через email/push, серверная валидация. Безопасно по умолчанию." },
  { kind: "white",   title: "Кросс-платформа", text: "Web и мобильное приложение Flutter. Один аккаунт — везде." },
  { kind: "violet",  title: "Open Source",     text: "Без рекламы, без слежки. Код открыт и проверяем." },
];

// ─── Главный компонент ──────────────────────────────────────────────────────

export default function Landing({ user }: { user?: LandingUser | null }) {
  const main = useRef<HTMLDivElement>(null);
  const [openDev, setOpenDev] = useState<Developer | null>(null);

  useGSAP(
    () => {
      // Hero — Talky
      gsap.from(".hero-talky", {
        yPercent: 110,
        opacity: 0,
        duration: 1,
        ease: "expo.out",
        delay: 0.1,
      });

      // Ротация слов после "—"
      const stack = main.current?.querySelector(".rotator-stack") as HTMLElement | null;
      const words = main.current?.querySelectorAll<HTMLElement>(".rotator-word");
      if (stack && words && words.length > 0) {
        const lineHeight = words[0].offsetHeight;
        // Высота контейнера = высота одного слова
        (stack.parentElement as HTMLElement).style.height = `${lineHeight}px`;
        gsap.set(stack, { y: 0 });
        const tl = gsap.timeline({ repeat: -1, defaults: { ease: "expo.inOut" }, delay: 1.2 });
        for (let i = 1; i < words.length; i++) {
          tl.to(stack, { y: -i * lineHeight, duration: 0.7 }, "+=1.6");
        }
        // Возврат к началу плавно
        tl.to(stack, { y: 0, duration: 0.7 }, "+=1.6");
      }

      // Hero — подзаголовок
      gsap.from(".hero-tag", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        ease: "expo.out",
        delay: 0.4,
      });
      gsap.from(".hero-actions > *", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        ease: "expo.out",
        delay: 0.6,
        stagger: 0.08,
      });
      gsap.from(".hero-meta > *", {
        opacity: 0,
        duration: 0.8,
        ease: "expo.out",
        delay: 0.9,
        stagger: 0.05,
      });

      // Волнистая линия под Talky — рисуется и плавно "дышит"
      const wavyPath = document.querySelector(".wavy-path") as SVGPathElement | null;
      if (wavyPath) {
        const len = wavyPath.getTotalLength();
        wavyPath.style.strokeDasharray = `${len}`;
        wavyPath.style.strokeDashoffset = `${len}`;
        gsap.to(wavyPath, {
          strokeDashoffset: 0,
          duration: 1.4,
          ease: "expo.out",
          delay: 0.6,
          onComplete: () => {
            // Плавное "дыхание" — линия слегка вибрирует по толщине
            gsap.to(wavyPath, {
              strokeWidth: 9,
              duration: 1.6,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            });
          },
        });
      }

      // Заголовки секций — slide up
      gsap.utils.toArray<HTMLElement>(".reveal-title").forEach((el) => {
        gsap.from(el.querySelectorAll(".reveal-line"), {
          yPercent: 110,
          duration: 1,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });

      // Карточки фактов — мягкое появление
      gsap.from(".fact-card", {
        y: 30,
        opacity: 0,
        duration: 1.1,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: ".facts-grid", start: "top 85%" },
      });

      // Плавное появление любой секции при первом скролле
      gsap.utils.toArray<HTMLElement>(".section-fade").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 40,
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      // Команда — купол fade-in
      gsap.from(".team-dome", {
        scale: 0.6,
        opacity: 0,
        duration: 1.4,
        ease: "expo.out",
        scrollTrigger: { trigger: ".team-section", start: "top 75%" },
      });
      gsap.from(".team-avatar", {
        y: 60,
        opacity: 0,
        scale: 0.7,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.15,
        scrollTrigger: { trigger: ".team-section", start: "top 75%" },
      });

      // Donate
      gsap.from(".donate-card", {
        scale: 0.94,
        opacity: 0,
        duration: 1,
        ease: "expo.out",
        scrollTrigger: { trigger: ".donate-card", start: "top 85%" },
      });

      // Прогресс
      gsap.to(".scroll-progress", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: true },
      });

      // Параллакс-точки на фоне
      gsap.utils.toArray<HTMLElement>(".parallax-dot").forEach((el, i) => {
        gsap.to(el, {
          y: (i % 2 === 0 ? -1 : 1) * 220,
          ease: "none",
          scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 1 },
        });
      });
    },
    { scope: main }
  );

  return (
    <div ref={main} className="relative bg-black text-white overflow-x-hidden selection:bg-violet-500/40 selection:text-white">
      {/* Шум-фон + точки на параллаксе */}
      <Noise />
      <div className="fixed inset-0 pointer-events-none">
        {[
          { top: "12%", left: "8%" },
          { top: "30%", right: "12%" },
          { top: "55%", left: "15%" },
          { top: "78%", right: "8%" },
          { top: "90%", left: "30%" },
        ].map((s, i) => (
          <div
            key={i}
            className="parallax-dot absolute w-1.5 h-1.5 rounded-full bg-violet-500/60 shadow-[0_0_30px_8px_rgba(168,85,247,0.4)]"
            style={s}
          />
        ))}
      </div>

      <div className="scroll-progress fixed top-0 left-0 right-0 h-[2px] bg-violet-500 origin-left scale-x-0 z-50" />
      <SiteHeader user={user} />
      <Hero />
      <SectionDivider />
      <ProjectAbout />
      <SectionDivider />
      <Facts />
      <SectionDivider />
      <Team onPick={setOpenDev} />
      <SectionDivider />
      <FAQSection />
      <SectionDivider />
      <Donate />
      <Footer />

      <DeveloperPanel dev={openDev} onClose={() => setOpenDev(null)} />
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  const ROTATING = ["современно.", "удобно.", "надёжно.", "быстро.", "честно."];
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-28 pb-16">
      {/* Главная фраза. На мобилке — две строки (Talky сверху, слово снизу),
          на десктопе — одна строка через тире. */}
      <h1 className="font-black tracking-tighter leading-[0.92] text-[16vw] sm:text-7xl md:text-8xl lg:text-[8.5rem] xl:text-[9.5rem] flex flex-col md:flex-row md:items-baseline md:justify-center md:gap-5 text-center">
        <span className="relative inline-block">
          <span className="hero-talky inline-block">Talky</span>
          {/* Зелёная волнистая линия */}
          <svg
            viewBox="0 0 600 60"
            preserveAspectRatio="none"
            className="absolute left-0 right-0 -bottom-[0.18em] w-full h-[0.28em]"
            fill="none"
          >
            <path
              className="wavy-path"
              d="M 8 38 Q 60 8, 120 30 T 240 30 T 360 30 T 480 30 T 592 30"
              stroke="#22D3A0"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="hidden md:inline-block text-white/40 select-none">—</span>
        <span className="rotator-frame relative inline-block overflow-hidden text-violet-500">
          <span className="rotator-stack inline-flex flex-col items-center md:items-start">
            {ROTATING.map((w, i) => (
              <span key={i} className="rotator-word inline-block whitespace-nowrap">
                {w}
              </span>
            ))}
          </span>
        </span>
      </h1>

      <p className="hero-tag max-w-2xl mt-12 text-center text-base md:text-lg text-white/55">
        Чаты, серверы и звонки. Web и мобилка. Без шума, без рекламы — то, чем хочется пользоваться.
      </p>

      <div className="hero-actions mt-10 flex flex-col sm:flex-row gap-3 items-center">
        <Link
          href="/sign-up"
          className="group px-6 py-3 rounded-2xl bg-violet-500 text-white font-medium hover:bg-violet-400 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          Создать аккаунт →
        </Link>
        <a
          href="#about"
          className="px-6 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-md text-white font-medium hover:bg-white/[0.08] transition-all"
        >
          Узнать больше
        </a>
      </div>

      <div className="hero-meta mt-14 flex items-center gap-8 text-xs text-white/35 uppercase tracking-[0.2em]">
        <span>v1.0</span>
        <span>·</span>
        <span>android · ios · web</span>
        <span>·</span>
        <span>open source</span>
      </div>
    </section>
  );
}

// ─── About проекта ──────────────────────────────────────────────────────────

function ProjectAbout() {
  return (
    <section id="about" className="section-fade relative px-6 py-32">
      <div className="max-w-5xl mx-auto">
        <div className="text-xs text-violet-400 font-mono uppercase tracking-[0.3em] mb-6">
          / о проекте
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card kind="violet">
            <p className="text-2xl md:text-3xl font-medium leading-snug">
              Мессенджер, который<span className="font-bold"> не просит отдать ему душу.</span>
            </p>
          </Card>
          <Card kind="outline">
            <p className="text-base text-white/70 leading-relaxed">
              Никаких кривых трекеров, рекламы и навязанных историй. Просто чаты,
              звонки и серверы — быстро, без украшательств и без слежки.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}

// ─── Карточки разноцветные ─────────────────────────────────────────────────

function Card({ kind, children }: { kind: "violet" | "dark" | "outline" | "white"; children: React.ReactNode }) {
  const styles: Record<typeof kind, string> = {
    violet:
      "bg-violet-500 text-white border border-violet-400/40",
    dark:
      "bg-[#0c0c0e] text-white border border-white/[0.06]",
    outline:
      "bg-white/[0.02] backdrop-blur-xl text-white border border-white/[0.08]",
    white:
      "bg-white text-black border border-white",
  };
  return (
    <div className={`rounded-3xl p-8 md:p-10 ${styles[kind]}`}>
      {children}
    </div>
  );
}

// ─── Возможности ────────────────────────────────────────────────────────────

function Facts() {
  return (
    <section id="facts" className="section-fade relative px-6 py-32">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <h2 className="reveal-title text-4xl md:text-6xl font-black tracking-tighter leading-[0.95]">
            <span className="inline-block overflow-hidden align-bottom">
              <span className="reveal-line inline-block">что умеет</span>
            </span>
            <br />
            <span className="inline-block overflow-hidden align-bottom">
              <span className="reveal-line inline-block text-violet-500">talky</span>
            </span>
          </h2>
          <span className="text-xs text-white/40 uppercase tracking-[0.2em] hidden md:block">
            v1.0 / 2026
          </span>
        </div>

        <div className="facts-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {FACTS.map((f, i) => (
            <FactCard key={i} index={i + 1} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FactCard({ kind, index, title, text }: { kind: string; index: number; title: string; text: string }) {
  const styles: Record<string, string> = {
    violet:
      "bg-violet-500 text-white",
    dark:
      "bg-[#0c0c0e] text-white border border-white/[0.06]",
    outline:
      "bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] text-white",
    white:
      "bg-white text-black",
  };
  return (
    <div className={`fact-card group relative h-full rounded-3xl p-7 transition-transform hover:-translate-y-1 ${styles[kind]}`}>
      <div className={`text-xs font-mono mb-6 ${kind === "white" ? "text-black/50" : "text-white/40"}`}>
        / {String(index).padStart(2, "0")}
      </div>
      <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 leading-tight">{title}</h3>
      <p className={`text-sm leading-relaxed ${kind === "white" ? "text-black/70" : "text-white/65"}`}>{text}</p>
    </div>
  );
}

// ─── Team ───────────────────────────────────────────────────────────────────

function Team({ onPick }: { onPick: (d: Developer) => void }) {
  return (
    <section id="team" className="team-section section-fade relative px-6 py-40 overflow-hidden">
      {/* Купол */}
      <div className="team-dome absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.55)_0%,rgba(168,85,247,0.15)_25%,transparent_60%)] pointer-events-none" />
      <div className="team-dome absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[40%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.7)_0%,transparent_70%)] pointer-events-none blur-3xl" />

      <div className="relative max-w-5xl mx-auto text-center">
        <div className="text-xs text-violet-400 font-mono uppercase tracking-[0.3em] mb-4">
          / команда
        </div>
        <h2 className="reveal-title text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mb-6">
          <span className="inline-block overflow-hidden align-bottom">
            <span className="reveal-line inline-block">кто строит</span>
          </span>{" "}
          <span className="inline-block overflow-hidden align-bottom">
            <span className="reveal-line inline-block text-violet-500">talky</span>
          </span>
        </h2>
        <p className="text-white/50 max-w-md mx-auto mb-20">
          Маленькая команда. Большие планы. Кликни на аватар, чтобы узнать больше.
        </p>

        <div className="flex items-end justify-center gap-6 md:gap-12 flex-wrap">
          {DEVELOPERS.map((d) => (
            <button
              key={d.id}
              onClick={() => onPick(d)}
              className="team-avatar group flex flex-col items-center"
            >
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: d.accent }}
                />
                <div
                  className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden grid place-items-center text-5xl md:text-7xl font-black border-4 transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: d.avatarImage ? "transparent" : d.accent,
                    borderColor: "rgba(255,255,255,0.15)",
                    color: "#000",
                  }}
                >
                  {d.avatarImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.avatarImage}
                      alt={d.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    d.avatar
                  )}
                </div>
              </div>
              <div className="mt-4 text-base font-medium">{d.name}</div>
              <div className="text-xs text-white/40 mt-0.5">{d.handle}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Side panel разработчика ────────────────────────────────────────────────

function DeveloperPanel({ dev, onClose }: { dev: Developer | null; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          dev ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#08080a] border-l border-white/[0.06] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          dev ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {dev && (
          <div className="h-full flex flex-col overflow-y-auto">
            {/* Шапка */}
            <div className="relative px-6 pt-6 pb-8">
              <button
                onClick={onClose}
                className="absolute top-5 right-5 w-9 h-9 rounded-full grid place-items-center bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
                aria-label="Закрыть"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 6 L18 18 M18 6 L6 18" />
                </svg>
              </button>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-full blur-xl opacity-70"
                    style={{ backgroundColor: dev.accent }}
                  />
                  <div
                    className="relative w-20 h-20 rounded-full overflow-hidden grid place-items-center text-4xl font-black border-2"
                    style={{
                      backgroundColor: dev.avatarImage ? "transparent" : dev.accent,
                      borderColor: "rgba(255,255,255,0.15)",
                      color: "#000",
                    }}
                  >
                    {dev.avatarImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={dev.avatarImage}
                        alt={dev.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      dev.avatar
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">{dev.name}</h3>
                  <div className="text-sm text-white/40 mt-0.5">{dev.handle}</div>
                </div>
              </div>

              <div className="mt-6 inline-block px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 text-base font-medium">
                {dev.role}
              </div>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* О себе */}
            <Section label="О себе">
              <p className="text-base text-white/70 leading-relaxed">{dev.about}</p>
            </Section>

            <div className="h-px bg-white/[0.06]" />

            {/* Опыт */}
            <Section label="Опыт работы">
              <p className="text-base text-white/70 leading-relaxed">{dev.experience}</p>
            </Section>

            <div className="h-px bg-white/[0.06]" />

            {/* Скилы */}
            <Section label="Скилы">
              <div className="flex flex-wrap gap-2">
                {dev.skills.map((s) => (
                  <span
                    key={s}
                    className="px-3 py-1.5 rounded-lg text-sm bg-white/[0.03] border border-white/[0.06] text-white/85 hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-white transition-colors"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Section>

            <div className="flex-1" />

            <div className="px-6 py-6 border-t border-white/[0.06]">
              <div className="text-xs text-white/30 uppercase tracking-[0.2em]">
                core team · talky
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-7">
      <div className="text-xs text-violet-400 font-mono uppercase tracking-[0.3em] mb-4">
        / {label}
      </div>
      {children}
    </div>
  );
}

// ─── Donate ─────────────────────────────────────────────────────────────────

function Donate() {
  return (
    <section id="donate" className="section-fade relative px-6 py-32">
      <div className="max-w-6xl mx-auto">
        <div className="donate-card relative overflow-hidden rounded-[40px] border border-white/[0.06] bg-[#0a0a0c]">
          {/* Светящиеся декоративные элементы */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-500/20 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />

          <div className="relative grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
            {/* Левая часть — текст и CTA */}
            <div className="p-10 md:p-14 lg:p-16 lg:pr-10">
              <div className="text-xs font-mono uppercase tracking-[0.3em] text-violet-400 mb-5">
                / поддержать
              </div>

              <h2 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95] mb-6">
                хочешь, чтобы<br />
                <span className="text-violet-500">talky жил?</span>
              </h2>

              <p className="text-white/55 max-w-xl mb-10 text-base md:text-lg leading-relaxed">
                Все деньги идут на развитие проекта — серверы, домен, инфраструктура.
                Никакого кармана, никакой рекламы. Если Talky тебе помогает — поддержи его.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://www.donationalerts.com/r/talky"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-violet-500 text-white font-semibold hover:bg-violet-400 hover:-translate-y-0.5 transition-all"
                >
                  💜 поддержать
                </a>
                <a
                  href="https://t.me/talky_obt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/[0.07] text-white font-medium hover:bg-white/[0.08] transition-colors"
                >
                  ✦ мы в telegram
                </a>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-4">
                <DonateStat amount="100%" label="на проект" />
                <DonateStat amount="0₽" label="в карман" highlight />
                <DonateStat amount="любая" label="сумма" />
              </div>
            </div>

            {/* Правая часть — Liquid glass card */}
            <div className="relative p-6 md:p-10 lg:p-8 lg:pr-14 flex items-center justify-center">
              <div className="relative w-full max-w-sm">
                {/* Светящееся облако позади */}
                <div className="absolute inset-0 bg-violet-500/30 blur-3xl rounded-full" />

                {/* Карточка */}
                <div className="relative rounded-[28px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
                  <div className="flex items-center justify-between mb-7">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                      donate
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_2px_rgba(34,211,160,0.7)]" />
                  </div>

                  <div className="mb-6">
                    <div className="text-[64px] leading-none font-black tracking-tighter text-white">
                      💜
                    </div>
                  </div>

                  <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                    Спасибо
                  </div>
                  <div className="text-sm text-white/50 mb-6">
                    100% твоего доната уходит на развитие Talky
                  </div>

                  <div className="h-px bg-white/[0.06] my-5" />

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40 uppercase tracking-wider">
                      безопасно
                    </span>
                    <span className="text-white/40">
                      DonationAlerts
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DonateStat({ amount, label, highlight = false }: { amount: string; label: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 backdrop-blur-md ${
        highlight
          ? "bg-violet-500/15 border border-violet-500/30"
          : "bg-white/[0.03] border border-white/[0.06]"
      }`}
    >
      <div className={`text-lg md:text-xl font-bold ${highlight ? "text-violet-300" : "text-white"}`}>
        {amount}
      </div>
      <div className="text-[11px] text-white/45 uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  );
}

// ─── FAQ ────────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: FaqItem[] = [
  {
    q: "Что такое Talky?",
    a: "Talky — это open-source мессенджер с фокусом на качественные звонки и приватность. Никакой рекламы, никакой продажи данных — только общение.",
  },
  {
    q: "Сколько стоит пользоваться?",
    a: "Talky бесплатный. Проект существует на пожертвования через DonationAlerts — поддержать можно по желанию.",
  },
  {
    q: "Где хранятся мои данные?",
    a: "На наших серверах в России (Yandex Cloud). Сообщения и файлы не передаются третьим лицам и не используются для тренировки моделей или рекламы.",
  },
  {
    q: "Зашифрованы ли сообщения?",
    a: "Звонки идут через WebRTC с DTLS-шифрованием end-to-end. Текстовые сообщения шифруются при передаче (TLS) и хранятся в зашифрованной БД на сервере.",
  },
  {
    q: "На каких платформах есть Talky?",
    a: "Веб-версия работает в любом современном браузере. Мобильное приложение доступно на Android (iOS — в работе).",
  },
  {
    q: "Можно ли создавать группы и серверы?",
    a: "Да. Поддерживаются приватные чаты, групповые чаты и сервера с каналами — как в Discord. Приглашать можно по ссылке.",
  },
  {
    q: "Использовался ли вайбкодинг?",
    a: "Нет. Мы не используем вайбкодинг и не планируем. Все функции разрабатываются на основе реальных потребностей. Использовался Claude Opus 4.7 для генерации текстов, но с тщательной ручной доработкой и отбором, а также для тестрования безопасности мессенджера на уязвимости к атакам, инъекциям, XSS, CSRF.",
  },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="section-fade relative px-6 py-32">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end justify-between mb-14">
          <h2 className="reveal-title text-4xl md:text-6xl font-black tracking-tighter leading-[0.95]">
            <span className="inline-block overflow-hidden align-bottom">
              <span className="reveal-line inline-block">частые</span>
            </span>
            <br />
            <span className="inline-block overflow-hidden align-bottom">
              <span className="reveal-line inline-block text-violet-500">вопросы</span>
            </span>
          </h2>
          <span className="text-xs text-white/40 uppercase tracking-[0.2em] hidden md:block font-mono">
            faq / {FAQ.length}
          </span>
        </div>

        {/* Единый блок с разделителями между вопросами */}
        <div className="rounded-3xl bg-white/[0.02] backdrop-blur-md border border-white/[0.05] divide-y divide-white/[0.06] overflow-hidden">
          {FAQ.map((item, i) => (
            <FaqRow
              key={i}
              item={item}
              index={i}
              isOpen={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqRow({
  item,
  index,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`faq-row group transition-colors duration-300 ${isOpen ? "bg-white/[0.02]" : "hover:bg-white/[0.015]"}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-6 px-7 py-7 text-left"
      >
        <div className="flex items-center gap-5 min-w-0">
          <span className="text-xs font-mono text-white/30 tracking-wider shrink-0">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span
            className={`text-lg md:text-2xl font-semibold tracking-tight truncate transition-colors ${
              isOpen ? "text-white" : "text-white/85 group-hover:text-white"
            }`}
          >
            {item.q}
          </span>
        </div>
        {/* Стрелочка вниз — поворачивается на 180° при открытии */}
        <span
          className={`shrink-0 w-11 h-11 rounded-full grid place-items-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen
              ? "bg-violet-500 text-white rotate-180"
              : "bg-white/[0.04] border border-white/[0.08] text-white/60 group-hover:text-white group-hover:bg-white/[0.08]"
          }`}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-7 pb-7 pl-[4.25rem] text-base md:text-lg text-white/65 leading-relaxed">
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Image src="/images/icon.png" alt="Talky" width={28} height={28} className="rounded-full" />
          <span className="font-semibold tracking-tight">talky</span>
          <span className="text-xs text-white/30 ml-3">© 2026 · made with 💜</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          <a
            href="https://t.me/talky_obt"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            className="group relative w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] hover:border-white/[0.15] transition-all"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://cdn.simpleicons.org/telegram/26A5E4"
              alt=""
              className="w-6 h-6 transition-transform duration-300 group-hover:scale-110"
            />
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="group relative w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] hover:border-white/[0.15] transition-all"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://cdn.simpleicons.org/github/ffffff"
              alt=""
              className="w-6 h-6 transition-transform duration-300 group-hover:scale-110"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── Плавный разделитель между секциями ────────────────────────────────────

function SectionDivider() {
  return (
    <div className="relative h-32 -my-16 pointer-events-none">
      <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-transparent via-violet-500/[0.04] to-transparent" />
    </div>
  );
}

// ─── Шум-текстура (для глубины) ─────────────────────────────────────────────

function Noise() {
  return (
    <div
      className="fixed inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay z-10"
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
      }}
    />
  );
}
