"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, UserPlus, Check, Loader2 } from "lucide-react";
import { getInviteSuggestions, addChatMember, addServerMember } from "@/app/lib/api/chat";
import { toast } from "sonner";

interface User {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** chatId если добавляем в чат, либо serverId если в сервер */
  chatId?: string;
  serverId?: string;
  /** Список ID уже состоящих в чате — будут отфильтрованы */
  existingMemberIds?: string[];
  onAdded?: () => void;
}

export default function AddMemberDialog({ open, onClose, chatId, serverId, existingMemberIds = [], onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeout(() => { setQuery(""); setSelectedIds([]); setUsers([]); }, 200);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      const data = await getInviteSuggestions(query);
      const existingSet = new Set(existingMemberIds);
      setUsers(data.filter((u: User) => !existingSet.has(u.id)));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, existingMemberIds]);

  const toggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    setAdding(true);
    let added = 0;
    for (const userId of selectedIds) {
      try {
        if (serverId) {
          await addServerMember(serverId, userId);
        } else if (chatId) {
          await addChatMember(chatId, userId);
        }
        added++;
      } catch (e) {
        console.error("addMember failed:", e);
      }
    }
    setAdding(false);
    if (added > 0) {
      toast.success(`Добавлено: ${added}`);
      onAdded?.();
      onClose();
    } else {
      toast.error("Не удалось добавить участников");
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
          className="relative w-full max-w-md bg-[#16161b] rounded-3xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          <button onClick={onClose}
            className="absolute top-5 right-5 z-10 w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-white/40 hover:text-white/80">
            <X size={18} />
          </button>

          {/* Header */}
          <div className="px-7 pt-7 pb-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-11 h-11 rounded-2xl bg-violet-500/15 flex items-center justify-center">
                <UserPlus size={20} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Добавить участников</h2>
                <p className="text-sm text-white/50">Выберите кого пригласить в чат</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-7 pb-3">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск по имени или @username"
                className="w-full pl-11 pr-4 py-3 bg-[#1f1f26] rounded-2xl text-white text-sm outline-none focus:ring-1 focus:ring-violet-500/40 transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Selected chips */}
          {selectedIds.length > 0 && (
            <div className="px-7 pb-3">
              <div className="flex flex-wrap gap-2">
                {selectedIds.map(id => {
                  const u = users.find(x => x.id === id);
                  if (!u) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => toggle(id)}
                      className="flex items-center gap-2 pl-1 pr-3 py-1 bg-violet-500/15 hover:bg-violet-500/25 rounded-full transition-colors group"
                    >
                      <Avatar user={u} size={22} />
                      <span className="text-xs font-medium text-violet-300">{u.displayName || u.username}</span>
                      <X size={12} className="text-violet-300/60 group-hover:text-violet-300" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 py-1 min-h-[200px]">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={22} className="animate-spin text-white/30" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search size={28} className="text-white/15 mb-2" />
                <p className="text-sm text-white/40">
                  {query ? "Никого не найдено" : "Начните поиск"}
                </p>
              </div>
            ) : (
              users.map(u => {
                const selected = selectedIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${
                      selected ? "bg-violet-500/10" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <Avatar user={u} size={40} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-white truncate">{u.displayName || u.username}</p>
                      <p className="text-xs text-white/40 truncate">@{u.username}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                      selected
                        ? "bg-violet-500"
                        : "border border-white/15"
                    }`}>
                      {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-7 pt-3 pb-7">
            <button
              onClick={handleAdd}
              disabled={selectedIds.length === 0 || adding}
              className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 rounded-2xl font-medium text-white transition-colors disabled:bg-white/5 disabled:text-white/30 flex items-center justify-center gap-2"
            >
              {adding ? (
                <Loader2 size={18} className="animate-spin" />
              ) : selectedIds.length === 0 ? (
                "Выберите хотя бы одного"
              ) : (
                `Добавить ${selectedIds.length}`
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Avatar({ user, size }: { user: User; size: number }) {
  const fontSize = size * 0.4;
  if (user.avatarUrl) {
    return (
      <img src={user.avatarUrl} alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center bg-violet-500/15 text-violet-300 font-semibold shrink-0"
      style={{ width: size, height: size, fontSize }}>
      {(user.displayName?.[0] || user.username?.[0] || "?").toUpperCase()}
    </div>
  );
}
