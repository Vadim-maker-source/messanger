"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  XCircle,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

type QrStatus = "loading" | "PENDING" | "SCANNED" | "APPROVED" | "EXPIRED" | "CANCELLED" | "ERROR";

export default function QrSignInPage() {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<QrStatus>("loading");
  const [secondsLeft, setSecondsLeft] = useState<number>(90);
  const [signingIn, setSigningIn] = useState(false);

  // ─── Создание нового QR ────────────────────────────────────────────
  const createNewQr = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/qr/create", { method: "POST" });
      const data = await res.json();
      if (!data.token) {
        setStatus("ERROR");
        return;
      }
      setToken(data.token);
      setStatus("PENDING");
      setSecondsLeft(data.ttlSeconds || 90);
    } catch {
      setStatus("ERROR");
    }
  }, []);

  useEffect(() => {
    createNewQr();
  }, [createNewQr]);

  // ─── Polling статуса ───────────────────────────────────────────────
  useEffect(() => {
    if (!token || status === "loading" || status === "ERROR") return;
    if (["EXPIRED", "CANCELLED", "APPROVED"].includes(status)) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr/status?token=${token}`);
        const data = await res.json();
        if (data.status && data.status !== status) {
          setStatus(data.status as QrStatus);
        }
      } catch {
        /* ignore — переждём */
      }
    }, 2000);

    return () => clearInterval(id);
  }, [token, status]);

  // ─── Обратный отсчёт ───────────────────────────────────────────────
  useEffect(() => {
    if (status !== "PENDING" && status !== "SCANNED") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // ─── При APPROVED — финализируем сессию ────────────────────────────
  useEffect(() => {
    if (status !== "APPROVED" || !token || signingIn) return;

    setSigningIn(true);
    (async () => {
      const res = await signIn("qr", { token, redirect: false });
      if (res?.ok) {
        router.push("/chats");
        router.refresh();
      } else {
        setStatus("ERROR");
      }
    })();
  }, [status, token, signingIn, router]);

  // ─── Анимации ───────────────────────────────────────────────────────
  useGSAP(
    () => {
      gsap.from(".qr-title", {
        yPercent: 80,
        opacity: 0,
        duration: 1,
        ease: "expo.out",
        delay: 0.1,
      });
      gsap.from(".qr-card", {
        opacity: 0,
        scale: 0.95,
        y: 20,
        duration: 0.9,
        ease: "expo.out",
        delay: 0.3,
      });
      gsap.from(".qr-step", {
        opacity: 0,
        x: -20,
        stagger: 0.1,
        duration: 0.7,
        ease: "expo.out",
        delay: 0.5,
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Шум */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }}
      />

      {/* Блобы */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-violet-600/20 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full bg-violet-700/15 blur-[140px] pointer-events-none" />

      {/* Шапка */}
      <header className="relative z-10 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">
            talky
          </Link>
          <Link
            href="/sign-in"
            className="flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Войти по паролю
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl w-full items-center">
          {/* ─── Левая часть: QR + статус ────────────────────── */}
          <div className="qr-card relative">
            <div
              className="relative rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] p-8 md:p-10 overflow-hidden"
              style={{
                boxShadow:
                  "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 0 60px -20px rgba(168,85,247,0.4)",
              }}
            >
              {/* Уголки рамки сканера */}
              <Corner pos="tl" />
              <Corner pos="tr" />
              <Corner pos="bl" />
              <Corner pos="br" />

              <QrSlot
                token={token}
                status={status}
                secondsLeft={secondsLeft}
                onRefresh={createNewQr}
              />
            </div>
          </div>

          {/* ─── Правая часть: инструкция ─────────────────────── */}
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-violet-400 mb-4">
              / qr login
            </div>
            <h1 className="qr-title font-black tracking-tighter leading-[0.95] text-4xl md:text-6xl mb-6">
              <span className="block overflow-hidden">
                <span className="block">войти</span>
              </span>
              <span className="block overflow-hidden">
                <span className="block text-violet-500">через qr</span>
              </span>
            </h1>
            <p className="text-white/55 text-base md:text-lg mb-10 max-w-md leading-relaxed">
              Отсканируйте QR-код из приложения Talky на телефоне — войдёте в
              веб-версию без пароля.
            </p>

            <div className="space-y-4">
              <Step n="1" icon={<Smartphone size={16} />}>
                Откройте Talky на телефоне
              </Step>
              <Step n="2" icon={<ShieldCheck size={16} />}>
                Перейдите в <b className="text-white">Настройки</b> →{" "}
                <b className="text-white">Устройства</b>
              </Step>
              <Step n="3" icon={<ScanLine size={16} />}>
                Нажмите <b className="text-white">Сканировать QR</b> и наведите камеру
              </Step>
            </div>

            <div className="mt-10 inline-flex items-center gap-2 text-xs text-white/35 uppercase tracking-[0.2em]">
              <ShieldCheck size={12} />
              соединение зашифровано
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Слот для QR / статусов ───────────────────────────────────────

function QrSlot({
  token,
  status,
  secondsLeft,
  onRefresh,
}: {
  token: string | null;
  status: QrStatus;
  secondsLeft: number;
  onRefresh: () => void;
}) {
  const isActive = status === "PENDING" || status === "SCANNED";
  const expired = status === "EXPIRED" || (isActive && secondsLeft <= 0);

  if (status === "loading") {
    return (
      <div className="aspect-square grid place-items-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (status === "ERROR") {
    return (
      <div className="aspect-square grid place-items-center text-center px-6">
        <div>
          <XCircle size={40} className="text-red-400 mx-auto mb-3" />
          <div className="text-base font-semibold text-white mb-1">Ошибка</div>
          <p className="text-sm text-white/55 mb-5">Не удалось создать QR-код</p>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} /> Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <div className="aspect-square grid place-items-center text-center px-6">
        <div>
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl" />
            <CheckCircle2 size={56} className="relative text-emerald-400" />
          </div>
          <div className="text-lg font-semibold text-white mb-1">Подтверждено</div>
          <p className="text-sm text-white/55 flex items-center justify-center gap-2">
            <Loader2 size={12} className="animate-spin" /> Входим в аккаунт...
          </p>
        </div>
      </div>
    );
  }

  if (expired || status === "CANCELLED") {
    return (
      <div className="aspect-square grid place-items-center text-center px-6">
        <div>
          <XCircle size={40} className="text-white/30 mx-auto mb-3" />
          <div className="text-base font-semibold text-white mb-1">
            {status === "CANCELLED" ? "Вход отменён" : "QR-код просрочен"}
          </div>
          <p className="text-sm text-white/55 mb-5">
            {status === "CANCELLED"
              ? "Вы отказались на телефоне"
              : "Создайте новый чтобы продолжить"}
          </p>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
          >
            <RefreshCw size={14} /> Новый QR-код
          </button>
        </div>
      </div>
    );
  }

  // PENDING / SCANNED — показываем сам QR
  return (
    <div className="aspect-square flex flex-col items-center justify-between gap-4">
      {/* Сам QR */}
      <div className="relative flex-1 grid place-items-center w-full">
        <div className="relative bg-white p-4 rounded-2xl">
          {token && (
            <QRCodeSVG
              value={token}
              size={240}
              level="H"
              marginSize={0}
              imageSettings={{
                src: "/images/icon.png",
                height: 48,
                width: 48,
                excavate: true,
              }}
            />
          )}

          {/* Эффект "сканирования" — анимация поверх QR */}
          {status === "PENDING" && (
            <div className="absolute inset-4 overflow-hidden rounded-xl pointer-events-none">
              <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/80 to-transparent shadow-[0_0_12px_rgba(168,85,247,0.8)] qr-scan-line" />
            </div>
          )}

          {status === "SCANNED" && (
            <div className="absolute inset-0 rounded-2xl bg-violet-500/10 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto mb-2" />
                <div className="text-sm font-medium text-violet-700">
                  Подтвердите на телефоне
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Таймер + refresh */}
      <div className="w-full flex items-center justify-between text-xs">
        <div
          className={`font-mono tabular-nums tracking-wide ${
            secondsLeft <= 15 ? "text-amber-400" : "text-white/45"
          }`}
        >
          ⌛ {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
          {String(secondsLeft % 60).padStart(2, "0")}
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-white/45 hover:text-white transition-colors"
          title="Обновить QR"
        >
          <RefreshCw size={13} /> Обновить
        </button>
      </div>

      <style jsx>{`
        @keyframes qr-scan {
          0%   { top: 0; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .qr-scan-line {
          animation: qr-scan 2.4s linear infinite;
        }
      `}</style>
    </div>
  );
}

// ─── Декоративные уголки рамки ─────────────────────────────────────

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const positions: Record<string, string> = {
    tl: "top-3 left-3 border-l-2 border-t-2 rounded-tl-xl",
    tr: "top-3 right-3 border-r-2 border-t-2 rounded-tr-xl",
    bl: "bottom-3 left-3 border-l-2 border-b-2 rounded-bl-xl",
    br: "bottom-3 right-3 border-r-2 border-b-2 rounded-br-xl",
  };
  return (
    <div
      className={`absolute w-6 h-6 border-violet-500/40 pointer-events-none ${positions[pos]}`}
    />
  );
}

// ─── Шаг инструкции ─────────────────────────────────────────────────

function Step({ n, icon, children }: { n: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="qr-step flex items-start gap-4">
      <div className="shrink-0 w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] grid place-items-center">
        <span className="text-xs font-mono text-violet-400">{n}</span>
      </div>
      <div className="flex-1 pt-1.5 flex items-center gap-2 text-sm text-white/70">
        <span className="text-white/40">{icon}</span>
        <span>{children}</span>
      </div>
    </div>
  );
}
