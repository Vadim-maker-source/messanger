"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Plus, Zap, MessageSquare, ChevronRight, ChevronDown, Hash, 
  Menu, Radio, X, Search, ServerIcon, Users, UserIcon, 
  CheckCheck, Clock, MoreVertical, Settings, LogOut, 
  User, HelpCircle, FolderPlus, Pin, Bell, Moon, Sun,
  Mic, Image, FileText, Circle, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { User as UserType } from "@prisma/client";
import { getCurrentUser2 } from "@/app/lib/api/user";
import { signOut } from "next-auth/react";

const MIN_WIDTH = 80;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 470;

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
  isMuted?: boolean;
  updatedAt?: Date;
}

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
  
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser2();
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/sign-in");
      }
    };
    checkAuth();
  }, [router]);

  const handleNavigation = (path: string) => {
    router.push(path);
    setShowCreateMenu(false);
    setShowUserMenu(false);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push("/sign-in");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
      setShowUserMenu(false);
    }
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const newWidth = e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setWidth(newWidth);
        setIsExpanded(newWidth > MIN_WIDTH + 20);
      }
    }
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      return () => {
        window.removeEventListener('mousemove', resize);
        window.removeEventListener('mouseup', stopResizing);
      };
    }
  }, [isResizing]);

  const handleServerClick = (item: ChatItem) => {
    if (item.uiType === 'SERVER') {
      setExpandedServer(expandedServer === item.id ? null : item.id);
      if (width <= MIN_WIDTH + 20) {
        setWidth(DEFAULT_WIDTH);
        setIsExpanded(true);
      }
    } else {
      handleNavigation(`/chat/${item.id}`);
    }
  };

  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case 'READ':
        return <CheckCheck size={14} className="text-blue-400" />;
      case 'DELIVERED':
        return <CheckCheck size={14} className="text-white/40" />;
      case 'SENT':
        return <Clock size={14} className="text-white/20" />;
      default:
        return null;
    }
  };

  const getMessageIcon = (lastMessage?: ChatItem['lastMessage']) => {
    if (lastMessage?.isVoice) {
      return <Mic size={14} className="text-white/40" />;
    }
    if (lastMessage?.isPhoto) {
      return <Image size={14} className="text-white/40" />;
    }
    if (lastMessage?.isFile) {
      return <FileText size={14} className="text-white/40" />;
    }
    return null;
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    
    const now = new Date();
    const msgDate = new Date(date);
    const diff = now.getTime() - msgDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      if (minutes < 1) return 'Только что';
      if (minutes < 60) return `${minutes} мин`;
    } else if (hours < 24) {
      return `${hours} ч`;
    } else if (days === 1) {
      return 'Вчера';
    } else if (days < 7) {
      const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      return weekdays[msgDate.getDay()];
    } else {
      return msgDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
    return '';
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const toggleExpand = () => {
    if (isExpanded) {
      setWidth(MIN_WIDTH);
      setIsExpanded(false);
    } else {
      setWidth(DEFAULT_WIDTH);
      setIsExpanded(true);
    }
  };

  const userMenuItems = [
    { icon: User, label: "Профиль", path: "/profile", color: "text-violet-400", action: "navigate" },
    { icon: Settings, label: "Настройки", path: "/settings", color: "text-white/60", action: "navigate" },
    { icon: Bell, label: "Уведомления", path: "/notifications", color: "text-white/60", action: "navigate" },
    { icon: FolderPlus, label: "Мои серверы", path: "/my-servers", color: "text-white/60", action: "navigate" },
    { icon: HelpCircle, label: "Помощь", path: "/help", color: "text-white/60", action: "navigate" },
    { icon: isDarkMode ? Sun : Moon, label: isDarkMode ? "Светлая тема" : "Тёмная тема", color: "text-white/60", action: "theme" },
    { icon: LogOut, label: "Выйти", color: "text-red-400", action: "logout" },
  ];

  const handleUserMenuItem = (item: any) => {
    if (item.action === "theme") {
      setIsDarkMode(!isDarkMode);
      document.documentElement.classList.toggle('dark');
      setShowUserMenu(false);
    } else if (item.action === "logout") {
      handleLogout();
    } else if (item.action === "navigate" && item.path) {
      handleNavigation(item.path);
    }
  };

  // Separate chats and servers
  const chats = items.filter(item => item.uiType !== 'SERVER');
  const servers = items.filter(item => item.uiType === 'SERVER');

  return (
    <>
      <motion.div 
        ref={sidebarRef}
        animate={{ width }}
        transition={{ duration: isResizing ? 0 : 0.2 }}
        className="h-full bg-[#0f0f12] flex flex-col z-50 relative shadow-2xl"
        style={{ minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}
      >
        {/* Header */}
        <div className="px-3 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleExpand}
              className="p-2 hover:bg-white/5 rounded-xl text-white/50 hover:text-violet-400 transition-all active:scale-90 shrink-0"
              title={isExpanded ? "Свернуть" : "Развернуть"}
            >
              <Menu size={22} />
            </button>
            
            {width > 100 && (
              <>
                <button
                  onClick={() => handleNavigation('/search')}
                  className="flex-1 flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-violet-500/10 rounded-xl transition-all group"
                >
                  <Search size={18} className="text-white/40 group-hover:text-violet-400" />
                  <span className="text-sm text-white/60 group-hover:text-violet-400">Поиск</span>
                </button>
                
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="p-2 hover:bg-white/5 rounded-xl text-white/50 hover:text-violet-400 transition-all"
                  >
                    <MoreVertical size={20} />
                  </button>
                  
                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute top-full right-0 mt-2 w-56 bg-[#1a1a1f] border border-white/10 rounded-xl shadow-2xl z-[200] overflow-hidden"
                      >
                        <div className="p-3 border-b border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                              {user?.avatarUrl ? (
                                <img src={user.avatarUrl} className="w-full h-full object-cover" />
                              ) : (
                                <User size={20} className="text-violet-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {user?.displayName || user?.username}
                              </p>
                              <p className="text-xs text-white/40 truncate">
                                @{user?.username}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-1">
                          {userMenuItems.map((item, index) => (
                            <button
                              key={index}
                              onClick={() => handleUserMenuItem(item)}
                              disabled={item.action === "logout" && isLoggingOut}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {item.action === "logout" && isLoggingOut ? (
                                <Loader2 size={16} className="animate-spin text-red-400" />
                              ) : (
                                <item.icon size={16} className={item.color} />
                              )}
                              <span className="text-sm flex-1 text-left">{item.label}</span>
                              {item.action !== "logout" && (
                                <ChevronRight size={12} className="text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
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
          {/* Servers Section */}
          {servers.length > 0 && width > 100 && (
            <div className="px-2 py-2">
              <div className="text-[11px] font-semibold text-white/40 px-3 py-1 uppercase tracking-wider">
                Серверы
              </div>
              {servers.map((server) => (
                <div key={server.id}>
                  <button
                    onClick={() => handleServerClick(server)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center overflow-hidden">
                        {server.image ? (
                          <img src={server.image} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-violet-400">#{server.title?.[0]}</span>
                        )}
                      </div>
                    </div>
                    <span className="flex-1 text-left text-sm font-medium text-white/80 truncate">
                      {server.title}
                    </span>
                    <ChevronRight size={14} className="text-white/20" />
                  </button>
                  
                  <AnimatePresence>
                    {expandedServer === server.id && server.chats && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-12 flex flex-col gap-0.5 mb-1"
                      >
                        {server.chats.map((chat: any) => (
                          <button
                            key={chat.id}
                            onClick={() => handleNavigation(`/chat/${chat.id}`)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
                          >
                            <Hash size={14} className="text-white/30" />
                            <span className="truncate">{chat.name}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          {/* Chats Section */}
          <div className="px-2 py-2">
            {width > 100 && chats.length > 0 && (
              <div className="text-[11px] font-semibord text-white/40 px-3 py-1 uppercase tracking-wider">
                Чаты
              </div>
            )}
            
            {chats.map((chat) => (
              <motion.button
                key={chat.id}
                onClick={() => handleNavigation(`/chat/${chat.id}`)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                    {chat.image ? (
                      <img src={chat.image} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-violet-400">
                        {chat.title?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  
                  {/* Online indicator */}
                  {chat.isTyping && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#0f0f12]" />
                  )}
                </div>

                {/* Content */}
                {width > 100 && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white/90 truncate">
                        {chat.title}
                      </h3>
                      
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {chat.isPinned && <Pin size={10} className="text-white/30" />}
                        {chat.lastMessage && (
                          <span className="text-[14px] text-white/30">
                            {formatTime(chat.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {chat.lastMessage && (
                          <>
                            {getMessageIcon(chat.lastMessage)}
                            {getMessageStatusIcon(chat.lastMessage.status)}
                            <p className="text-[16px] text-white/40 truncate">
                              {chat.lastMessage.senderId === user?.id && 'Вы: '}
                              {chat.lastMessage.isVoice && '🎤 Голосовое сообщение'}
                              {chat.lastMessage.isPhoto && '🖼️ Фото'}
                              {chat.lastMessage.isFile && '📎 Файл'}
                              {!chat.lastMessage.isVoice && !chat.lastMessage.isPhoto && !chat.lastMessage.isFile && 
                                truncateText(chat.lastMessage.content, 45)}
                            </p>
                          </>
                        )}
                        {chat.subtitle && !chat.lastMessage && (
                          <p className="text-[13px] text-white/40 truncate">{chat.subtitle}</p>
                        )}
                      </div>
                      
                      {chat.unreadCount && chat.unreadCount > 0 && (
                        <div className="min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center px-1.5 ml-2">
                          <span className="text-[10px] font-bold text-white">
                            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                          </span>
                        </div>
                      )}
                      
                      {chat.isMuted && (
                        <Bell size={12} className="text-white/20 ml-2" />
                      )}
                    </div>
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* User Info Footer (when collapsed) */}
        {width <= 100 && user && (
          <div className="px-3 py-3 border-t border-white/5">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="relative group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} className="text-violet-400" />
                  )}
                </div>
              </button>
              
              <AnimatePresence>
                {showUserMenu && width <= 100 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -10, scale: 0.95 }}
                    className="absolute bottom-full left-0 mb-2 w-56 bg-[#1a1a1f] border border-white/10 rounded-xl shadow-2xl z-[200] overflow-hidden"
                  >
                    <div className="p-3 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                          <User size={20} className="text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user?.displayName || user?.username}
                          </p>
                          <p className="text-xs text-white/40 truncate">
                            @{user?.username}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-1">
                      {userMenuItems.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => handleUserMenuItem(item)}
                          disabled={item.action === "logout" && isLoggingOut}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {item.action === "logout" && isLoggingOut ? (
                            <Loader2 size={16} className="animate-spin text-red-400" />
                          ) : (
                            <item.icon size={16} className={item.color} />
                          )}
                          <span className="text-sm flex-1 text-left">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Create Button (only when expanded) */}
        {width > 100 && (
          <div className="p-3 border-t border-white/5">
            <button 
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all border border-dashed
                ${showCreateMenu ? 'bg-violet-500 border-violet-500 text-white' : 'hover:bg-white/5 border-white/10 text-violet-400'}`}
            >
              <Plus size={20} />
              <span className="text-sm font-medium">Создать</span>
            </button>

            <AnimatePresence>
              {showCreateMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: -70 }} 
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-20 left-3 w-56 bg-[#1a1a1f] border border-white/10 rounded-xl p-2 shadow-xl z-[110]"
                >
                  {[
                    { id: 'server', icon: ServerIcon, label: 'Сервер', color: 'text-violet-400' },
                    { id: 'group', icon: Users, label: 'Группа', color: 'text-green-400' },
                    { id: 'channel', icon: Hash, label: 'Канал', color: 'text-blue-400' }
                  ].map((opt) => (
                    <button 
                      key={opt.id}
                      onClick={() => { handleNavigation(`/create/${opt.id}`); setShowCreateMenu(false); }} 
                      className="w-full flex items-center justify-between p-2 rounded-lg transition-all hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <opt.icon size={16} className={opt.color} />
                        <span className="text-sm">{opt.label}</span>
                      </div>
                      <ChevronRight size={12} className="opacity-20" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Resize Handle */}
      <div
        className="fixed left-0 top-0 w-0.5 h-full cursor-ew-resize hover:bg-violet-500/50 transition-colors z-[1000]"
        style={{ left: width }}
        onMouseDown={startResizing}
      />

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </>
  );
}