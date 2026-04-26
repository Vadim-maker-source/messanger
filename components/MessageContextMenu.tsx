// components/MessageContextMenu.tsx
"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reply, Forward, Edit, Trash2, Smile, Copy, Pin, Flag } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  message: any;
  isOwn: boolean;
  canDelete: boolean;
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: () => void;
  onCopy: () => void;
}

export default function MessageContextMenu({
  x,
  y,
  message,
  isOwn,
  canDelete,
  onClose,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReact,
  onCopy
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [onClose]);

  // Адаптируем позицию, чтобы меню не выходило за экран
  let adjustedX = x;
  let adjustedY = y;

  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
      adjustedX = window.innerWidth - rect.width - 10;
    }
    if (y + rect.height > window.innerHeight) {
      adjustedY = window.innerHeight - rect.height - 10;
    }
  }

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{ position: "fixed", top: adjustedY, left: adjustedX, zIndex: 1000 }}
      className="bg-[#1e1e22] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[200px]"
    >
      <div className="py-1">
        <button
          onClick={() => { onReply(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white"
        >
          <Reply size={16} className="text-orange-400" />
          Ответить
        </button>
        <button
          onClick={() => { onForward(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white"
        >
          <Forward size={16} className="text-blue-400" />
          Переслать
        </button>
        <button
          onClick={() => { onReact(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white"
        >
          <Smile size={16} className="text-yellow-400" />
          Реакция
        </button>
        <button
          onClick={() => { onCopy(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white"
        >
          <Copy size={16} className="text-green-400" />
          Копировать текст
        </button>
        {isOwn && (
          <button
            onClick={() => { onEdit(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white"
          >
            <Edit size={16} className="text-purple-400" />
            Редактировать
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 transition-colors text-sm text-red-400"
          >
            <Trash2 size={16} />
            Удалить
          </button>
        )}
        <div className="border-t border-white/10 my-1" />
        <button
          onClick={() => { onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white/60"
        >
          <Flag size={16} />
          Пожаловаться
        </button>
      </div>
    </motion.div>
  );
}