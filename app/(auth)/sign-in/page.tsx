"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Loader2, AlertCircle, Mail, Lock, Eye, EyeOff } from "lucide-react";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Только анимация Talky и волнистой линии
      gsap.from(".login-talky", {
        yPercent: 80,
        opacity: 0,
        duration: 1,
        ease: "expo.out",
        delay: 0.1,
      });

      const wavyPath = document.querySelector(".login-wave") as SVGPathElement | null;
      if (wavyPath) {
        const len = wavyPath.getTotalLength();
        wavyPath.style.strokeDasharray = `${len}`;
        wavyPath.style.strokeDashoffset = `${len}`;
        gsap.to(wavyPath, {
          strokeDashoffset: 0,
          duration: 1.4,
          ease: "expo.out",
          delay: 0.5,
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
    },
    { scope: root }
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Неверный email или пароль");
      } else if (res?.ok) {
        router.push("/chats");
        router.refresh();
      } else {
        setError("Не удалось войти");
      }
    } catch {
      setError("Произошла ошибка при входе");
    } finally {
      setLoading(false);
    }
  };

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
      <div className="absolute bottom-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full bg-violet-700/15 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />

      {/* Шапка */}
      <header className="relative z-10 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <span className="font-bold text-lg tracking-tight">talky</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            ← На главную
          </Link>
        </div>
      </header>

      {/* Контент */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Левая колонка — крупный Talky + manifesto */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-violet-400 mb-6">
              / вход
            </div>
            <h1 className="font-black tracking-tighter leading-[0.95] text-6xl md:text-7xl lg:text-8xl mb-6">
              <span className="relative inline-block">
                <span className="login-talky inline-block">Talky</span>
                <svg
                  viewBox="0 0 600 60"
                  preserveAspectRatio="none"
                  className="absolute left-0 right-0 -bottom-[0.18em] w-full h-[0.28em]"
                  fill="none"
                >
                  <path
                    className="login-wave"
                    d="M 8 38 Q 60 8, 120 30 T 240 30 T 360 30 T 480 30 T 592 30"
                    stroke="#22D3A0"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="text-white/55 text-base md:text-lg max-w-md mx-auto lg:mx-0 mb-8">
              С возвращением. Войди и продолжим общение в любимом мессенджере.
            </p>
          </div>

          {/* Правая колонка — форма */}
          <div className="order-1 lg:order-2 w-full max-w-md mx-auto lg:max-w-none">
            <div className="login-card relative">
              <form
                onSubmit={handleLogin}
                className="relative rounded-[28px] border border-white/[0.06] bg-[rgba(14,14,20,0.85)] backdrop-blur-xl p-7 md:p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
              >
                <div className="flex items-center justify-between mb-7">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Войти в аккаунт</h2>
                    <p className="text-xs text-white/40 mt-0.5">Введите email и пароль</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-violet-500/10 grid place-items-center text-violet-300">
                    <Lock size={18} />
                  </div>
                </div>

                {error && (
                  <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <Field
                    icon={Mail}
                    label="Email"
                    type="email"
                    placeholder="example@mail.com"
                    value={email}
                    onChange={setEmail}
                    required
                  />

                  <div>
                    <div className="flex items-center justify-between mb-2 ml-1">
                      <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                        Пароль
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        Забыли?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
                      <input
                        type={showPwd ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-3.5 pl-11 pr-12 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:bg-white/[0.05] outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-white/35 hover:text-white/70 transition-colors"
                        aria-label={showPwd ? "Скрыть пароль" : "Показать пароль"}
                      >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative mt-7 w-full overflow-hidden rounded-xl bg-violet-500 hover:bg-violet-400 active:bg-violet-600 disabled:opacity-50 py-3.5 font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Вход...
                      </>
                    ) : (
                      <>Войти →</>
                    )}
                  </span>
                </button>

                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-xs text-white/30 uppercase tracking-wider">или</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                <Link
                  href="/sign-up"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-sm font-medium transition-colors"
                >
                  Создать аккаунт
                </Link>
              </form>
            </div>

            <div className="text-center mt-6 text-xs text-white/30 uppercase tracking-[0.2em]">
              secure · v1.0
            </div>
          </div>
        </div>
      </main>

      <ChangePasswordDialog
        open={showForgot}
        onClose={() => setShowForgot(false)}
        mode="guest"
        initialEmail={email}
      />
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-white/60 backdrop-blur-md">
      {children}
    </span>
  );
}

function Field({
  icon: Icon,
  label,
  type,
  placeholder,
  value,
  onChange,
  required = false,
  className = "",
}: {
  icon: React.ElementType;
  label: string;
  type: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block mb-2 ml-1 text-xs font-medium text-white/50 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
        <input
          type={type}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:bg-white/[0.05] outline-none transition-all"
        />
      </div>
    </div>
  );
}
