"use client";

import { useState, useRef, useEffect } from "react";
import Avatar from "@/components/Avatar";
import { 
  Plus, Hash, Menu, X, Search, ServerIcon, Users,
  CheckCheck, Clock, MoreVertical, Settings, LogOut, 
  User, HelpCircle, FolderPlus, Pin, Bell, BellOff, Moon, Sun,
  Mic, Image, FileText, Loader2, Archive, ArchiveRestore, PinOff,
  ChevronRight, Trash2, ShieldOff, Shield, Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { User as UserType } from "@prisma/client";
import { getCurrentUser2, blockUser, unblockUser, getBlockStatus } from "@/app/lib/api/user";
import { setChatPreference, deleteChat, deleteChatForMe } from "@/app/lib/api/chat";
import { signOut } from "next-auth/react";

const MIN_WIDTH = 80;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 470;
const COLLAPSED_WIDTH = 80;
const CHANNELS_WIDTH = 340;

interface ChatItem {
  id: string;
  title: string;
  image?: string | null;
  uiType: string;
  type?: string;
  subtitle?: string;
  chats?: any[];
  lastMessage?: {
    content: string;
    createdAt: Date;
    status: 'SENT' | 'DELIVERED' | 'READ';
    senderId: string;
    isVoice?: boolean;
    isPhoto?: boolean;
    isFile?: boolean;
  };
  unreadCount?: number;
  isTyping?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
  updatedAt?: Date;
  partnerId?: string | null;
}

type Pref = { isPinned: boolean; isArchived: boolean; isMuted: boolean };

export default function Sidebar({ items }: { items: ChatItem[] }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<UserType | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [chatsWidth, setChatsWidth] = useState(DEFAULT_WIDTH);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chat: ChatItem } | null>(null);
  const [serverContextMenu, setServerContextMenu] = useState<{ x: number; y: number; server: ChatItem } | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<Record<string, Pref>>({});
  const [blockedUsers, setBlockedUsers] = useState<Record<string, boolean>>({});

  const router = useRouter();

  useEffect(() => {
    const map: Record<string, Pref> = {};
    items.forEach(item => {
      map[item.id] = {
        isPinned: item.isPinned ?? false,
        isArchived: item.isArchived ?? false,
        isMuted: item.isMuted ?? false,
      };
    });
    setLocalPrefs(map);
  }, [items]);

  useEffect(() => {
    if (!contextMenu && !serverContextMenu) return;
    const close = () => { setContextMenu(null); setServerContextMenu(null); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu, serverContextMenu]);

  const handleServerContextMenu = (e: React.MouseEvent, server: ChatItem) => {
    e.preventDefault();
    e.stopPropagation();
    setServerContextMenu({ x: e.clientX, y: e.clientY, server });
  };

  useEffect(() => {
    if (!contextMenu?.chat.partnerId) return;
    const pid = contextMenu.chat.partnerId;
    if (blockedUsers[pid] !== undefined) return;
    getBlockStatus(pid).then(({ iBlockedThem }) => {
      setBlockedUsers(prev => ({ ...prev, [pid]: iBlockedThem }));
    });
  }, [contextMenu?.chat.partnerId]);

  const handleChatContextMenu = (e: React.MouseEvent, chat: ChatItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, chat });
  };

  const applyPref = async (chatId: string, update: Partial<Pref>) => {
    setLocalPrefs(prev => ({ ...prev, [chatId]: { ...prev[chatId], ...update } }));
    setContextMenu(null);
    try { await setChatPreference(chatId, update); } catch {}
  };

  const handleDeleteForMe = async (chatId: string) => {
    setContextMenu(null);
    try {
      await deleteChatForMe(chatId);
      router.refresh();
    } catch (e) { console.error(e); }
  };

  const handleDeleteForAll = async (chatId: string) => {
    setContextMenu(null);
    if (!confirm("Удалить чат для всех участников? Это действие нельзя отменить.")) return;
    try {
      await deleteChat(chatId);
      router.refresh();
    } catch (e) { console.error(e); }
  };

  const handleToggleBlock = async (partnerId: string) => {
    setContextMenu(null);
    const isBlocked = blockedUsers[partnerId];
    try {
      if (isBlocked) {
        await unblockUser(partnerId);
        setBlockedUsers(prev => ({ ...prev, [partnerId]: false }));
      } else {
        await blockUser(partnerId);
        setBlockedUsers(prev => ({ ...prev, [partnerId]: true }));
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    getCurrentUser2().then(u => { if (u) setUser(u); else router.push("/sign-in"); });
  }, [router]);

  const handleNavigation = (path: string) => {
    router.push(path);
    setShowCreateMenu(false);
    setShowUserMenu(false);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Сначала удаляем запись Session — пока кука ещё валидна
      await fetch("/api/auth/sessions/forget", { method: "POST" }).catch(() => {});
      await signOut();
      router.push("/sign-in");
    } catch {
    } finally {
      setIsLoggingOut(false);
      setShowUserMenu(false);
    }
  };

  const startResizing = (e: React.MouseEvent) => { e.preventDefault(); setIsResizing(true); };
  const stopResizing = () => setIsResizing(false);
  const resize = (e: MouseEvent) => {
    if (isResizing) {
      const w = e.clientX;
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) { 
        setWidth(w); 
        setChatsWidth(w);
        setIsExpanded(w > MIN_WIDTH + 20); 
      }
    }
  };
  useEffect(() => {
    if (!isResizing) return;
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stopResizing); };
  }, [isResizing]);

  const handleServerClick = (item: ChatItem) => {
    if (item.uiType === 'SERVER') {
      const opening = expandedServer !== item.id;
      setExpandedServer(opening ? item.id : null);
      if (opening) { setChatsWidth(COLLAPSED_WIDTH); setWidth(COLLAPSED_WIDTH + CHANNELS_WIDTH); }
      else { setChatsWidth(DEFAULT_WIDTH); setWidth(DEFAULT_WIDTH); }
    } else {
      handleNavigation(`/chat/${item.id}`);
    }
  };

  const toggleExpand = () => {
    if (expandedServer) { setExpandedServer(null); setChatsWidth(DEFAULT_WIDTH); setWidth(DEFAULT_WIDTH); setIsExpanded(true); }
    else if (isExpanded) { setWidth(MIN_WIDTH); setChatsWidth(MIN_WIDTH); setIsExpanded(false); }
    else { setWidth(DEFAULT_WIDTH); setChatsWidth(DEFAULT_WIDTH); setIsExpanded(true); }
  };

  const toggleMaximize = () => {
    if (width >= 600) {
      setWidth(DEFAULT_WIDTH);
      setChatsWidth(DEFAULT_WIDTH);
    } else {
      setWidth(700);
      setChatsWidth(700);
    }
  };

  const getMessageStatusIcon = (status?: string) => {
    if (status === 'READ') return <CheckCheck size={14} className="text-white" />;
    if (status === 'DELIVERED') return <CheckCheck size={14} className="text-white/40" />;
    if (status === 'SENT') return <Clock size={14} className="text-white/20" />;
    return null;
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    const now = new Date(), d = new Date(date);
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Только что';
    if (mins < 60) return `${mins} мин`;
    if (hours < 24) return `${hours} ч`;
    if (days === 1) return 'Вчера';
    if (days < 7) return ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const truncate = (t: string, n: number) => t?.length > n ? t.slice(0, n) + '...' : (t ?? '');

  const userMenuItems = [
    { icon: User, label: "Профиль", path: "/profile", color: "text-violet-400", action: "navigate" },
    { icon: Settings, label: "Настройки", path: "/settings", color: "text-white/60", action: "navigate" },
    { icon: isDarkMode ? Sun : Moon, label: isDarkMode ? "Светлая тема" : "Тёмная тема", color: "text-white/60", action: "theme" },
    { icon: LogOut, label: "Выйти", color: "text-red-400", action: "logout" },
  ];

  const handleUserMenuItem = (item: any) => {
    if (item.action === "theme") { setIsDarkMode(!isDarkMode); document.documentElement.classList.toggle('dark'); setShowUserMenu(false); }
    else if (item.action === "logout") handleLogout();
    else if (item.path) handleNavigation(item.path);
  };

  const chats = items.filter(i => i.uiType !== 'SERVER');
  const servers = items.filter(i => i.uiType === 'SERVER');
  const activeServer = servers.find(s => s.id === expandedServer);

  const getItemDate = (i: ChatItem) =>
    new Date(i.lastMessage?.createdAt ?? i.updatedAt ?? 0).getTime();

  // Псевдо-чаты — всегда сверху, независимо от pin/archive
  const specialChats = chats.filter(c => c.type === 'NOTIFICATIONS' || c.type === 'FAVORITES');
  const regularChats = chats.filter(c => c.type !== 'NOTIFICATIONS' && c.type !== 'FAVORITES');

  // Сортировка: FAVORITES → NOTIFICATIONS (либо как удобно)
  const sortedSpecial = [...specialChats].sort((a, b) => {
    if (a.type === 'FAVORITES') return -1;
    if (b.type === 'FAVORITES') return 1;
    return 0;
  });

  const allItems = [...sortedSpecial, ...servers, ...regularChats].sort((a, b) => {
    // Псевдо-чаты — всегда сверху
    const aSpecial = a.type === 'NOTIFICATIONS' || a.type === 'FAVORITES';
    const bSpecial = b.type === 'NOTIFICATIONS' || b.type === 'FAVORITES';
    if (aSpecial && !bSpecial) return -1;
    if (bSpecial && !aSpecial) return 1;
    if (aSpecial && bSpecial) {
      // FAVORITES перед NOTIFICATIONS
      if (a.type === 'FAVORITES') return -1;
      if (b.type === 'FAVORITES') return 1;
      return 0;
    }
    const ap = localPrefs[a.id]?.isPinned ? 1 : 0, bp = localPrefs[b.id]?.isPinned ? 1 : 0;
    if (bp !== ap) return bp - ap;
    return getItemDate(b) - getItemDate(a);
  });

  // Псевдо-чаты не архивируются
  const visibleItems = allItems.filter(i => {
    if (i.type === 'NOTIFICATIONS' || i.type === 'FAVORITES') return true;
    return !(localPrefs[i.id]?.isArchived);
  });
  const archivedItems = allItems.filter(i =>
    i.type !== 'NOTIFICATIONS' && i.type !== 'FAVORITES' && localPrefs[i.id]?.isArchived
  );
  const archivedCount = archivedItems.length;

  useEffect(() => {
    if (archivedCount === 0 && showArchive) setShowArchive(false);
  }, [archivedCount]);


  return (
    <>
      <div className="flex h-full relative">
        {/* Main Chats Sidebar */}
        <motion.div
          ref={sidebarRef}
          animate={{ width: chatsWidth }}
          transition={{ duration: isResizing ? 0 : 0.3 }}
          className="h-full bg-[#1b1929dc] flex flex-col z-50 relative border-r border-white/5"
          style={{ minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}
        >
          {/* Header */}
          <div className="px-3 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <button onClick={toggleExpand} className="p-2 hover:bg-white/5 rounded-xl text-white/50 hover:text-violet-400 transition-all shrink-0">
                <Menu size={22} />
              </button>
              {chatsWidth > 100 && (
                <>
                  <button onClick={() => handleNavigation('/search')} className="flex-1 flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-violet-500/10 rounded-xl transition-all group">
                    <Search size={18} className="text-white/40 group-hover:text-violet-400" />
                    <span className="text-sm text-white/60 group-hover:text-violet-400">Поиск</span>
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowUserMenu(!showUserMenu)} className="p-2 hover:bg-white/5 rounded-xl text-white/50 hover:text-violet-400 transition-all">
                      <MoreVertical size={20} />
                    </button>
                    <AnimatePresence>
                      {showUserMenu && (
                        <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className="absolute top-full right-0 mt-2 w-56 bg-[#1a1a1f] border border-white/10 rounded-xl shadow-2xl z-[200] overflow-hidden">
                          <div className="p-3 border-b border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                                {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <User size={20} className="text-violet-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user?.displayName || user?.username}</p>
                                <p className="text-xs text-white/40 truncate">@{user?.username}</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-1">
                            {userMenuItems.map((item, i) => (
                              <button key={i} onClick={() => handleUserMenuItem(item)} disabled={item.action === "logout" && isLoggingOut}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-all disabled:opacity-50">
                                {item.action === "logout" && isLoggingOut ? <Loader2 size={16} className="animate-spin text-red-400" /> : <item.icon size={16} className={item.color} />}
                                <span className="text-sm flex-1 text-left">{item.label}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
            {/* Archive button — always at top */}
            {archivedCount > 0 && chatsWidth > 100 && (
              <div className="px-3 pt-3 pb-1">
                <button onClick={() => setShowArchive(v => !v)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${showArchive ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' : 'bg-white/3 border-white/8 hover:bg-white/5 text-white/50 hover:text-white/70'}`}>
                  <Archive size={18} className={showArchive ? 'text-blue-400' : 'text-white/40'} />
                  <span className="text-sm font-medium flex-1 text-left">Архив</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${showArchive ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-white/40'}`}>{archivedCount}</span>
                  <ChevronRight size={14} className={`transition-transform duration-200 ${showArchive ? 'rotate-90 text-blue-400' : 'text-white/20'}`} />
                </button>
              </div>
            )}
            {archivedCount > 0 && chatsWidth <= 100 && (
              <div className="flex justify-center pt-3 pb-1">
                <button onClick={() => setShowArchive(v => !v)} title="Архив"
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative ${showArchive ? 'bg-blue-500/20 ring-2 ring-blue-500/40' : 'bg-white/5 hover:bg-white/10'}`}>
                  <Archive size={18} className={showArchive ? 'text-blue-400' : 'text-white/40'} />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">{archivedCount}</span>
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {showArchive ? (
                /* Archive view */
                <motion.div key="archive"
                  initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="px-2 py-2"
                >
                  {chatsWidth > 100 && (
                    <div className="text-[11px] font-semibold text-blue-400/60 px-3 py-1 uppercase tracking-wider">В архиве</div>
                  )}
                  {archivedItems.map(item => {
                    const isServer = item.uiType === 'SERVER';
                    return (
                      <motion.button key={item.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
                        onClick={() => isServer ? handleServerClick(item) : handleNavigation(`/chat/${item.id}`)}
                        onContextMenu={e => isServer ? handleServerContextMenu(e, item) : handleChatContextMenu(e, item)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all opacity-75 hover:opacity-100"
                      >
                        <Avatar image={item.image} title={item.title} size={48} />
                        {chatsWidth > 100 && (
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-base font-semibold text-white/70 truncate">{item.title}</h3>
                              {!isServer && item.lastMessage && <span className="text-[13px] text-white/20 shrink-0">{formatTime(item.lastMessage.createdAt)}</span>}
                            </div>
                            <p className="text-[14px] text-white/30 truncate">
                              {isServer
                                ? `${item.chats?.length || 0} каналов`
                                : item.lastMessage
                                  ? (item.lastMessage.isVoice ? '🎤 Голосовое' : item.lastMessage.isPhoto ? '🖼️ Фото' : item.lastMessage.isFile ? '📎 Файл' : truncate(item.lastMessage.content, 45))
                                  : ''}
                            </p>
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              ) : (
                /* Normal view — unified list */
                <motion.div key="normal"
                  initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="px-2 py-2"
                >
                  {visibleItems.map(item => {
                    const isServer = item.uiType === 'SERVER';
                    const isNotifications = item.type === 'NOTIFICATIONS';
                    const isFavorites = item.type === 'FAVORITES';
                    const isSpecial = isNotifications || isFavorites;
                    const pref = localPrefs[item.id] ?? { isPinned: false, isArchived: false, isMuted: false };
                    return (
                      <motion.button key={item.id}
                        onClick={() => isServer ? handleServerClick(item) : handleNavigation(`/chat/${item.id}`)}
                        onContextMenu={e => {
                          if (isSpecial) { e.preventDefault(); return; } // нет контекст-меню у псевдо-чатов
                          isServer ? handleServerContextMenu(e, item) : handleChatContextMenu(e, item);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group ${isServer && expandedServer === item.id ? 'bg-violet-500/10' : ''}`}
                      >
                        <div className="relative shrink-0">
                          {isFavorites ? (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 grid place-items-center shadow-lg shadow-amber-500/20">
                              <Star size={22} className="text-white" fill="currentColor" strokeWidth={0} />
                            </div>
                          ) : isNotifications ? (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 grid place-items-center shadow-lg shadow-violet-500/20">
                              <Bell size={22} className="text-white" fill="currentColor" strokeWidth={0} />
                            </div>
                          ) : (
                            <Avatar image={item.image} title={item.title} size={48} />
                          )}
                          {!isServer && !isSpecial && item.isTyping && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#0f0f12]" />}
                        </div>
                        {chatsWidth > 100 && (
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-white/90 truncate">{item.title}</h3>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {!isServer && pref.isPinned && <Pin size={10} className="text-white" />}
                                {!isServer && item.lastMessage && <span className="text-[14px] text-white/30">{formatTime(item.lastMessage.createdAt)}</span>}
                                {isServer && <ChevronRight size={14} className={`text-white/20 transition-transform ${expandedServer === item.id ? 'rotate-90' : ''}`} />}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 flex-1 min-w-0">
                                {isServer ? (
                                  <p className="text-[14px] text-white/30 truncate">{item.chats?.length || 0} каналов</p>
                                ) : item.lastMessage ? (
                                  <>
                                    {getMessageStatusIcon(item.lastMessage.status)}
                                    <p className="text-[16px] text-white/40 truncate">
                                      {item.lastMessage.senderId === user?.id && 'Вы: '}
                                      {item.lastMessage.isVoice ? '🎤 Голосовое' : item.lastMessage.isPhoto ? '🖼️ Фото' : item.lastMessage.isFile ? '📎 Файл' : truncate(item.lastMessage.content, 45)}
                                    </p>
                                  </>
                                ) : null}
                              </div>
                              {!isServer && (
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  {pref.isMuted && <BellOff size={12} className="text-white/40" />}
                                  {(item.unreadCount ?? 0) > 0 && !pref.isMuted && (
                                    <div className="min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center px-1.5">
                                      <span className="text-[10px] font-bold text-white">{(item.unreadCount ?? 0) > 99 ? '99+' : item.unreadCount}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Collapsed footer */}
          {chatsWidth <= 100 && user && (
            <div className="px-3 py-3 border-t border-white/5">
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="relative group">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                  {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <User size={24} className="text-violet-400" />}
                </div>
              </button>
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                    className="absolute bottom-full left-0 mb-2 w-56 bg-[#1a1a1f] border border-white/10 rounded-xl shadow-2xl z-[200] overflow-hidden">
                    <div className="p-1">
                      {userMenuItems.map((item, i) => (
                        <button key={i} onClick={() => handleUserMenuItem(item)} disabled={item.action === "logout" && isLoggingOut}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-all disabled:opacity-50">
                          <item.icon size={16} className={item.color} />
                          <span className="text-sm">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Create button */}
          {chatsWidth > 100 && (
            <div className="p-3 border-t border-white/5 relative">
              <button onClick={() => setShowCreateMenu(!showCreateMenu)}
                className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all border border-dashed ${showCreateMenu ? 'bg-violet-500 border-violet-500 text-white' : 'hover:bg-white/5 border-white/10 text-violet-400'}`}>
                <Plus size={20} /><span className="text-sm font-medium">Создать</span>
              </button>
              <AnimatePresence>
                {showCreateMenu && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-3 right-3 mb-2 bg-[#1a1a1f] border border-white/10 rounded-xl p-2 shadow-xl z-[110]">
                    {[
                      { id: 'server', icon: ServerIcon, label: 'Сервер', color: 'text-violet-400' },
                      { id: 'group', icon: Users, label: 'Группа', color: 'text-green-400' },
                      { id: 'channel', icon: Hash, label: 'Канал', color: 'text-blue-400' }
                    ].map(opt => (
                      <button key={opt.id} onClick={() => { handleNavigation(`/create/${opt.id}`); setShowCreateMenu(false); }}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                        <opt.icon size={16} className={opt.color} /><span className="text-sm">{opt.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Server Channels Panel */}
        <AnimatePresence>
          {expandedServer && activeServer && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: CHANNELS_WIDTH, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.3 }}
              className="h-full bg-[#16161a] border-l border-white/5 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 relative">
                <button onClick={() => handleNavigation(`/chat/${activeServer.id}/data`)}
                  className="w-full flex items-center gap-3 hover:bg-white/5 rounded-xl p-2 transition-all group">
                  <Avatar image={activeServer.image} title={activeServer.title} size={40} rounded="rounded-xl" />
                  <div className="flex-1 min-w-0 text-left">
                    <h3 className="text-sm font-semibold text-white/90 truncate group-hover:text-violet-400">{activeServer.title}</h3>
                    <p className="text-xs text-white/40">{activeServer.chats?.length || 0} каналов</p>
                  </div>
                </button>
                <button onClick={() => { setExpandedServer(null); setChatsWidth(DEFAULT_WIDTH); setWidth(DEFAULT_WIDTH); }}
                  className="absolute top-4 right-4 p-1.5 hover:bg-white/5 rounded-lg text-white/40">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
                <div className="text-[11px] font-semibold text-white/40 px-3 py-1 uppercase tracking-wider">Каналы</div>
                {activeServer.chats?.map((chat: any) => (
                  <button key={chat.id} onClick={() => handleNavigation(`/chat/${chat.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white/90 hover:bg-white/5 transition-all group">
                    <Avatar image={chat.image} title={chat.name} size={36} />
                    <span className="flex-1 text-left truncate font-medium">{chat.name}</span>
                    {(chat.unreadCount ?? 0) > 0 && (
                      <div className="min-w-[18px] h-4 bg-red-500 rounded-full flex items-center justify-center px-1">
                        <span className="text-[9px] font-bold text-white">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Resize handle */}
      <div className="fixed top-0 w-1 h-full cursor-ew-resize hover:bg-violet-500/50 transition-colors z-[1000]"
        style={{ left: width }} onMouseDown={startResizing} />

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
            className="bg-[#1e1e24] border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[260px]"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const pref = localPrefs[contextMenu.chat.id] ?? { isPinned: false, isArchived: false, isMuted: false };
              return (
                <div className="py-2">
                  <button onClick={() => applyPref(contextMenu.chat.id, { isPinned: !pref.isPinned })}
                    className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-white transition-colors">
                    {pref.isPinned ? <PinOff size={18} className="text-white" /> : <Pin size={18} className="text-white" />}
                    {pref.isPinned ? 'Открепить' : 'Закрепить'}
                  </button>
                  <button onClick={() => applyPref(contextMenu.chat.id, { isArchived: !pref.isArchived })}
                    className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-white transition-colors">
                    {pref.isArchived ? <ArchiveRestore size={18} className="text-white" /> : <Archive size={18} className="text-white" />}
                    {pref.isArchived ? 'Из архива' : 'В архив'}
                  </button>
                  <button onClick={() => applyPref(contextMenu.chat.id, { isMuted: !pref.isMuted })}
                    className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-white transition-colors">
                    {pref.isMuted ? <Bell size={18} className="text-white" /> : <BellOff size={18} className="text-white" />}
                    {pref.isMuted ? 'Включить уведомления' : 'Заглушить'}
                  </button>
                  <div className="h-px bg-white/10 my-1.5" />
                  <button onClick={() => handleDeleteForMe(contextMenu.chat.id)}
                    className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-red-400 transition-colors">
                    <Trash2 size={18} />
                    Удалить у меня
                  </button>
                  <button onClick={() => handleDeleteForAll(contextMenu.chat.id)}
                    className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-red-400 transition-colors">
                    <Trash2 size={18} className="text-red-600" />
                    Удалить у всех
                  </button>
                  {contextMenu.chat.partnerId && (
                    <button onClick={() => handleToggleBlock(contextMenu.chat.partnerId!)}
                      className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-orange-400 transition-colors">
                      {blockedUsers[contextMenu.chat.partnerId] ? <Shield size={18} /> : <ShieldOff size={18} />}
                      {blockedUsers[contextMenu.chat.partnerId] ? 'Разблокировать' : 'Заблокировать'}
                    </button>
                  )}
                  {contextMenu.chat.type === 'GROUP' && (
                    <button onClick={() => { setContextMenu(null); handleNavigation(`/chat/${contextMenu.chat.id}/leave`); }}
                      className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-red-400 transition-colors">
                      <LogOut size={18} />
                      Покинуть группу
                    </button>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Server Context Menu */}
      <AnimatePresence>
        {serverContextMenu && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'fixed', top: serverContextMenu.y, left: serverContextMenu.x, zIndex: 9999 }}
            className="bg-[#1e1e24] border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[260px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="py-2">
              <button onClick={() => { handleNavigation(`/chat/${serverContextMenu.server.id}/data`); setServerContextMenu(null); }}
                className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-white transition-colors">
                <Settings size={18} className="text-violet-400" />
                Настройки сервера
              </button>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${serverContextMenu.server.id}`); setServerContextMenu(null); }}
                className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-white transition-colors">
                <FolderPlus size={18} className="text-green-400" />
                Скопировать ссылку
              </button>
              <button onClick={() => { applyPref(serverContextMenu.server.id, { isArchived: !(localPrefs[serverContextMenu.server.id]?.isArchived) }); setServerContextMenu(null); }}
                className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-white transition-colors">
                {localPrefs[serverContextMenu.server.id]?.isArchived
                  ? <><ArchiveRestore size={18} className="text-white" />Из архива</>
                  : <><Archive size={18} className="text-white" />В архив</>}
              </button>
              <div className="h-px bg-white/10 my-1.5" />
              <button onClick={() => { handleNavigation(`/chat/${serverContextMenu.server.id}/leave`); setServerContextMenu(null); }}
                className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-white/10 text-[15px] text-red-400 transition-colors">
                <LogOut size={18} />
                Покинуть сервер
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </>
  );
}
