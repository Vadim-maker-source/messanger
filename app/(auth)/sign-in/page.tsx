"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError("");

  try {
    console.log("Attempting login with:", { email, password: "***" });
    
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    console.log("SignIn response:", res);

    if (res?.error) {
      console.error("Login error:", res.error);
      setError("Неверный email или пароль");
    } else if (res?.ok) {
      console.log("Login successful, redirecting...");
      router.push("/");
      router.refresh();
    } else {
      console.log("Unexpected response:", res);
      setError("Неизвестная ошибка");
    }
  } catch (err) {
    console.error("Exception during login:", err);
    setError("Произошла ошибка при входе");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#09090b] to-[#0c0c0e] text-white p-4 relative">
      {/* Эффекты свечения на фоне - упрощены для лучшей производительности */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-violet-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] left-[10%] w-[30%] h-[30%] bg-blue-600/10 blur-[100px] rounded-full" />
      </div>

      <div
        className="w-full max-w-md bg-[#121214]/95 backdrop-blur-sm border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10"
        style={{ backgroundColor: 'rgba(18, 18, 20, 0.95)' }} // fallback для старых браузеров
      >
        <div className="text-center mb-8 sm:mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600/30 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-violet-500/40 shadow-lg">
            <LogIn className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            С возвращением
          </h1>
          <p className="text-gray-400 mt-2 text-sm sm:text-base">
            Войди в свой аккаунт, чтобы продолжить общение
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 ml-1 block">
              Email
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
              <input
                type="email"
                required
                placeholder="example@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all duration-200"
                style={{ WebkitAppearance: 'none' }} // для iOS
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-300 ml-1 block">
                Пароль
              </label>
              <a href="#" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Забыли?
              </a>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all duration-200"
                style={{ WebkitAppearance: 'none' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-200 transform active:scale-[0.99] shadow-lg shadow-violet-500/25 mt-6"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Вход...</span>
              </>
            ) : (
              "Войти в мессенджер"
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          Нет аккаунта?{" "}
          <a 
            href="/sign-up" 
            className="text-violet-400 hover:text-violet-300 font-medium underline underline-offset-4 transition-colors"
          >
            Зарегистрироваться
          </a>
        </p>
      </div>
    </div>
  );
}