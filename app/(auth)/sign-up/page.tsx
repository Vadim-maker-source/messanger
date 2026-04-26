"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { 
  User, 
  AtSign, 
  Mail, 
  Lock, 
  ArrowRight, 
  ChevronLeft, 
  Loader2,
  CheckCircle2
} from "lucide-react";
import { registerUser } from "@/app/lib/api/user";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const [formData, setFormData] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
  });

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

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
          router.push("/");
        }
      }
    } catch (err: any) {
      setError(err.message || "Что-то пошло не так");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const variants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    // ИСПРАВЛЕНО: min-height-screen -> min-h-screen
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white p-4">
      {/* Фон с градиентом */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-violet-900/20 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md bg-[#121214] border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Индикатор прогресса */}
        <div className="flex gap-2 mb-6 sm:mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                s <= step ? "bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <div key="step1" {...variants} className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">Как тебя звать?</h1>
                  <p className="text-white/50 text-sm sm:text-base">Придумай уникальный никнейм</p>
                </div>
                <div className="relative">
                  <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500 w-5 h-5" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="username"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase()})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                  />
                </div>
                <button 
                  disabled={!formData.username}
                  onClick={nextStep}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:hover:bg-violet-600 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  Далее <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div key="step2" {...variants} className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">Твое имя</h1>
                  <p className="text-white/50 text-sm sm:text-base">Как тебя будут видеть друзья</p>
                </div>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500 w-5 h-5" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Имя или ник"
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base focus:border-violet-500 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={prevStep} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    disabled={!formData.displayName}
                    onClick={nextStep}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    Далее <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div key="step3" {...variants} className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">Почта</h1>
                  <p className="text-white/50 text-sm sm:text-base">Для защиты твоего аккаунта</p>
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500 w-5 h-5" />
                  <input
                    autoFocus
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base focus:border-violet-500 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={prevStep} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    disabled={!formData.email.includes('@')}
                    onClick={nextStep}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    Далее <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div key="step4" {...variants} className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">Пароль</h1>
                  <p className="text-white/50 text-sm sm:text-base">Придумай что-нибудь надежное</p>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500 w-5 h-5" />
                  <input
                    autoFocus
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base focus:border-violet-500 outline-none transition-all"
                  />
                </div>
                {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-xl">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={prevStep} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    disabled={formData.password.length < 6 || loading}
                    onClick={handleSubmit}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20"
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Создать аккаунт <CheckCircle2 className="w-5 h-5" /></>}
                  </button>
                </div>
              </div>
            )}
          </AnimatePresence>
        </form>

        <p className="mt-8 text-center text-sm text-white/30">
          Уже есть аккаунт? <a href="/sign-in" className="text-violet-400 hover:text-violet-300 underline underline-offset-4">Войти</a>
        </p>
      </div>
    </div>
  );
}