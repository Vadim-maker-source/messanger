"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, Hash, Shield, Server, Loader2, ArrowRight, XCircle, CheckCircle } from "lucide-react";
import { joinByInvite } from "@/app/lib/api/invite";

interface InvitePageProps {
  params: Promise<{
    type: string;
  }>;
}

export default function InvitePage({ params }: InvitePageProps) {
  const { type: code } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<any>(null);

  useEffect(() => {
    fetchInviteInfo();
  }, [code]);

  const fetchInviteInfo = async () => {
    try {
      const res = await fetch(`/api/invite/${code}`);
      const data = await res.json();
      if (res.ok) {
        setInviteInfo(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to load invite");
    }
  };

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await joinByInvite(code);
      if (result.chat || result.server) {
        setSuccess(true);
        if (result.chat) {
          setTimeout(() => {
            router.push(`/chat/${result.chat.id}`);
          }, 1500);
        } else if (result.server && result.chat) {
          setTimeout(() => {
            router.push(`/chat/${result.chat.id}`);
          }, 1500);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to join");
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#050508] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[#121214] border border-white/10 rounded-2xl p-8 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <XCircle size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Недействительная ссылка</h2>
          <p className="text-white/60 text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 bg-violet-500 hover:bg-violet-600 rounded-xl transition-all"
          >
            На главную
          </button>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#050508] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[#121214] border border-white/10 rounded-2xl p-8 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Добро пожаловать!</h2>
          <p className="text-white/60 text-sm mb-6">
            Вы успешно присоединились к {inviteInfo?.type === 'SERVER' ? 'серверу' : 'чату'}
          </p>
          <div className="flex items-center justify-center gap-2 text-violet-400">
            <Loader2 size={16} className="animate-spin" />
            <span>Перенаправление...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!inviteInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#050508] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-violet-500" />
      </div>
    );
  }

  const isServer = inviteInfo.type === 'SERVER';
  const target = isServer ? inviteInfo.server : inviteInfo.chat;

  const getIcon = () => {
    if (isServer) return <Server size={24} />;
    switch (target?.type) {
      case 'GROUP': return <Users size={24} />;
      case 'CHANNEL': return <Hash size={24} />;
      default: return <Users size={24} />;
    }
  };

  const getTypeName = () => {
    if (isServer) return 'Сервер';
    switch (target?.type) {
      case 'GROUP': return 'Группа';
      case 'CHANNEL': return 'Канал';
      default: return 'Чат';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#050508] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#121214] border border-white/10 rounded-2xl overflow-hidden"
      >
        <div className="relative h-32 bg-gradient-to-r from-violet-600/20 to-purple-600/20">
          <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-2xl border-4 border-[#121214]">
              {target?.imageUrl ? (
                <img src={target.imageUrl} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <span className="text-4xl font-bold">{target?.name?.[0]?.toUpperCase()}</span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-14 pb-8 px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {getIcon()}
            <span className="text-xs font-medium text-violet-400 uppercase tracking-wider">
              {getTypeName()}
            </span>
          </div>
          
          <h2 className="text-2xl font-bold mb-2">{target?.name}</h2>
          
          <div className="flex items-center justify-center gap-4 text-xs text-white/40 mb-6">
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>{inviteInfo.memberCount || 0} участников</span>
            </div>
            {inviteInfo.invite.maxUses && (
              <div className="flex items-center gap-1">
                <span>Использовано: {inviteInfo.invite.uses}/{inviteInfo.invite.maxUses}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full py-3 bg-violet-500 hover:bg-violet-600 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Присоединение...
              </>
            ) : (
              <>
                Присоединиться
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {inviteInfo.invite.expiresAt && (
            <p className="text-xs text-white/30 mt-4">
              Ссылка действительна до {new Date(inviteInfo.invite.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}