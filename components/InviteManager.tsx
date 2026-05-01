"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Link, Copy, Check, Trash2, Plus, Calendar, Users, 
  RefreshCw, QrCode, X, Settings, Clock, Infinity
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface Invite {
  id: string;
  code: string;
  maxUses: number | null;
  expiresAt: string | null;
  uses: number;
  createdAt: string;
}

interface InviteManagerProps {
  chatId?: string;
  serverId?: string;
  chatName: string;
  chatType: string;
}

export default function InviteManager({ chatId, serverId, chatName, chatType }: InviteManagerProps) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  useEffect(() => {
    loadInvites();
  }, [chatId, serverId]);

  const loadInvites = async () => {
    try {
      const params = new URLSearchParams();
      if (chatId) params.append('chatId', chatId);
      if (serverId) params.append('serverId', serverId);

      const res = await fetch(`/api/invite/list?${params.toString()}`);
      const data = await res.json();
      setInvites(data);
    } catch (error) {
      console.error("Failed to load invites:", error);
    } finally {
      setLoading(false);
    }
  };

  const createInvite = async () => {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    const body: any = { maxUses, expiresAt };
    if (chatId) body.chatId = chatId;
    if (serverId) body.serverId = serverId;

    const res = await fetch("/api/invite/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      loadInvites();
      setShowCreateModal(false);
      setMaxUses(null);
      setExpiresIn(null);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    await fetch(`/api/invite/id/${inviteId}`, { method: "DELETE" });
    loadInvites();
  };

  const copyToClipboard = (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const getInviteUrl = (code: string) => `${window.location.origin}/invite/${code}`;

  const formatDate = (date: string | null) => {
    if (!date) return "Никогда";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Приглашения</h3>
          <p className="text-sm text-white/40">
            Приглашайте людей в {chatType === "SERVER" ? "сервер" : "чат"}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Создать ссылку
        </button>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Новая ссылка-приглашение</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white/60 block mb-2">Максимальное количество использований</label>
                  <select
                    value={maxUses === null ? "unlimited" : maxUses}
                    onChange={(e) => setMaxUses(e.target.value === "unlimited" ? null : parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-violet-500"
                  >
                    <option value="unlimited">Без ограничений</option>
                    <option value="1">1 использование</option>
                    <option value="5">5 использований</option>
                    <option value="10">10 использований</option>
                    <option value="25">25 использований</option>
                    <option value="50">50 использований</option>
                    <option value="100">100 использований</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-white/60 block mb-2">Срок действия</label>
                  <select
                    value={expiresIn === null ? "never" : expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value === "never" ? null : parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-violet-500"
                  >
                    <option value="never">Никогда</option>
                    <option value="3600">1 час</option>
                    <option value="86400">24 часа</option>
                    <option value="604800">7 дней</option>
                    <option value="2592000">30 дней</option>
                  </select>
                </div>

                <button
                  onClick={createInvite}
                  className="w-full py-3 bg-violet-500 hover:bg-violet-600 rounded-xl font-medium transition-all"
                >
                  Создать
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invites List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={24} className="animate-spin text-white/40" />
        </div>
      ) : invites.length === 0 ? (
        <div className="text-center py-8 bg-white/5 rounded-xl">
          <Link size={32} className="text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">Нет активных приглашений</p>
          <p className="text-xs text-white/20">Создайте первую ссылку-приглашение</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => (
            <motion.div
              key={invite.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 rounded-xl p-3 group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Calendar size={12} />
                  <span>Создана: {new Date(invite.createdAt).toLocaleDateString()}</span>
                  <Clock size={12} className="ml-2" />
                  <span>Использовано: {invite.uses}/{invite.maxUses || "∞"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowQR(showQR === invite.id ? null : invite.id)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
                    title="Показать QR-код"
                  >
                    <QrCode size={14} />
                  </button>
                  <button
                    onClick={() => copyToClipboard(invite.code)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
                    title="Копировать ссылку"
                  >
                    {copied === invite.code ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => revokeInvite(invite.id)}
                    className="p-1.5 hover:bg-red-500/20 rounded-lg transition-all text-red-400"
                    title="Отозвать"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-black/30 px-3 py-2 rounded-lg font-mono truncate">
                  {getInviteUrl(invite.code)}
                </code>
              </div>

              {invite.expiresAt && (
                <p className="text-[10px] text-white/30 mt-2">
                  Истекает: {formatDate(invite.expiresAt)}
                </p>
              )}

              {/* QR Code Modal */}
              <AnimatePresence>
                {showQR === invite.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-white/10"
                  >
                    <div className="flex flex-col items-center">
                      <div className="bg-white p-4 rounded-xl">
                        <QRCodeSVG
                          value={getInviteUrl(invite.code)}
                          size={200}
                          level="H"
                          includeMargin
                        />
                      </div>
                      <p className="text-xs text-white/40 mt-2 text-center">
                        Отсканируйте QR-код, чтобы присоединиться к {chatType === "SERVER" ? "серверу" : "чату"}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}