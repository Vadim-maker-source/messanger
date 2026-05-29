"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  User,
  AtSign,
  Mail,
  Lock,
  ArrowRight,
  ChevronLeft,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { registerUser } from "@/app/lib/api/user";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

const STEPS = [
  { n: 1, label: "Никнейм" },
  { n: 2, label: "Имя" },
  { n: 3, label: "Email" },
  { n: 4, label: "Пароль" },
] as const;

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
  });

  useGSAP(
    () => {
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

  const nextStep = () => { setError(""); setStep((p) => p + 1); };
  const prevStep = () => { setError(""); setStep((p) => p - 1); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await registerUser(formData);
      if (res.success) {
        const loginRes = await signIn("credentials", {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });
        if (loginRes?.error) {
          setError("Ошибка при автоматическом входе");
        } else {
          // Если мы на vercel-домене — это «pre-registration» режим:
          // редиректим на страницу благодарности.
          // На основном сервере — направляем на главную (где доступен чат).
          const isVercel =
            typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app");
          router.push(isVercel ? "/welcome" : "/");
        }
      }
    } catch (err: any) {
      setError(err.message || "Что-то пошло не так");
    } finally {
      setLoading(false);
    }
  };

  const variants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
  };

  const stepInfo = STEPS[step - 1];

  return (
    <div ref={root} className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
      {/* Шум */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }}
      />

      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-violet-600/20 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full bg-violet-700/15 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-xl bg-violet-500 grid place-items-center transition-transform group-hover:scale-105">
              <span className="text-black font-black text-lg leading-none">t</span>
            </div>
            <span className="font-bold text-lg tracking-tight">talky</span>
          </Link>
          <Link href="/" className="text-sm text-white/50 hover:text-white transition-colors">
            ← На главную
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Левая колонка */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-violet-400 mb-6">
              / регистрация
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
              Создай аккаунт за минуту — и общайся в любимом мессенджере без ограничений.
            </p>

            {/* Чекпойнты */}
            <div className="hidden lg:block space-y-3">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className={`flex items-center gap-3 transition-all ${
                    s.n === step
                      ? "text-white"
                      : s.n < step
                        ? "text-emerald-400"
                        : "text-white/30"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold transition-colors ${
                      s.n === step
                        ? "bg-violet-500 text-white"
                        : s.n < step
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-white/[0.04] text-white/30"
                    }`}
                  >
                    {s.n < step ? "✓" : s.n}
                  </div>
                  <span className="text-sm">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Правая — форма */}
          <div className="order-1 lg:order-2 w-full max-w-md mx-auto lg:max-w-none">
            <div className="relative">
              <div className="relative rounded-[28px] border border-white/[0.06] bg-[rgba(14,14,20,0.85)] backdrop-blur-xl p-7 md:p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                {/* Шапка карточки + прогресс */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Создать аккаунт</h2>
                    <p className="text-xs text-white/40 mt-0.5">
                      Шаг {step} из {STEPS.length} — {stepInfo.label}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-violet-500/10 grid place-items-center text-violet-300">
                    <User size={18} />
                  </div>
                </div>

                {/* Прогресс-бар */}
                <div className="flex gap-1.5 mb-7">
                  {STEPS.map((s) => (
                    <div
                      key={s.n}
                      className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                        s.n <= step ? "bg-violet-500" : "bg-white/[0.06]"
                      }`}
                    />
                  ))}
                </div>

                <form onSubmit={(e) => e.preventDefault()}>
                  <AnimatePresence mode="wait">
                    {step === 1 && (
                      <motion.div
                        key="step1"
                        initial={variants.initial}
                        animate={variants.animate}
                        exit={variants.exit}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                      >
                        <Field
                          icon={AtSign}
                          label="Никнейм"
                          placeholder="username"
                          value={formData.username}
                          onChange={(v) => setFormData({ ...formData, username: v.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                          autoFocus
                          hint="3–32 символа: латиница, цифры, _"
                        />
                        <NavRow
                          onNext={nextStep}
                          nextDisabled={formData.username.length < 3}
                        />
                      </motion.div>
                    )}

                    {step === 2 && (
                      <motion.div
                        key="step2"
                        initial={variants.initial}
                        animate={variants.animate}
                        exit={variants.exit}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                      >
                        <Field
                          icon={User}
                          label="Отображаемое имя"
                          placeholder="Иван Иванов"
                          value={formData.displayName}
                          onChange={(v) => setFormData({ ...formData, displayName: v })}
                          autoFocus
                          hint="Так вас увидят в чатах"
                        />
                        <NavRow
                          onPrev={prevStep}
                          onNext={nextStep}
                          nextDisabled={!formData.displayName.trim()}
                        />
                      </motion.div>
                    )}

                    {step === 3 && (
                      <motion.div
                        key="step3"
                        initial={variants.initial}
                        animate={variants.animate}
                        exit={variants.exit}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                      >
                        <Field
                          icon={Mail}
                          type="email"
                          label="Email"
                          placeholder="example@mail.com"
                          value={formData.email}
                          onChange={(v) => setFormData({ ...formData, email: v })}
                          autoFocus
                          hint="Понадобится для восстановления пароля"
                        />
                        <NavRow
                          onPrev={prevStep}
                          onNext={nextStep}
                          nextDisabled={!formData.email.includes("@")}
                        />
                      </motion.div>
                    )}

                    {step === 4 && (
                      <motion.div
                        key="step4"
                        initial={variants.initial}
                        animate={variants.animate}
                        exit={variants.exit}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                      >
                        <div>
                          <label className="block mb-2 ml-1 text-xs font-medium text-white/50 uppercase tracking-wider">
                            Пароль
                          </label>
                          <div className="relative">
                            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
                            <input
                              type={showPwd ? "text" : "password"}
                              autoFocus
                              placeholder="••••••••"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-3.5 pl-11 pr-12 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:bg-white/[0.05] outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPwd(!showPwd)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-white/35 hover:text-white/70 transition-colors"
                            >
                              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          <p className="mt-2 ml-1 text-xs text-white/40">
                            Минимум 6 символов
                          </p>
                        </div>

                        {error && (
                          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                          </div>
                        )}

                        <NavRow
                          onPrev={prevStep}
                          onSubmit={handleSubmit}
                          submitLabel={loading ? null : "Создать аккаунт →"}
                          loading={loading}
                          submitDisabled={formData.password.length < 6}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>

                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-xs text-white/30 uppercase tracking-wider">или</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                <Link
                  href="/sign-in"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-sm font-medium transition-colors"
                >
                  Уже есть аккаунт? Войти
                </Link>
              </div>
            </div>

            <div className="text-center mt-6 text-xs text-white/30 uppercase tracking-[0.2em]">
              secure · v1.0
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoFocus,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block mb-2 ml-1 text-xs font-medium text-white/50 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
        <input
          type={type}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:bg-white/[0.05] outline-none transition-all"
        />
      </div>
      {hint && <p className="mt-2 ml-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

function NavRow({
  onPrev,
  onNext,
  onSubmit,
  nextDisabled,
  submitDisabled,
  submitLabel,
  loading,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  nextDisabled?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string | null;
  loading?: boolean;
}) {
  return (
    <div className="flex gap-3 pt-1">
      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="w-12 h-12 grid place-items-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/70 hover:text-white transition-colors"
          aria-label="Назад"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex-1 group relative overflow-hidden rounded-xl bg-violet-500 hover:bg-violet-400 active:bg-violet-600 disabled:bg-white/[0.04] disabled:text-white/30 py-3.5 font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
        >
          Далее <ArrowRight size={16} />
        </button>
      )}
      {onSubmit && (
        <button
          type="submit"
          onClick={onSubmit}
          disabled={submitDisabled || loading}
          className="flex-1 group relative overflow-hidden rounded-xl bg-violet-500 hover:bg-violet-400 active:bg-violet-600 disabled:bg-white/[0.04] disabled:text-white/30 py-3.5 font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : submitLabel}
        </button>
      )}
    </div>
  );
}
