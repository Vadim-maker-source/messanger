"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  MessageSquare,
  Hash,
  Lock,
  Globe,
  Link,
  Copy,
  Check,
  Edit3,
  Trash2,
  User,
  Calendar,
  Clock,
  Shield,
  Crown,
  MoreVertical,
  X,
  Save,
  Server,
  ChevronRight,
  AlertTriangle,
  Home,
  Search,
  UserPlus,
  UserMinus,
  Settings,
  Bell,
  BellOff,
  Pin,
  Archive,
  LogOut,
  Ban
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStatus } from "./StatusProvider";
import { deleteChat } from "@/app/lib/api/chat";
import InviteManager from "./InviteManager";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChatSettingsProps {
  chat: any;
  currentUser: any;
  isAdmin: boolean;
  subChats: any[];
  onChatDeleted?: () => void;
}

export default function ChatSettings({ chat, currentUser, isAdmin, subChats, onChatDeleted }: ChatSettingsProps) {
  const router = useRouter();
  const { getUserOnlineStatus, getFormattedLastSeen } = useStatus();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(chat.name || "");
  const [editedDescription, setEditedDescription] = useState(chat.description || "");
  const [showMenu, setShowMenu] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<{ isOnline: boolean; lastSeen: Date | null }>({ isOnline: false, lastSeen: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberActionDialog, setMemberActionDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Если чат не найден, показываем красивую страницу 404
  if (!chat) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0c] to-[#050508] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 20 }}
          className="max-w-md w-full"
        >
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, -5, 5, -5, 0]
            }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 3
            }}
            className="text-center mb-6"
          >
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <Search size={64} className="text-violet-400" strokeWidth={1.5} />
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <h1 className="text-4xl font-black mb-3 bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              Чат не найден
            </h1>
            <p className="text-white/60 mb-6">
              К сожалению, запрашиваемый чат не существует или был удалён.
              Возможно, вы перешли по неверной ссылке.
            </p>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={() => router.push("/")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl font-medium hover:from-violet-600 hover:to-purple-600 transition-all shadow-lg shadow-violet-500/20"
              >
                <Home size={18} />
                На главную
              </button>
            </motion.div>
          </motion.div>

          {/* Декоративные элементы */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        </motion.div>
      </div>
    );
  }

  const isPrivate = chat.type === "PRIVATE";
  const isGroup = chat.type === "GROUP";
  const isChannel = chat.type === "CHANNEL";
  const isServer = chat.type === "SERVER";
  const isServerChannel = !!chat.serverId;

  // Показываем управление инвайтами для всех не-приватных чатов (группы, каналы, серверы)
  const showInvites = !isPrivate && isAdmin;

  const partner = isPrivate ? chat.users?.find((u: any) => u.id !== currentUser.id) : null;

  // Фильтрация участников по поисковому запросу
  const filteredMembers = chat.members?.filter((member: any) => {
    if (!searchQuery) return true;
    const user = member.user;
    const query = searchQuery.toLowerCase();
    return (
      user.displayName?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query)
    );
  }) || [];

  const handleMemberAction = (member: any, action: string) => {
    setSelectedMember({ ...member, action });
    setMemberActionDialog(true);
  };

  const handleMemberActionConfirm = async () => {
    if (!selectedMember) return;

    try {
      // TODO: Implement member actions (kick, ban, promote, demote)
      console.log(`Action ${selectedMember.action} for member ${selectedMember.user.id}`);
      setMemberActionDialog(false);
      setSelectedMember(null);
    } catch (error) {
      console.error("Error performing member action:", error);
    }
  };

  // Получаем статус партнера в реальном времени
  useEffect(() => {
    if (!partner) return;
    
    const updateStatus = () => {
      const isOnline = getUserOnlineStatus(partner.id);
      setPartnerStatus({
        isOnline,
        lastSeen: null
      });
    };
    
    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, [partner, getUserOnlineStatus]);

  const formatDate = (date: Date) => {
    if (!date) return "Неизвестно";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const formatTime = (date: Date) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatLastSeen = (lastSeen: Date | null) => {
    if (!lastSeen) return "был(а) недавно";
    
    const now = new Date();
    const last = new Date(lastSeen);
    const diff = now.getTime() - last.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} д. назад`;
    return last.toLocaleDateString();
  };

  const getAccessIcon = () => {
    switch (chat.access) {
      case "PUBLIC": return <Globe size={16} className="text-green-400" />;
      case "LINK_ONLY": return <Link size={16} className="text-yellow-400" />;
      case "PRIVATE": return <Lock size={16} className="text-red-400" />;
      default: return <Globe size={16} />;
    }
  };

  const getAccessText = () => {
    switch (chat.access) {
      case "PUBLIC": return "Публичный";
      case "LINK_ONLY": return "По ссылке";
      case "PRIVATE": return "Приватный";
      default: return "Неизвестно";
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    setShowMenu(false);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteChat(chat.id);
      if (onChatDeleted) {
        onChatDeleted();
      }
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert(error instanceof Error ? error.message : "Ошибка при удалении чата");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const AvatarWithStatus = ({ 
    src, 
    name, 
    isOnline = false, 
    size = "lg",
    showStatus = true 
  }: { 
    src?: string | null; 
    name?: string; 
    isOnline?: boolean;
    size?: "sm" | "md" | "lg";
    showStatus?: boolean;
  }) => {
    const sizeClasses = {
      sm: "w-12 h-12 text-lg",
      md: "w-20 h-20 text-2xl",
      lg: "w-32 h-32 text-4xl"
    };
    
    const statusSize = {
      sm: "w-3 h-3",
      md: "w-4 h-4",
      lg: "w-5 h-5"
    };
    
    const avatarContent = src ? (
      <img src={src} alt={name || "Avatar"} className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full flex items-center justify-center font-bold bg-gradient-to-br from-violet-500/20 to-purple-500/20">
        {(name?.[0] || "💬").toUpperCase()}
      </div>
    );
    
    return (
      <div className="relative inline-block">
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gradient-to-br from-violet-500/20 to-purple-500/20`}>
          {avatarContent}
        </div>
        {showStatus && (
          <div 
            className={`absolute bottom-0 right-0 ${statusSize[size]} rounded-full border-2 border-[#0a0a0c] ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
            title={isOnline ? "В сети" : "Не в сети"}
          />
        )}
      </div>
    );
  };

  const getDeleteDialogContent = () => {
    if (isPrivate) {
      return {
        title: "Удалить чат?",
        description: "Вы уверены, что хотите удалить этот чат? Восстановить его будет невозможно. Вся история переписки будет потеряна навсегда.",
        confirmText: "Удалить чат",
        variant: "destructive"
      };
    } else if (isGroup) {
      return {
        title: `Удалить группу "${chat.name}"?`,
        description: "Вы уверены, что хотите удалить эту группу? Все сообщения будут удалены без возможности восстановления. Участники потеряют доступ к группе.",
        confirmText: "Удалить группу",
        variant: "destructive"
      };
    } else if (isChannel) {
      return {
        title: `Удалить канал "${chat.name}"?`,
        description: "Вы уверены, что хотите удалить этот канал? Все сообщения будут удалены без возможности восстановления.",
        confirmText: "Удалить канал",
        variant: "destructive"
      };
    } else {
      return {
        title: `Удалить чат "${chat.name}"?`,
        description: "Вы уверены, что хотите удалить этот чат? Все сообщения будут удалены без возможности восстановления.",
        confirmText: "Удалить чат",
        variant: "destructive"
      };
    }
  };

  const dialogContent = getDeleteDialogContent();

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      {/* Header - Telegram Style */}
      <div className="border-b border-white/5 bg-[#121214]/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors"
            >
              <ArrowLeft size={22} className="text-white/60" />
            </button>
            <div>
              <h1 className="text-lg font-semibold">
                {isPrivate ? "Информация" : isServer ? "Управление сервером" : "Информация о чате"}
              </h1>
              {!isPrivate && (
                <p className="text-xs text-white/40">
                  {chat._count?.users || 0} участников
                </p>
              )}
            </div>
          </div>
          <div className="relative">
            {isAdmin && !isPrivate && (
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <MoreVertical size={20} className="text-white/60" />
              </button>
            )}
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-[#1a1a1f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20"
                >
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-sm"
                    >
                      <Edit3 size={18} className="text-blue-400" />
                      <span>Редактировать</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        // TODO: Add channel/group
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-sm"
                    >
                      <Hash size={18} className="text-green-400" />
                      <span>Добавить канал</span>
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button
                      onClick={handleDeleteClick}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 rounded-xl transition-colors text-sm text-red-400"
                    >
                      <Trash2 size={18} />
                      <span>Удалить {isServer ? "сервер" : isGroup ? "группу" : "канал"}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Avatar and Title - Telegram Style */}
        <div className="bg-[#121214]/50 rounded-3xl p-6 mb-4">
          <div className="flex flex-col items-center text-center">
            {isPrivate && partner ? (
              <AvatarWithStatus
                src={partner.avatarUrl}
                name={partner.displayName || partner.username}
                isOnline={partnerStatus.isOnline}
                size="lg"
                showStatus={true}
              />
            ) : (
              <div className="relative">
                <AvatarWithStatus
                  src={chat.imageUrl}
                  name={chat.name || (isChannel ? "Канал" : isServer ? "Сервер" : "Группа")}
                  isOnline={false}
                  size="lg"
                  showStatus={false}
                />
                {isEditing && isAdmin && (
                  <button
                    onClick={() => document.getElementById("avatar-upload")?.click()}
                    className="absolute bottom-0 right-0 p-3 bg-violet-500 rounded-full hover:bg-violet-600 transition-colors shadow-lg"
                  >
                    <Edit3 size={16} />
                  </button>
                )}
                <input id="avatar-upload" type="file" className="hidden" accept="image/*" />
              </div>
            )}

            {isEditing && isAdmin && !isPrivate ? (
              <div className="mt-6 w-full max-w-md space-y-3">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Название"
                  className="w-full text-center text-2xl font-bold bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-violet-500 transition-colors"
                />
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Описание..."
                  rows={3}
                  className="w-full text-center text-white/60 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-violet-500 resize-none transition-colors"
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 px-4 py-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors font-medium"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      // TODO: save changes
                      setIsEditing(false);
                    }}
                    className="flex-1 px-4 py-3 bg-violet-500 rounded-2xl hover:bg-violet-600 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Save size={18} />
                    Сохранить
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold mt-6">
                  {isPrivate ? partner?.displayName || partner?.username : chat.name || (isChannel ? "Канал" : isServer ? "Сервер" : "Группа")}
                </h2>

                {isPrivate && partner && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${partnerStatus.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                    <p className="text-sm text-white/60">
                      {partnerStatus.isOnline ? "В сети" : `был(а) ${formatLastSeen(partner.lastSeen)}`}
                    </p>
                  </div>
                )}

                {!isPrivate && (
                  <p className="text-white/40 mt-2">
                    {chat._count?.users || 0} участников • {chat._count?.messages || 0} сообщений
                  </p>
                )}

                {chat.description && (
                  <p className="text-white/60 mt-4 max-w-md leading-relaxed">{chat.description}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Actions - Telegram Style */}
        {!isPrivate && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <button
              onClick={() => {/* TODO: Add member */}}
              className="bg-[#121214]/50 hover:bg-[#121214] rounded-2xl p-4 transition-all group"
            >
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
                <UserPlus size={20} className="text-violet-400" />
              </div>
              <p className="text-sm font-medium">Добавить</p>
            </button>

            <button
              onClick={() => {/* TODO: Notifications */}}
              className="bg-[#121214]/50 hover:bg-[#121214] rounded-2xl p-4 transition-all group"
            >
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                <Bell size={20} className="text-blue-400" />
              </div>
              <p className="text-sm font-medium">Уведомления</p>
            </button>

            <button
              onClick={() => {/* TODO: Search */}}
              className="bg-[#121214]/50 hover:bg-[#121214] rounded-2xl p-4 transition-all group"
            >
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                <Search size={20} className="text-green-400" />
              </div>
              <p className="text-sm font-medium">Поиск</p>
            </button>

            {isAdmin && (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-[#121214]/50 hover:bg-[#121214] rounded-2xl p-4 transition-all group"
              >
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
                  <Settings size={20} className="text-orange-400" />
                </div>
                <p className="text-sm font-medium">Настройки</p>
              </button>
            )}
          </div>
        )}

        {/* Info Cards - Telegram Style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-[#121214]/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              {isPrivate ? (
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <User size={18} className="text-violet-400" />
                </div>
              ) : isGroup ? (
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Users size={18} className="text-green-400" />
                </div>
              ) : isChannel ? (
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Hash size={18} className="text-blue-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <Server size={18} className="text-violet-400" />
                </div>
              )}
              <h3 className="font-semibold">Тип</h3>
            </div>
            <p className="text-white/80 text-lg font-medium">
              {isPrivate ? "Личный чат" : isGroup ? "Группа" : isChannel ? "Канал" : "Сервер"}
            </p>
            {!isPrivate && (
              <div className="flex items-center gap-2 mt-3 text-sm">
                {getAccessIcon()}
                <span className="text-white/60">{getAccessText()}</span>
              </div>
            )}
          </div>

          <div className="bg-[#121214]/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Users size={18} className="text-violet-400" />
              </div>
              <h3 className="font-semibold">Участники</h3>
            </div>
            <p className="text-3xl font-bold text-white/90">{chat._count?.users || chat.members?.length || 0}</p>
            <p className="text-white/40 text-sm mt-1">
              {chat._count?.messages || 0} сообщений
            </p>
          </div>

          <div className="bg-[#121214]/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Calendar size={18} className="text-blue-400" />
              </div>
              <h3 className="font-semibold">Создан</h3>
            </div>
            <p className="text-white/80 font-medium">{formatDate(chat.createdAt)}</p>
            <p className="text-white/40 text-sm mt-1">{formatTime(chat.createdAt)}</p>
          </div>
        </div>

        {/* InviteManager Component - только для групп, каналов и серверов */}
        {showInvites && (
          <div className="mb-4">
            <InviteManager
              chatId={chat.id}
              chatName={chat.name || ""}
              chatType={chat.type}
            />
          </div>
        )}

        {/* Server Channels - если это сервер */}
        {(isServer || isServerChannel) && subChats.length > 0 && (
          <div className="mb-4">
            <div className="bg-[#121214]/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Hash size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Каналы сервера</h3>
                    <p className="text-xs text-white/40">{subChats.length} каналов</p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {/* TODO: Add channel */}}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <Hash size={18} className="text-violet-400" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {subChats.map((subChat: any) => (
                  <button
                    key={subChat.id}
                    onClick={() => router.push(`/chat/${subChat.id}`)}
                    className="w-full flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        subChat.type === "CHANNEL"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-green-500/20 text-green-400"
                      }`}>
                        {subChat.type === "CHANNEL" ? (
                          <Hash size={18} />
                        ) : (
                          <MessageSquare size={18} />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-white/90">{subChat.name}</p>
                        <p className="text-xs text-white/40">
                          {subChat.type === "CHANNEL" ? "Канал" : "Группа"} • {subChat._count?.users || 0} участников
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-white/20 group-hover:text-white/60 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Members List - остальные секции... */}
        {!isPrivate && chat.members?.length > 0 && (
          <div className="mb-4">
            <div className="bg-[#121214]/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <Users size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Участники</h3>
                    <p className="text-xs text-white/40">{chat.members.length} участников</p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {/* TODO: Add member */}}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <UserPlus size={18} className="text-violet-400" />
                  </button>
                )}
              </div>

              {/* Search Members */}
              {chat.members.length > 5 && (
                <div className="mb-4">
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Поиск участников..."
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-violet-500 transition-colors text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1 max-h-96 overflow-y-auto custom-scrollbar">
                {filteredMembers.map((member: any) => {
                  const isCreator = member.role === "CREATOR";
                  const isAdminUser = member.role === "ADMIN";
                  const user = member.user;
                  const isUserOnline = getUserOnlineStatus(user.id);
                  const isCurrentUser = user.id === currentUser.id;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                    >
                      <AvatarWithStatus
                        src={user.avatarUrl}
                        name={user.displayName || user.username}
                        isOnline={isUserOnline}
                        size="sm"
                        showStatus={true}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{user.displayName || user.username}</p>
                          {isCreator && (
                            <Crown size={14} className="text-yellow-500 shrink-0" />
                          )}
                          {isAdminUser && !isCreator && (
                            <Shield size={14} className="text-violet-500 shrink-0" />
                          )}
                          {isCurrentUser && (
                            <span className="text-xs text-white/40">(вы)</span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 truncate">@{user.username}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCreator && (
                          <span className="text-xs text-yellow-500 font-medium px-2 py-1 bg-yellow-500/10 rounded-lg">
                            Создатель
                          </span>
                        )}
                        {isAdminUser && !isCreator && (
                          <span className="text-xs text-violet-500 font-medium px-2 py-1 bg-violet-500/10 rounded-lg">
                            Админ
                          </span>
                        )}
                        {isAdmin && !isCurrentUser && (
                          <button
                            onClick={() => setSelectedMember(member)}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical size={16} className="text-white/40" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Private Chat Info */}
        {isPrivate && partner && (
          <div className="mb-4">
            <div className="bg-[#121214]/50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <User size={18} className="text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold">Информация о собеседнике</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <AvatarWithStatus
                    src={partner.avatarUrl}
                    name={partner.displayName || partner.username}
                    isOnline={partnerStatus.isOnline}
                    size="md"
                    showStatus={true}
                  />
                  <div>
                    <h4 className="text-xl font-semibold">{partner.displayName || partner.username}</h4>
                    <p className="text-white/40">@{partner.username}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${partnerStatus.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                      <p className="text-xs text-white/60">
                        {partnerStatus.isOnline ? "В сети" : `был(а) ${formatLastSeen(partner.lastSeen)}`}
                      </p>
                    </div>
                  </div>
                </div>

                {partner.bio && (
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-sm text-white/60 mb-2">О себе</p>
                    <p className="text-white/80">{partner.bio}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-white/40 mb-1">Присоединился</p>
                    <p className="text-sm font-medium">{formatDate(partner.createdAt)}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-white/40 mb-1">ID пользователя</p>
                    <p className="text-sm text-white/60 font-mono">{partner.id.slice(0, 8)}...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone - Telegram Style */}
        {!isPrivate && (
          <div className="mb-4">
            <div className="bg-[#121214]/50 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-4 text-red-400">Опасная зона</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {/* TODO: Leave chat */}}
                  className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-red-500/10 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <LogOut size={18} className="text-red-400" />
                    <span className="text-red-400 font-medium">Покинуть {isServer ? "сервер" : isGroup ? "группу" : "канал"}</span>
                  </div>
                  <ChevronRight size={18} className="text-red-400/40 group-hover:text-red-400/80 transition-colors" />
                </button>

                {isAdmin && (
                  <button
                    onClick={handleDeleteClick}
                    className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-red-500/10 rounded-xl transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Trash2 size={18} className="text-red-400" />
                      <span className="text-red-400 font-medium">Удалить {isServer ? "сервер" : isGroup ? "группу" : "канал"}</span>
                    </div>
                    <ChevronRight size={18} className="text-red-400/40 group-hover:text-red-400/80 transition-colors" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[#121214] border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <DialogTitle className="text-xl font-semibold text-white">
                {dialogContent.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-white/60 pt-4 leading-relaxed">
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-3 sm:gap-0 mt-6">
            <button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors font-medium disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  Удаление...
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  {dialogContent.confirmText}
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Action Dialog */}
      <AnimatePresence>
        {selectedMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
            onClick={() => setSelectedMember(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#1a1a1f] rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <AvatarWithStatus
                    src={selectedMember.user.avatarUrl}
                    name={selectedMember.user.displayName || selectedMember.user.username}
                    isOnline={getUserOnlineStatus(selectedMember.user.id)}
                    size="md"
                    showStatus={true}
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{selectedMember.user.displayName || selectedMember.user.username}</h3>
                    <p className="text-sm text-white/40">@{selectedMember.user.username}</p>
                  </div>
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <X size={20} className="text-white/40" />
                  </button>
                </div>
              </div>

              <div className="p-2">
                {selectedMember.role !== "CREATOR" && (
                  <>
                    <button
                      onClick={() => handleMemberAction(selectedMember, 'promote')}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <Shield size={18} className="text-violet-400" />
                      <span>Назначить администратором</span>
                    </button>
                    <button
                      onClick={() => handleMemberAction(selectedMember, 'kick')}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-500/10 rounded-xl transition-colors text-orange-400"
                    >
                      <UserMinus size={18} />
                      <span>Удалить из {isServer ? "сервера" : isGroup ? "группы" : "канала"}</span>
                    </button>
                    <button
                      onClick={() => handleMemberAction(selectedMember, 'ban')}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 rounded-xl transition-colors text-red-400"
                    >
                      <Ban size={18} />
                      <span>Заблокировать</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    router.push(`/profile/${selectedMember.user.id}`);
                    setSelectedMember(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <User size={18} className="text-blue-400" />
                  <span>Открыть профиль</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}