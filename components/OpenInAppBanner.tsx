"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone } from "lucide-react";

interface Props {
  /** Полный URL текущей страницы (например /invite/abc123 или /profile/xxx). */
  path: string;
}

const STORAGE_KEY = "openInAppDismissedAt";
const DISMISS_HOURS = 6; // не показывать снова в течение 6 часов после закрытия

/**
 * Баннер для мобильных пользователей, предлагающий открыть страницу в Flutter-
 * приложении через custom URL scheme `talky://`.
 *
 * Логика:
 *   • Показывается только на мобильных устройствах (Android/iOS).
 *   • Скрывается, если пользователь его недавно закрыл.
 *   • Кнопка «Открыть» переключает на talky://invite/{code} или
 *     talky://profile/{userId}, в зависимости от path.
 */
export default function OpenInAppBanner({ path }: Props) {
  const [visible, setVisible] = useState(false);
  const [appUrl, setAppUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Только на мобильных
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Не показывать если недавно закрыли
    try {
      const dismissedAt = localStorage.getItem(STORAGE_KEY);
      if (dismissedAt) {
        const hoursAgo = (Date.now() - parseInt(dismissedAt, 10)) / 3600000;
        if (hoursAgo < DISMISS_HOURS) return;
      }
    } catch {}

    // Конвертируем path → custom scheme
    const inviteMatch = path.match(/^\/invite\/(.+)$/);
    const profileMatch = path.match(/^\/profile\/(.+)$/);

    if (inviteMatch) setAppUrl(`talky://invite/${inviteMatch[1]}`);
    else if (profileMatch) setAppUrl(`talky://profile/${profileMatch[1]}`);
    else return;

    setVisible(true);
  }, [path]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {}
  };

  const handleOpen = () => {
    if (!appUrl) return;
    window.location.href = appUrl;
  };

  if (!appUrl) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto"
        >
          <div className="bg-[#16161b] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-500/15 flex items-center justify-center shrink-0">
              <Smartphone size={20} className="text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Открыть в приложении</p>
              <p className="text-xs text-white/50">Удобнее в Talky</p>
            </div>
            <button
              onClick={handleOpen}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-medium text-white transition-colors"
            >
              Открыть
            </button>
            <button
              onClick={handleDismiss}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
