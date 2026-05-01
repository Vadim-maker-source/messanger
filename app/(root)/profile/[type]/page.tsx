// app/profile/[type]/page.tsx - обновленная версия
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Clock,
  MessageSquare,
  Users,
  Send,
  Link as LinkIcon,
  Check,
  Settings,
  Hash,
  Activity,
  TrendingUp,
  MessageCircle,
  ChevronRight,
  Download,
  Image,
  Video,
  FileText,
  Music,
  Play,
  X,
  ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { exportHistoryWithUser, getCurrentUser, getUserProfile, getUserMediaFiles } from "@/app/lib/api/user";
import { getOrCreatePrivateChat } from "@/app/lib/api/chat";
import { useStatus } from "@/components/StatusProvider";

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl: string | null;
  bio: string | null;
  status: string | null;
  lastSeen: Date;
  createdAt: Date;
  isOnline: boolean;
  stats?: {
    messagesCount: number;
    chatsCount: number;
    serversCount: number;
    reactionsCount: number;
  };
  activity?: {
    activityByDay: Record<string, number>;
    totalMessages: number;
    mostActiveChat: {
      id: string;
      name: string;
      type: string;
      messagesCount: number;
    } | null;
    activeDays: number;
  };
  mutualChats?: Array<{
    id: string;
    name: string;
    type: string;
    imageUrl: string | null;
    lastMessage: string;
    lastMessageTime: Date;
    messagesCount: number;
    membersCount: number;
  }>;
  socialLinks?: {
    telegram?: string;
    vk?: string;
    github?: string;
    website?: string;
  } | null;
  canSeeProfileExtras?: boolean;
}

