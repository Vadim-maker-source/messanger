"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Plus, Hash, Menu, X, Search, ServerIcon, Users,
  CheckCheck, Clock, MoreVertical, Settings, LogOut, 
  User, HelpCircle, FolderPlus, Pin, Bell, BellOff, Moon, Sun,
  Mic, Image, FileText, Loader2, Archive, ArchiveRestore, PinOff,
  ChevronRight, Trash2, ShieldOff, Shield
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { User as UserType } from "@prisma/client";
import { getCurrentUser2, blockUser, unblockUser, getBlockStatus } from "@/app/lib/api/user";
import { setChatPreference, deleteChat, deleteChatForMe } from "@/app/lib/api/chat";
import { signOut } from "next-auth/react";

const MIN_WIDTH = 80;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 470;
const COLLAPSED_WIDTH = 80;
const CHANNELS_WIDTH = 280;

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
  const [localPrefs, setLocalPrefs] = useState<Record<string, Pref>>({});
  const [blockedUsers, setBlockedUsers] = useState<Record<string, boolean>>({});

  const router = useRouter();

  useEffect(() => {
    const map: Record<string, Pref> = {};
    items.forEach(item => {
      if (item.uiType !== 'SERVER') {
        map[item.id] = {
          isPinned: item.isPinned ?? false,
          isArchived: item.isArchived ?? false,
          isMuted: item.isMuted ?? false,
        };
      }
    });
    setLocalPrefs(map);
  }, [items]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

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
    try { await signOut(); router.push("/sign-in"); }
    catch {} finally { setIsLoggingOut(false); setShowUserMenu(false); }
  };

  const startResizing = (e: React.MouseEvent) => { e.preventDefault(); setIsResizing(true); };
  const stopResizing = () => setIsResizing(false);
  const resize = (e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const w = e.clientX;
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) { setWidth(w); setIsExpanded(w > MIN_WIDTH + 20); }
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

  const getMessageStatusIcon = (status?: string) => {
    if (status === 'READ') return <CheckCheck size={14} className="text-blue-400" />;
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

  const sortedChats = [...chats].sort((a, b) => {
    const ap = localPrefs[a.id]?.isPinned ? 1 : 0, bp = localPrefs[b.id]?.isPinned ? 1 : 0;
    if (bp !== ap) return bp - ap;
    return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
  });


  return (
    <>
      <div className="flex h-full relative">
        {/* Main Chats Sidebar */}
        <motion.div
          ref={sidebarRef}
          animate={{ width: chatsWidth }}
          transition={{ duration: isResizing ? 0 : 0.3 }}
          className="h-full bg-[#0f0f12] flex flex-col z-50 relative shadow-2xl"
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
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Servers expanded */}
            {servers.length > 0 && chatsWidth > 100 && (
              <div className="px-2 py-2">
                <div className="text-[11px] font-semibold text-white/40 px-3 py-1 uppercase tracking-wider">Серверы</div>
                {servers.map(server => (
                  <button key={server.id} onClick={() => handleServerClick(server)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${expandedServer === server.id ? 'bg-violet-500/20' : 'hover:bg-white/5'}`}>
                    <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center overflow-hidden">
                      {server.image ? <img src={server.image} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-violet-400">#{server.title?.[0]}</span>}
                    </div>
                    <span className="flex-1 text-left text-lg font-medium text-white/80 truncate">{server.title}</span>
                    <ChevronRight size={14} className={`text-white/20 transition-transform ${expandedServer === server.id ? 'rotate-90' : ''}`} />
                  </button>
                ))}
              </div>
            )}
            {/* Servers collapsed */}
            {servers.length > 0 && chatsWidth <= 100 && (
              <div className="px-2 py-2 flex flex-col items-center gap-2">
                {servers.map(server => (
                  <button key={server.id} onClick={() => handleServerClick(server)} title={server.title}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${expandedServer === server.id ? 'bg-violet-500/20 ring-4 ring-violet-500/50' : 'bg-violet-600/20 hover:bg-violet-600/30'}`}>
                    {server.image ? <img src={server.image} className="w-full h-full object-cover rounded-full" /> : <span className="text-lg font-bold text-violet-400">#{server.title?.[0]}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Chats */}
            <div className="px-2 py-2">
              {chatsWidth > 100 && chats.length > 0 && (
                <div className="text-[11px] font-semibold text-white/40 px-3 py-1 uppercase tracking-wider">Чаты</div>
              )}
              {sortedChats.map(chat => {
                const pref = localPrefs[chat.id] ?? { isPinned: false, isArchived: false, isMuted: false };
                return (
                  <motion.button key={chat.id}
                    onClick={() => handleNavigation(`/chat/${chat.id}`)}
                    onContextMenu={e => handleChatContextMenu(e, chat)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                        {chat.image ? <img src={chat.image} className="w-full h-full object-cover" /> : <span className="text-lg font-bold text-violet-400">{chat.title?.[0]?.toUpperCase()}</span>}
                      </div>
                      {chat.isTyping && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#0f0f12]" />}
                    </div>
                    {chatsWidth > 100 && (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-white/90 truncate">{chat.title}</h3>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {pref.isPinned && <Pin size={10} className="text-violet-400" />}
                            {chat.lastMessage && <span className="text-[14px] text-white/30">{formatTime(chat.lastMessage.createdAt)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            {chat.lastMessage && (
                              <>
                                {getMessageStatusIcon(chat.lastMessage.status)}
                                <p className="text-[16px] text-white/40 truncate">
                                  {chat.lastMessage.senderId === user?.id && 'Вы: '}
                                  {chat.lastMessage.isVoice ? '🎤 Голосовое' : chat.lastMessage.isPhoto ? '🖼️ Фото' : chat.lastMessage.isFile ? '📎 Файл' : truncate(chat.lastMessage.content, 45)}
                                </p>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {pref.isMuted && <BellOff size={12} className="text-white/20" />}
                            {(chat.unreadCount ?? 0) > 0 && !pref.isMuted && (
                              <div className="min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center px-1.5">
                                <span className="text-[10px] font-bold text-white">{(chat.unreadCount ?? 0) > 99 ? '99+' : chat.unreadCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
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
                  <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center overflow-hidden shrink-0">
                    {activeServer.image ? <img src={activeServer.image} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-violet-400">#{activeServer.title?.[0]}</span>}
                  </div>
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
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white/90 hover:bg-white/5 transition-all group">
                    <Hash size={16} className="text-white/40 group-hover:text-violet-400" />
                    <span className="flex-1 text-left truncate">{chat.name}</span>
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
            className="bg-[#1e1e24] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[200px]"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const pref = localPrefs[contextMenu.chat.id] ?? { isPinned: false, isArchived: false, isMuted: false };
              return (
                <div className="py-1">
                  <button onClick={() => applyPref(contextMenu.chat.id, { isPinned: !pref.isPinned })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-sm text-white transition-colors">
                    {pref.isPinned ? <PinOff size={15} className="text-violet-400" /> : <Pin size={15} className="text-violet-400" />}
                    {pref.isPinned ? 'Открепить' : 'Закрепить'}
                  </button>
                  <button onClick={() => applyPref(contextMenu.chat.id, { isArchived: !pref.isArchived })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-sm text-white transition-colors">
                    {pref.isArchived ? <ArchiveRestore size={15} className="text-blue-400" /> : <Archive size={15} className="text-blue-400" />}
                    {pref.isArchived ? 'Из архива' : 'В архив'}
                  </button>
                  <button onClick={() => applyPref(contextMenu.chat.id, { isMuted: !pref.isMuted })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-sm text-white transition-colors">
                    {pref.isMuted ? <Bell size={15} className="text-green-400" /> : <BellOff size={15} className="text-yellow-400" />}
                    {pref.isMuted ? 'Включить уведомления' : 'Заглушить'}
                  </button>
                  <div className="h-px bg-white/10 my-1" />
                  <button onClick={() => handleDeleteForMe(contextMenu.chat.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-sm text-red-400 transition-colors">
                    <Trash2 size={15} />
                    Удалить у меня
                  </button>
                  <button onClick={() => handleDeleteForAll(contextMenu.chat.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-sm text-red-400 transition-colors">
                    <Trash2 size={15} className="text-red-600" />
                    Удалить у всех
                  </button>
                  {contextMenu.chat.partnerId && (
                    <button onClick={() => handleToggleBlock(contextMenu.chat.partnerId!)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-sm text-orange-400 transition-colors">
                      {blockedUsers[contextMenu.chat.partnerId] ? <Shield size={15} /> : <ShieldOff size={15} />}
                      {blockedUsers[contextMenu.chat.partnerId] ? 'Разблокировать' : 'Заблокировать'}
                    </button>
                  )}
                </div>
              );
            })()}
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
