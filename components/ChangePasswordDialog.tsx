"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check, Eye, EyeOff, Bell, Mail, ArrowLeft } from "lucide-react";
import Image from "next/image";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "form" | "choose-method" | "verify" | "new-password" | "success";
type DeliveryMethod = "push" | "email";

export default function ChangePasswordDialog({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [method, setMethod] = useState<DeliveryMethod>("push");
  const [deliveredTo, setDeliveredTo] = useState("");

  const [generatedCode, setGeneratedCode] = useState("");
  const [enteredCode, setEnteredCode] = useState(["", "", "", "", "", ""]);
  const [resendIn, setResendIn] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("form");
        setOldPassword(""); setNewPassword(""); setConfirmPassword("");
        setEnteredCode(["", "", "", "", "", ""]);
        setError(""); setGeneratedCode(""); setResendIn(0);
        setForgotMode(false); setMethod("push"); setDeliveredTo("");
      }, 250);
    }
  }, [open]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  const sendCode = async (code: string, isForgot: boolean, methodOverride?: DeliveryMethod) => {
    const r = await fetch("/api/auth/send-2fa-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        action: isForgot ? "reset-password" : "change-password",
        method: methodOverride || method,
      }),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok && data.success, deliveredTo: data.deliveredTo as string | undefined };
  };

  // Обычный поток: заполнили старый+новый → шлём код через push
  const handleStartVerify = async () => {
    setError("");
    if (!oldPassword) return setError("Введите текущий пароль");
    if (newPassword.length < 6) return setError("Новый пароль должен быть не короче 6 символов");
    if (newPassword !== confirmPassword) return setError("Пароли не совпадают");
    if (newPassword === oldPassword) return setError("Новый пароль должен отличаться от старого");

    setLoading(true);
    const code = generateCode();
    setGeneratedCode(code);
    const { ok } = await sendCode(code, false, "push");
    setLoading(false);

    if (!ok) return setError("Не удалось отправить код");
    setStep("verify");
    setResendIn(60);
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  // Забыли пароль: переходим к выбору способа
  const handleForgot = () => {
    setError("");
    setForgotMode(true);
    setStep("choose-method");
  };

  // Выбор способа доставки в режиме "забыли пароль"
  const handleChooseMethod = async (m: DeliveryMethod) => {
    setMethod(m);
    setLoading(true);
    setError("");
    const code = generateCode();
    setGeneratedCode(code);
    const { ok, deliveredTo: to } = await sendCode(code, true, m);
    setLoading(false);

    if (!ok) {
      setError(m === "email" ? "Не удалось отправить письмо" : "Не удалось отправить код");
      return;
    }
    if (to) setDeliveredTo(to);
    setStep("verify");
    setResendIn(60);
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setLoading(true);
    const code = generateCode();
    setGeneratedCode(code);
    const { ok, deliveredTo: to } = await sendCode(code, forgotMode);
    setEnteredCode(["", "", "", "", "", ""]);
    setLoading(false);
    if (ok) {
      if (to) setDeliveredTo(to);
      setResendIn(60);
      inputRefs.current[0]?.focus();
    }
  };

  const handleCodeChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...enteredCode];
    next[idx] = val;
    setEnteredCode(next);
    setError("");
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (next.every(c => c) && next.join("").length === 6) {
      verifyCode(next.join(""));
    }
  };

  const handleCodeKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !enteredCode[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = pasted.split("").concat(Array(6 - pasted.length).fill(""));
    setEnteredCode(next);
    if (pasted.length === 6) verifyCode(pasted);
    else inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const verifyCode = async (code: string) => {
    if (code !== generatedCode) {
      setError("Неверный код");
      setEnteredCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      return;
    }
    if (forgotMode) {
      setStep("new-password");
      setError("");
      return;
    }
    await doChangePassword(oldPassword, newPassword);
  };

  const doChangePassword = async (oldPwd: string, newPwd: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd, forgot: forgotMode }),
      });
      const data = await r.json();
      if (!data.success) setError(data.error || "Ошибка смены пароля");
      else {
        setStep("success");
        setTimeout(() => onClose(), 2000);
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitNewPassword = async () => {
    setError("");
    if (newPassword.length < 6) return setError("Пароль должен быть не короче 6 символов");
    if (newPassword !== confirmPassword) return setError("Пароли не совпадают");
    await doChangePassword("", newPassword);
  };

  const handleBack = () => {
    setError("");
    if (step === "verify") {
      setStep(forgotMode ? "choose-method" : "form");
    } else if (step === "choose-method" || step === "new-password") {
      setStep("form");
      if (step === "choose-method") setForgotMode(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
          className="relative w-full max-w-md bg-[#16161b] rounded-3xl overflow-hidden"
        >
          {/* Top bar with lock illustration */}
          <div className="relative h-44 bg-[#1c1c24] overflow-hidden">
            {/* Soft radial glow behind the lock */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(124,58,237,0.18),transparent_60%)]" />

            {/* Decorative dots pattern */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>

            {/* 3D Lock image */}
            <motion.div
              key={step}
              initial={{ y: 8, opacity: 0, rotate: -6 }}
              animate={{ y: [0, -6, 0], opacity: 1, rotate: 0 }}
              transition={{
                opacity: { duration: 0.4 },
                rotate: { duration: 0.4 },
                y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
              }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32"
              style={{ filter: "drop-shadow(0 18px 30px rgba(124,58,237,0.35))" }}
            >
              <Image
                src="/images/3dlock.png"
                alt=""
                fill
                className="object-contain"
                priority
              />
            </motion.div>

            {/* Top controls */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <div className="w-9">
                {(step === "verify" || step === "choose-method" || step === "new-password") && (
                  <button onClick={handleBack}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors text-white/60 hover:text-white backdrop-blur-sm">
                    <ArrowLeft size={16} />
                  </button>
                )}
              </div>
              <button onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors text-white/60 hover:text-white backdrop-blur-sm">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-7 pt-6 pb-7">
            <AnimatePresence mode="wait">
              {step === "form" && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-semibold text-white tracking-tight">Сменить пароль</h2>
                    <p className="text-sm text-white/50">Введите текущий и новый пароль</p>
                  </div>

                  <div className="space-y-3">
                    <PasswordField label="Текущий пароль" value={oldPassword} onChange={setOldPassword} show={showOld} onToggle={() => setShowOld(!showOld)} />
                    <PasswordField label="Новый пароль" value={newPassword} onChange={setNewPassword} show={showNew} onToggle={() => setShowNew(!showNew)} />
                    <PasswordField label="Повторите новый пароль" value={confirmPassword} onChange={setConfirmPassword} show={showNew} onToggle={() => setShowNew(!showNew)} />
                  </div>

                  {error && <ErrorBox text={error} />}

                  <button
                    onClick={handleStartVerify}
                    disabled={loading}
                    className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 rounded-2xl font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Продолжить"}
                  </button>

                  <button
                    onClick={handleForgot}
                    disabled={loading}
                    className="w-full text-sm text-white/50 hover:text-white/80 transition-colors disabled:opacity-50"
                  >
                    Забыли пароль?
                  </button>
                </motion.div>
              )}

              {step === "choose-method" && (
                <motion.div
                  key="choose"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-semibold text-white tracking-tight">Восстановление пароля</h2>
                    <p className="text-sm text-white/50">Куда отправить код подтверждения?</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MethodCard
                      icon={<Bell size={24} />}
                      title="Push"
                      subtitle="В приложение"
                      onClick={() => handleChooseMethod("push")}
                      disabled={loading}
                    />
                    <MethodCard
                      icon={<Mail size={24} />}
                      title="Email"
                      subtitle="На вашу почту"
                      onClick={() => handleChooseMethod("email")}
                      disabled={loading}
                    />
                  </div>

                  {loading && (
                    <div className="flex justify-center pt-2">
                      <Loader2 size={20} className="animate-spin text-white/40" />
                    </div>
                  )}

                  {error && <ErrorBox text={error} />}
                </motion.div>
              )}

              {step === "verify" && (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-semibold text-white tracking-tight">Введите код</h2>
                    <p className="text-sm text-white/50">
                      {forgotMode && method === "email"
                        ? <>Код отправлен на <span className="text-white/80">{deliveredTo || "вашу почту"}</span></>
                        : "6-значный код в push-уведомлении"}
                    </p>
                  </div>

                  <div className="flex justify-between gap-2">
                    {enteredCode.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={el => { inputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleCodeChange(idx, e.target.value)}
                        onKeyDown={e => handleCodeKey(idx, e)}
                        onPaste={handlePaste}
                        className={`w-12 h-14 text-center text-2xl font-semibold bg-[#1f1f26] rounded-2xl text-white outline-none transition-all ${
                          error
                            ? "ring-1 ring-red-500/50"
                            : digit
                              ? "ring-1 ring-violet-500/50 bg-violet-500/5"
                              : "focus:ring-1 focus:ring-white/20"
                        }`}
                      />
                    ))}
                  </div>

                  {error && <p className="text-sm text-center text-red-400">{error}</p>}

                  <div className="flex flex-col items-center gap-1.5 pt-1">
                    <button
                      onClick={handleResend}
                      disabled={resendIn > 0 || loading}
                      className="text-sm text-violet-400 hover:text-violet-300 transition-colors disabled:text-white/30 disabled:cursor-not-allowed"
                    >
                      {resendIn > 0 ? `Повторно через ${resendIn} с` : "Отправить код повторно"}
                    </button>
                  </div>

                  {loading && (
                    <div className="flex justify-center">
                      <Loader2 size={18} className="animate-spin text-white/40" />
                    </div>
                  )}
                </motion.div>
              )}

              {step === "new-password" && (
                <motion.div
                  key="new-password"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-semibold text-white tracking-tight">Новый пароль</h2>
                    <p className="text-sm text-white/50">Придумайте новый пароль для аккаунта</p>
                  </div>

                  <div className="space-y-3">
                    <PasswordField label="Новый пароль" value={newPassword} onChange={setNewPassword} show={showNew} onToggle={() => setShowNew(!showNew)} />
                    <PasswordField label="Повторите пароль" value={confirmPassword} onChange={setConfirmPassword} show={showNew} onToggle={() => setShowNew(!showNew)} />
                  </div>

                  {error && <ErrorBox text={error} />}

                  <button
                    onClick={handleSubmitNewPassword}
                    disabled={loading}
                    className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 rounded-2xl font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Сохранить пароль"}
                  </button>
                </motion.div>
              )}

              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center text-center py-4"
                >
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="w-14 h-14 rounded-full bg-violet-600 flex items-center justify-center mb-4"
                  >
                    <Check size={26} className="text-white" strokeWidth={3} />
                  </motion.div>
                  <h2 className="text-xl font-semibold text-white">Пароль обновлён</h2>
                  <p className="text-sm text-white/50 mt-1">Можете использовать новый пароль</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/50 ml-1.5">{label}</label>
      <div className="relative group">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-4 pr-11 py-3 bg-[#1f1f26] rounded-2xl text-white text-sm outline-none focus:ring-1 focus:ring-violet-500/40 transition-all"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function MethodCard({ icon, title, subtitle, onClick, disabled }: {
  icon: React.ReactNode; title: string; subtitle: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative flex flex-col items-center gap-2 py-6 px-4 bg-[#1f1f26] rounded-2xl transition-all hover:bg-[#252530] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="w-12 h-12 rounded-2xl bg-violet-500/10 group-hover:bg-violet-500/20 flex items-center justify-center text-violet-400 transition-colors">
        {icon}
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="text-xs text-white/40 mt-0.5">{subtitle}</div>
      </div>
    </button>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className="text-sm text-red-400 bg-red-500/8 rounded-xl px-4 py-2.5 text-center"
    >
      {text}
    </motion.div>
  );
}
