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
  Search
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
  const isServerChannel = !!chat.serverId;
  
  // Показываем управление инвайтами для всех не-приватных чатов (группы, каналы, серверы)
  const showInvites = !isPrivate && isAdmin;

  const partner = isPrivate ? chat.users?.find((u: any) => u.id !== currentUser.id) : null;

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
      {/* Header */}
      <div className="border-b border-white/5 bg-[#121214]/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} className="text-white/60" />
          </button>
          <h1 className="text-lg font-semibold">Информация</h1>
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
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-[#121214] border border-white/10 rounded-xl shadow-xl overflow-hidden z-20"
                >
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-sm"
                  >
                    <Edit3 size={16} />
                    Редактировать
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-sm text-red-400"
                  >
                    <Trash2 size={16} />
                    Удалить
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Avatar and Title */}
        <div className="flex flex-col items-center text-center mb-8">
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
                name={chat.name || (isChannel ? "Канал" : "Группа")}
                isOnline={false}
                size="lg"
                showStatus={false}
              />
              {isEditing && isAdmin && (
                <button
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-violet-500 rounded-full hover:bg-violet-600 transition-colors"
                >
                  <Edit3 size={14} />
                </button>
              )}
              <input id="avatar-upload" type="file" className="hidden" />
            </div>
          )}

          {isEditing && isAdmin && !isPrivate ? (
            <div className="mt-4 w-full max-w-md">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full text-center text-2xl font-bold bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-violet-500"
              />
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Описание..."
                rows={3}
                className="w-full mt-2 text-white/60 bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-violet-500 resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    // TODO: save changes
                    setIsEditing(false);
                  }}
                  className="flex-1 px-4 py-2 bg-violet-500 rounded-xl hover:bg-violet-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mt-4">
                {isPrivate ? partner?.displayName || partner?.username : chat.name || (isChannel ? "Канал" : "Группа")}
              </h2>
              
              {isPrivate && partner && (
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-2 h-2 rounded-full ${partnerStatus.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                  <p className="text-sm text-white/60">
                    {partnerStatus.isOnline ? "В сети" : `был(а) ${formatLastSeen(partner.lastSeen)}`}
                  </p>
                </div>
              )}
              
              {chat.description && (
                <p className="text-white/60 mt-2 max-w-md">{chat.description}</p>
              )}
            </>
          )}
        </div>

        {/* Info Cards - остальные карточки как были */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              {isPrivate ? (
                <User size={18} className="text-violet-400" />
              ) : isGroup ? (
                <Users size={18} className="text-green-400" />
              ) : isChannel ? (
                <Hash size={18} className="text-blue-400" />
              ) : (
                <Server size={18} className="text-violet-400" />
              )}
              <h3 className="font-medium">Тип</h3>
            </div>
            <p className="text-white/80">
              {isPrivate ? "Личный чат" : isGroup ? "Группа" : isChannel ? "Канал" : "Сервер"}
            </p>
            {!isPrivate && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                {getAccessIcon()}
                <span className="text-white/60">{getAccessText()}</span>
              </div>
            )}
          </div>

          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-violet-400" />
              <h3 className="font-medium">Участники</h3>
            </div>
            <p className="text-2xl font-bold">{chat._count?.users || chat.members?.length || 0}</p>
            <p className="text-white/60 text-sm mt-1">
              {chat._count?.messages || 0} сообщений
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={18} className="text-blue-400" />
              <h3 className="font-medium">Создан</h3>
            </div>
            <p className="text-white/80">{formatDate(chat.createdAt)}</p>
            <p className="text-white/60 text-sm">{formatTime(chat.createdAt)}</p>
          </div>
        </div>

        {/* InviteManager Component - только для групп, каналов и серверов */}
        {showInvites && (
          <div className="mb-8">
            <InviteManager 
              chatId={chat.id} 
              chatName={chat.name || ""}
              chatType={chat.type}
            />
          </div>
        )}

        {/* Members List - остальные секции... */}
        {!isPrivate && chat.members?.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Users size={20} className="text-violet-400" />
              <h3 className="text-lg font-semibold">Участники</h3>
              <span className="text-white/40 text-sm">{chat.members.length}</span>
            </div>
            <div className="space-y-2">
              {chat.members.map((member: any) => {
                const isCreator = member.role === "CREATOR";
                const isAdminUser = member.role === "ADMIN";
                const user = member.user;
                const isUserOnline = getUserOnlineStatus(user.id);
                
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <AvatarWithStatus 
                      src={user.avatarUrl}
                      name={user.displayName || user.username}
                      isOnline={isUserOnline}
                      size="sm"
                      showStatus={true}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{user.displayName || user.username}</p>
                        {isCreator && (
                          <Crown size={14} className="text-yellow-500" />
                        )}
                        {isAdminUser && !isCreator && (
                          <Shield size={14} className="text-violet-500" />
                        )}
                      </div>
                      <p className="text-xs text-white/40">@{user.username}</p>
                    </div>
                    {isCreator && (
                      <span className="text-xs text-yellow-500">Создатель</span>
                    )}
                    {isAdminUser && !isCreator && (
                      <span className="text-xs text-violet-500">Админ</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Private Chat Info */}
        {isPrivate && partner && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <User size={20} className="text-violet-400" />
              <h3 className="text-lg font-semibold">Информация о собеседнике</h3>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 space-y-4">
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
                <div>
                  <p className="text-sm text-white/60 mb-1">О себе</p>
                  <p className="text-white/80">{partner.bio}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs text-white/40 mb-1">Присоединился</p>
                  <p className="text-sm">{formatDate(partner.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">ID пользователя</p>
                  <p className="text-sm text-white/60">{partner.id.slice(0, 8)}...</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Server Channels */}
        {isServerChannel && subChats.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Hash size={20} className="text-blue-400" />
              <h3 className="text-lg font-semibold">Каналы и группы сервера</h3>
              <span className="text-white/40 text-sm">{subChats.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {subChats.map((subChat: any) => (
                <button
                  key={subChat.id}
                  onClick={() => router.push(`/chat/${subChat.id}`)}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
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
                      <p className="font-medium">{subChat.name}</p>
                      <p className="text-xs text-white/40">
                        {subChat.type === "CHANNEL" ? "Канал" : "Группа"} • {subChat._count?.users || 0} участников
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-white/20 group-hover:text-white/60 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[#121214] border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <DialogTitle className="text-xl font-semibold text-white">
                {dialogContent.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-white/60 pt-4">
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="flex gap-3 sm:gap-0 mt-6">
            <button
              onClick={() => setDeleteDialogOpen(false)}
              className="flex-1 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  Удаление...
                </>
              ) : (
                dialogContent.confirmText
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}