export default function UserProfilePage() {
  const { type } = useParams();
  const router = useRouter();
  const { getUserOnlineStatus, getFormattedLastSeen } = useStatus();
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "activity" | "mutual" | "media">("info");
  const [isExporting, setIsExporting] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<any>(null);
  const [mediaTab, setMediaTab] = useState<"photos" | "videos" | "files" | "audio">("photos");
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number>(0);

  // Функции для модалки медиа
  const openMediaModal = (media: any, index: number) => {
    setSelectedMedia(media);
    setSelectedMediaIndex(index);
  };

  const closeMediaModal = () => {
    setSelectedMedia(null);
  };

  const getCurrentMediaList = () => {
    if (mediaTab === "photos") return mediaFiles?.photos || [];
    if (mediaTab === "videos") return mediaFiles?.videos || [];
    return [];
  };

  const goToPrevMedia = () => {
    const list = getCurrentMediaList();
    if (list.length === 0) return;
    const newIndex = selectedMediaIndex > 0 ? selectedMediaIndex - 1 : list.length - 1;
    setSelectedMediaIndex(newIndex);
    setSelectedMedia(list[newIndex]);
  };

  const goToNextMedia = () => {
    const list = getCurrentMediaList();
    if (list.length === 0) return;
    const newIndex = selectedMediaIndex < list.length - 1 ? selectedMediaIndex + 1 : 0;
    setSelectedMediaIndex(newIndex);
    setSelectedMedia(list[newIndex]);
  };

  // Обработка клавиш для навигации
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedMedia) return;
      if (e.key === "Escape") closeMediaModal();
      if (e.key === "ArrowLeft") goToPrevMedia();
      if (e.key === "ArrowRight") goToNextMedia();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMedia, selectedMediaIndex, mediaTab, mediaFiles]);


  useEffect(() => {
    const loadData = async () => {
      try {
        // Загружаем текущего пользователя
        const current = await getCurrentUser();
        setCurrentUser(current);

        // Загружаем полный профиль пользователя
        const userData = await getUserProfile(type as string, current?.id);

        if (userData) {
          setUser(userData as UserProfile);
          setIsOwnProfile(current?.id === userData.id);
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (type) {
      loadData();
    }
  }, [type]);

  // Загружаем медиа-файлы при переключении на вкладку "Медиа"
  useEffect(() => {
    const loadMedia = async () => {
      if (activeTab === "media" && !isOwnProfile && type && !mediaFiles) {
        try {
          const media = await getUserMediaFiles(type as string);
          setMediaFiles(media);
        } catch (error) {
          console.error("Error loading media:", error);
        }
      }
    };

    loadMedia();
  }, [activeTab, type, isOwnProfile, mediaFiles]);

  const formatDate = (date: Date) => {
    if (!date) return "Неизвестно";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const formatFullDate = (date: Date) => {
    if (!date) return "Неизвестно";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatRelativeTime = (date: Date) => {
    if (!date) return "";
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    return `${days} д назад`;
  };

  const getStatusText = () => {
    if (!user) return "";
    if (user.isOnline || getUserOnlineStatus(user.id)) return "В сети";
    switch (user.status) {
      case "away": return "Отошел";
      case "busy": return "Не беспокоить";
      default: return "Не в сети";
    }
  };

  const getStatusColor = () => {
    if (!user) return "bg-gray-500";
    if (user.isOnline || getUserOnlineStatus(user.id)) return "bg-green-500";
    switch (user.status) {
      case "away": return "bg-yellow-500";
      case "busy": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const copyProfileLink = () => {
    const link = `${window.location.origin}/profile/${type}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startChat = async () => {
    try {
      const chat = await getOrCreatePrivateChat(type as string);
      router.push(`/chat/${chat.id}`);
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  const handleExportHistory = async () => {
    if (!type || isOwnProfile) return;
    try {
      setIsExporting(true);
      const data = await exportHistoryWithUser(type as string);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `history-${type}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting history:", error);
      alert("Не удалось выгрузить историю");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="text-center">
          <User size={48} className="text-white/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Пользователь не найден</h2>
          <p className="text-white/40">Возможно, аккаунт был удален</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-violet-500 rounded-xl hover:bg-violet-600 transition-colors"
          >
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  const isOnline = user.isOnline || getUserOnlineStatus(user.id);

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
          <h1 className="text-lg font-semibold">Профиль</h1>
          <div className="flex gap-1">
            <button
              onClick={copyProfileLink}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              title="Скопировать ссылку"
            >
              {copied ? <Check size={20} className="text-green-400" /> : <LinkIcon size={20} className="text-white/60" />}
            </button>
            {!isOwnProfile && (
              <button
                onClick={startChat}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                title="Написать сообщение"
              >
                <Send size={20} className="text-violet-400" />
              </button>
            )}
            {isOwnProfile && (
              <button
                onClick={() => router.push("/settings")}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                title="Настройки"
              >
                <Settings size={20} className="text-white/60" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-3xl p-8 mb-8">
          <div className="flex flex-col gap-8 items-center">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} className="w-full h-full object-cover" alt={user.displayName} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-bold">
                    {(user.displayName || user.username)[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="absolute bottom-2 right-2">
                <div className={`w-6 h-6 rounded-full border-2 border-[#0a0a0c] ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              </div>
            </div>

            {/* User Info */}
            <div className="flex flex-col text-center md:text-left items-center">
              <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold">{user.displayName || user.username}</h1>
                {isOwnProfile && (
                  <span className="px-2 py-1 bg-violet-500/20 text-violet-400 rounded-full text-xs">Это вы</span>
                )}
              </div>

              <div className="flex items-center justify-center md:justify-start gap-4 mt-4 flex-wrap">
                {!isOnline && user.lastSeen && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/40">
                      {getFormattedLastSeen(user.id)}
                    </span>
                  </div>
                )}
              </div>

              {!isOwnProfile && (
                <div className="flex justify-center md:justify-start gap-3 mt-6">
                  <button
                    onClick={startChat}
                    className="px-6 py-2 bg-violet-500 hover:bg-violet-600 rounded-xl font-medium transition-all flex items-center gap-2"
                  >
                    <MessageSquare size={18} />
                    Написать сообщение
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 mb-6">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === "info" ? "text-violet-400" : "text-white/40 hover:text-white/60"
            }`}
          >
            Информация
            {activeTab === "info" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === "activity" ? "text-violet-400" : "text-white/40 hover:text-white/60"
            }`}
          >
            Активность
            {activeTab === "activity" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("mutual")}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === "mutual" ? "text-violet-400" : "text-white/40 hover:text-white/60"
            }`}
          >
            Общие чаты {user.mutualChats && user.mutualChats.length > 0 && `(${user.mutualChats.length})`}
            {activeTab === "mutual" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400"
              />
            )}
          </button>
          {!isOwnProfile && (
            <button
              onClick={() => setActiveTab("media")}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === "media" ? "text-violet-400" : "text-white/40 hover:text-white/60"
              }`}
            >
              Медиа
              {activeTab === "media" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400"
                />
              )}
            </button>
          )}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === "info" && (
            <motion.div
              key="info"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Bio */}
              {(user.bio && user.canSeeProfileExtras !== false) && (
                <div className="bg-white/5 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <User size={18} className="text-violet-400" />
                    О себе
                  </h3>
                  <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{user.bio}</p>
                </div>
              )}

              {!!user.socialLinks && (
                <div className="bg-white/5 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <LinkIcon size={18} className="text-violet-400" />
                    Соцсети и ссылки
                  </h3>
                  <div className="space-y-2 text-sm">
                    {user.socialLinks.telegram && <p className="text-white/80">Telegram: {user.socialLinks.telegram}</p>}
                    {user.socialLinks.vk && <p className="text-white/80">VK: {user.socialLinks.vk}</p>}
                    {user.socialLinks.github && <p className="text-white/80">GitHub: {user.socialLinks.github}</p>}
                    {user.socialLinks.website && <p className="text-white/80">Website: {user.socialLinks.website}</p>}
                    {!user.socialLinks.telegram && !user.socialLinks.vk && !user.socialLinks.github && !user.socialLinks.website && (
                      <p className="text-white/40">Пользователь не добавил ссылки.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Info (only for own profile) */}
              {isOwnProfile && user.email && (
                <div className="bg-white/5 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Mail size={18} className="text-violet-400" />
                    Контактная информация
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white/80">
                      <Mail size={14} className="text-white/40" />
                      <span>{user.email}</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "activity" && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Activity Summary */}
              {user.activity && (
                <div className="bg-white/5 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity size={18} className="text-violet-400" />
                    Активность
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-violet-400">{user.activity.totalMessages}</div>
                      <div className="text-xs text-white/40">всего сообщений</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-violet-400">{user.activity.activeDays}</div>
                      <div className="text-xs text-white/40">активных дней</div>
                    </div>
                  </div>

                  {user.activity.mostActiveChat && (
                    <div className="mt-4 p-4 bg-white/5 rounded-xl">
                      <p className="text-sm text-white/60 mb-2">Самый активный чат</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {user.activity.mostActiveChat.type === 'PRIVATE' ? (
                            <User size={16} className="text-violet-400" />
                          ) : (
                            <Users size={16} className="text-green-400" />
                          )}
                          <span className="font-medium">{user.activity.mostActiveChat.name}</span>
                        </div>
                        <span className="text-sm text-violet-400">{user.activity.mostActiveChat.messagesCount} сообщений</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Detailed Activity */}
              <div className="bg-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-violet-400" />
                  Детальная активность
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Зарегистрирован</span>
                    <span className="text-white/80">{formatFullDate(user.createdAt)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Последняя активность</span>
                    <span className="text-white/80">
                      {isOnline ? "Сейчас онлайн" : formatFullDate(user.lastSeen)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-white/60">Статус</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                      <span className="text-white/80">{getStatusText()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "mutual" && (
            <motion.div
              key="mutual"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="bg-white/5 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageCircle size={18} className="text-violet-400" />
                Общие чаты
              </h3>
              {user.mutualChats && user.mutualChats.length > 0 ? (
                <div className="space-y-3">
                  {user.mutualChats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => router.push(`/chat/${chat.id}`)}
                      className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all group text-left"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        chat.type === 'PRIVATE'
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {chat.type === 'PRIVATE' ? (
                          <User size={18} />
                        ) : (
                          <Users size={18} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{chat.name}</p>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                          <span>{chat.membersCount} участников</span>
                          <span>•</span>
                          <span>{chat.messagesCount} сообщений</span>
                          {chat.lastMessageTime && (
                            <>
                              <span>•</span>
                              <span>{formatRelativeTime(chat.lastMessageTime)}</span>
                            </>
                          )}
                        </div>
                        {chat.lastMessage && (
                          <p className="text-sm text-white/60 truncate mt-1">{chat.lastMessage}</p>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-white/20 group-hover:text-white/60 transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-white/60 text-center py-8">
                  Нет общих чатов с этим пользователем
                </p>
              )}
            </motion.div>
          )}

          {activeTab === "media" && (
            <motion.div
              key="media"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Media Tabs */}
              <div className="flex gap-2 bg-white/5 rounded-xl p-1">
                <button
                  onClick={() => setMediaTab("photos")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors relative ${
                    mediaTab === "photos" ? "text-violet-400" : "text-white/60 hover:text-white/80"
                  }`}
                >
                  {mediaTab === "photos" && (
                    <motion.div
                      layoutId="mediaTabIndicator"
                      className="absolute inset-0 bg-violet-500/20 rounded-lg"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Image size={16} className="relative z-10" />
                  <span className="text-sm font-medium relative z-10">Фото</span>
                  {mediaFiles?.photos && <span className="text-xs relative z-10">({mediaFiles.photos.length})</span>}
                </button>
                <button
                  onClick={() => setMediaTab("videos")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors relative ${
                    mediaTab === "videos" ? "text-violet-400" : "text-white/60 hover:text-white/80"
                  }`}
                >
                  {mediaTab === "videos" && (
                    <motion.div
                      layoutId="mediaTabIndicator"
                      className="absolute inset-0 bg-violet-500/20 rounded-lg"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Video size={16} className="relative z-10" />
                  <span className="text-sm font-medium relative z-10">Видео</span>
                  {mediaFiles?.videos && <span className="text-xs relative z-10">({mediaFiles.videos.length})</span>}
                </button>
                <button
                  onClick={() => setMediaTab("files")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors relative ${
                    mediaTab === "files" ? "text-violet-400" : "text-white/60 hover:text-white/80"
                  }`}
                >
                  {mediaTab === "files" && (
                    <motion.div
                      layoutId="mediaTabIndicator"
                      className="absolute inset-0 bg-violet-500/20 rounded-lg"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <FileText size={16} className="relative z-10" />
                  <span className="text-sm font-medium relative z-10">Файлы</span>
                  {mediaFiles?.files && <span className="text-xs relative z-10">({mediaFiles.files.length})</span>}
                </button>
                <button
                  onClick={() => setMediaTab("audio")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors relative ${
                    mediaTab === "audio" ? "text-violet-400" : "text-white/60 hover:text-white/80"
                  }`}
                >
                  {mediaTab === "audio" && (
                    <motion.div
                      layoutId="mediaTabIndicator"
                      className="absolute inset-0 bg-violet-500/20 rounded-lg"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Music size={16} className="relative z-10" />
                  <span className="text-sm font-medium relative z-10">Аудио</span>
                  {mediaFiles?.audio && <span className="text-xs relative z-10">({mediaFiles.audio.length})</span>}
                </button>
              </div>

              {/* Media Content */}
              <div className="bg-white/5 rounded-2xl p-6">
                {!mediaFiles ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    {/* Photos Grid */}
                    {mediaTab === "photos" && (
                      <motion.div
                        key="photos"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {mediaFiles.photos.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {mediaFiles.photos.map((photo: any, index: number) => (
                              <button
                                key={photo.id}
                                onClick={() => openMediaModal(photo, index)}
                                className="aspect-square rounded-xl overflow-hidden bg-white/5 hover:ring-2 hover:ring-violet-500 transition-all group relative"
                              >
                                <img
                                  src={photo.url}
                                  alt={photo.fileName || "Photo"}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Image size={24} className="text-white" />
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-white/60 text-center py-12">Нет фотографий</p>
                        )}
                      </motion.div>
                    )}

                    {/* Videos Grid */}
                    {mediaTab === "videos" && (
                      <motion.div
                        key="videos"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {mediaFiles.videos.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {mediaFiles.videos.map((video: any, index: number) => (
                              <button
                                key={video.id}
                                onClick={() => openMediaModal(video, index)}
                                className="aspect-square rounded-xl overflow-hidden bg-white/5 hover:ring-2 hover:ring-violet-500 transition-all group relative"
                              >
                                <video
                                  src={video.url}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <Play size={48} className="text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-white/60 text-center py-12">Нет видео</p>
                        )}
                      </motion.div>
                    )}

                    {/* Files List */}
                    {mediaTab === "files" && (
                      <motion.div
                        key="files"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {mediaFiles.files.length > 0 ? (
                          <div className="space-y-2">
                            {mediaFiles.files.map((file: any) => (
                              <a
                                key={file.id}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-4 bg-white/5 rounded-xl hover:bg-violet-500/10 transition-all group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                                  <FileText size={20} className="text-violet-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{file.fileName || "Файл"}</p>
                                  <p className="text-xs text-white/40">
                                    {formatDate(file.createdAt)}
                                  </p>
                                </div>
                                <Download size={18} className="text-white/40 group-hover:text-violet-400 transition-colors" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-white/60 text-center py-12">Нет файлов</p>
                        )}
                      </motion.div>
                    )}

                    {/* Audio List */}
                    {mediaTab === "audio" && (
                      <motion.div
                        key="audio"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {mediaFiles.audio.length > 0 ? (
                          <div className="space-y-2">
                            {mediaFiles.audio.map((audio: any) => (
                              <div
                                key={audio.id}
                                className="flex items-center gap-3 p-4 bg-white/5 rounded-xl"
                              >
                                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                                  <Music size={20} className="text-violet-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{audio.fileName || "Аудио"}</p>
                                  <p className="text-xs text-white/40">
                                    {formatDate(audio.createdAt)}
                                  </p>
                                </div>
                                <audio src={audio.url} controls className="max-w-xs" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-white/60 text-center py-12">Нет аудио</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Media Modal */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={closeMediaModal}
          >
            {/* Close Button */}
            <button
              onClick={closeMediaModal}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            >
              <X size={24} className="text-white" />
            </button>

            {/* Navigation Buttons */}
            {getCurrentMediaList().length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevMedia();
                  }}
                  className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                >
                  <ChevronLeft size={32} className="text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNextMedia();
                  }}
                  className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                >
                  <ChevronRight size={32} className="text-white" />
                </button>
              </>
            )}

            {/* Media Content */}
            <motion.div
              key={selectedMedia.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {mediaTab === "photos" ? (
                <img
                  src={selectedMedia.url}
                  alt={selectedMedia.fileName || "Photo"}
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
              ) : (
                <video
                  src={selectedMedia.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
              )}
            </motion.div>

            {/* Media Info */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur px-4 py-2 rounded-full">
              <p className="text-white/80 text-sm">
                {selectedMediaIndex + 1} / {getCurrentMediaList().length}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}