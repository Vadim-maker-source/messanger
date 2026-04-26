// components/VKCallModal.tsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, 
  X, Users, Copy, Check, ExternalLink
} from "lucide-react";
import { createVKCall, endVKCall, getVKCallInfo, joinVKCall } from "@/app/lib/api/calls";

interface VKCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  currentUserId: string;
  currentUserName: string;
  callType: "audio" | "video";
  isIncoming?: boolean;
  callerName?: string;
}

export default function VKCallModal({ 
  isOpen, 
  onClose, 
  chatId,
  currentUserId,
  currentUserName,
  callType,
  isIncoming = false,
  callerName
}: VKCallModalProps) {
  const [callId, setCallId] = useState<string | null>(null);
  const [joinLink, setJoinLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "connected" | "ended">("idle");
  const [participants, setParticipants] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Создание звонка
  const createCall = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await createVKCall(chatId, currentUserId, callType);
      setCallId(response.call_id);
      setJoinLink(response.join_link);
      setCallStatus("connecting");
      
      // Открываем звонок в новом окне
      window.open(response.join_link, "_blank");
      
      // Мониторим статус звонка
      monitorCall(response.call_id);
    } catch (error) {
      console.error("Error creating call:", error);
      setError("Не удалось создать звонок");
    } finally {
      setIsLoading(false);
    }
  };

  // Присоединение к звонку
  const joinCall = async () => {
    if (!callId) return;
    
    setIsLoading(true);
    try {
      const result = await joinVKCall(callId, currentUserId);
      if (result.success && result.join_link) {
        window.open(result.join_link, "_blank");
        setCallStatus("connected");
      } else {
        setError("Не удалось присоединиться к звонку");
      }
    } catch (error) {
      console.error("Error joining call:", error);
      setError("Не удалось присоединиться к звонку");
    } finally {
      setIsLoading(false);
    }
  };

  // Мониторинг звонка
  const monitorCall = async (id: string) => {
    const interval = setInterval(async () => {
      const info = await getVKCallInfo(id);
      if (info) {
        setParticipants(info.participants?.length || 0);
        if (info.status === "ended") {
          clearInterval(interval);
          setCallStatus("ended");
          setTimeout(() => onClose(), 3000);
        }
      }
    }, 5000);
    
    // Очистка при закрытии
    return () => clearInterval(interval);
  };

  // Завершение звонка
  const endCall = async () => {
    if (callId) {
      await endVKCall(callId);
      setCallStatus("ended");
      setTimeout(() => onClose(), 2000);
    } else {
      onClose();
    }
  };

  // Копирование ссылки
  const copyLink = () => {
    if (joinLink) {
      navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Открыть в VK
  const openInVK = () => {
    if (joinLink) {
      window.open(joinLink, "_blank");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4"
        onClick={() => callStatus !== "connected" && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#121214] rounded-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 text-center border-b border-white/10">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
              {callType === "video" ? (
                <Video size={32} className="text-blue-400" />
              ) : (
                <Phone size={32} className="text-green-400" />
              )}
            </div>
            <h2 className="text-xl font-bold text-white">
              {isIncoming ? "Входящий звонок" : callType === "video" ? "Видеозвонок" : "Аудиозвонок"}
            </h2>
            {isIncoming && callerName && (
              <p className="text-white/60 mt-1">от {callerName}</p>
            )}
            {callStatus === "connected" && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Users size={14} className="text-white/40" />
                <span className="text-white/60 text-sm">
                  {participants} {participants === 1 ? "участник" : "участников"}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            {callStatus === "idle" && !isIncoming && (
              <button
                onClick={createCall}
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Создание звонка...
                  </>
                ) : (
                  <>
                    <Phone size={18} />
                    Начать звонок
                  </>
                )}
              </button>
            )}

            {isIncoming && callStatus === "idle" && (
              <div className="flex gap-3">
                <button
                  onClick={joinCall}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-xl hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Phone size={18} />
                  Принять
                </button>
                <button
                  onClick={endCall}
                  className="flex-1 py-3 bg-red-500/20 text-red-400 font-medium rounded-xl hover:bg-red-500/30 transition-all"
                >
                  Отклонить
                </button>
              </div>
            )}

            {joinLink && callStatus !== "ended" && (
              <div className="space-y-3">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-white/40 mb-2">Ссылка для приглашения:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinLink}
                      readOnly
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 outline-none"
                    />
                    <button
                      onClick={copyLink}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      title="Копировать ссылку"
                    >
                      {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-white/60" />}
                    </button>
                    <button
                      onClick={openInVK}
                      className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
                      title="Открыть в VK"
                    >
                      <ExternalLink size={18} className="text-blue-400" />
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={openInVK}
                  className="w-full py-3 bg-blue-500/20 text-blue-400 font-medium rounded-xl hover:bg-blue-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Video size={18} />
                  Открыть в VK Звонках
                </button>
              </div>
            )}

            {callStatus === "connected" && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <p className="text-green-400 text-sm text-center">
                  Звонок активен. Окно VK Звонков открыто в новой вкладке.
                </p>
              </div>
            )}

            {callStatus === "ended" && (
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-white/60 text-sm text-center">Звонок завершен</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {(callStatus === "idle" || callStatus === "connected") && (
            <div className="p-4 border-t border-white/10">
              <button
                onClick={endCall}
                className="w-full py-2 text-white/60 hover:text-white transition-colors text-sm"
              >
                {callStatus === "connected" ? "Завершить звонок" : "Закрыть"}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}