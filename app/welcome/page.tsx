"use client";

import { useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import Image from "next/image";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

export default function WelcomePage() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Появление бэйджа с галочкой (pop)
      gsap.from(".w-badge", {
        scale: 0,
        opacity: 0,
        duration: 0.7,
        ease: "back.out(2)",
        delay: 0.1,
      });

      // Вылет заголовка
      gsap.from(".w-title", {
        y: 30,
        opacity: 0,
        duration: 0.9,
        ease: "expo.out",
        delay: 0.3,
      });

      // Под-текст и кнопки
      gsap.from(".w-text", {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "expo.out",
        delay: 0.5,
        stagger: 0.08,
      });

      // Волнистая линия рисуется и потом дышит
      const wavyPath = document.querySelector(".welcome-wave") as SVGPathElement | null;
      if (wavyPath) {
        const len = wavyPath.getTotalLength();
        wavyPath.style.strokeDasharray = `${len}`;
        wavyPath.style.strokeDashoffset = `${len}`;
        gsap.to(wavyPath, {
          strokeDashoffset: 0,
          duration: 1.4,
          ease: "expo.out",
          delay: 0.7,
          onComplete: () => {
            gsap.to(wavyPath, {
              strokeWidth: 6,
              duration: 1.6,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            });
          },
        });
      }

      // Конфетти-точки
      gsap.from(".confetti", {
        opacity: 0,
        scale: 0,
        duration: 0.6,
        ease: "back.out(2)",
        stagger: 0.05,
        delay: 0.6,
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
      {/* Шум */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }}
      />

      {/* Светящиеся блобы */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-violet-600/20 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] rounded-full bg-violet-700/15 blur-[140px] pointer-events-none" />

      {/* Конфетти-точки */}
      {[
        { top: "15%", left: "20%", color: "#A855F7" },
        { top: "25%", right: "15%", color: "#22D3A0" },
        { top: "60%", left: "10%", color: "#A855F7" },
        { top: "70%", right: "20%", color: "#22D3A0" },
        { top: "35%", left: "75%", color: "#A855F7" },
        { top: "85%", left: "40%", color: "#22D3A0" },
      ].map((c, i) => (
        <div
          key={i}
          className="confetti absolute w-2 h-2 rounded-full"
          style={{ ...c, backgroundColor: c.color, boxShadow: `0 0 20px 4px ${c.color}55` }}
        />
      ))}

      {/* Header */}
      <header className="relative z-10 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-xl bg-violet-500 grid place-items-center transition-transform group-hover:scale-105">
              <span className="text-black font-black text-lg leading-none">t</span>
            </div>
            <span className="font-bold text-lg tracking-tight">talky</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> На главную
          </Link>
        </div>
      </header>

      {/* Контент */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-10">
        <div className="w-full max-w-2xl text-center">
          {/* Бейдж с галочкой */}
          <div className="flex justify-center">
            <Image src="/images/success-payment.png" alt="Спасибо хорошо" width={128} height={128} className="flex items-center justify-center rounded-3xl mb-8 shadow-[0_0_60px_rgba(168,85,247,0.4)]" />
          </div>
          {/* Заголовок */}
          <h1 className="w-title font-black tracking-tighter leading-[0.95] text-5xl md:text-7xl lg:text-8xl mb-6">
            Спасибо за{" "}
            <span className="relative inline-block">
              регистрацию
              <svg
                viewBox="0 0 600 60"
                preserveAspectRatio="none"
                className="absolute left-0 right-0 -bottom-[0.18em] w-full h-[0.28em]"
                fill="none"
              >
                <path
                  className="welcome-wave"
                  d="M 8 38 Q 60 8, 120 30 T 240 30 T 360 30 T 480 30 T 592 30"
                  stroke="#22D3A0"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          {/* Описание */}
          <p className="w-text max-w-xl mx-auto text-base md:text-lg text-white/60 mb-10">
            Вы успешно прошли предварительную регистрацию в Talky. Как только мы запустимся — пришлём приглашение на ваш email одними из первых.
          </p>

          {/* Информационные карточки */}
          <div className="w-text grid grid-cols-1 md:grid-cols-3 gap-3 mb-10 max-w-xl mx-auto">
            <InfoCard label="Статус" value="✓ Зарегистрирован" highlight />
            <InfoCard label="Приоритет" value="Ранний доступ" />
            <InfoCard label="Уведомление" value="На email" />
          </div>

          {/* CTA */}
          <div className="w-text flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="px-6 py-3 rounded-2xl bg-violet-500 text-white font-medium hover:bg-violet-400 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Вернуться на главную
            </Link>
            <Link
              href="https://t.me/talky"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-md text-white font-medium hover:bg-white/[0.08] transition-colors"
            >
              ✦ telegram-канал
            </Link>
          </div>

          {/* Низ */}
          <div className="w-text mt-16 text-xs text-white/30 uppercase tracking-[0.2em]">
            спасибо, что верите в проект 💜
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 backdrop-blur-md ${
        highlight
          ? "bg-violet-500/10 border border-violet-500/30"
          : "bg-white/[0.03] border border-white/[0.06]"
      }`}
    >
      <div className="text-[11px] text-white/40 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-sm font-semibold mt-0.5 ${highlight ? "text-violet-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
