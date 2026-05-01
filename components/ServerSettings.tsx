"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Hash,
  Lock,
  Globe,
  Link,
  Edit3,
  Trash2,
  User,
  Calendar,
  Shield,
  Crown,
  MoreVertical,
  X,
  Save,
  Server,
  ChevronRight,
  AlertTriangle,
  Search,
  UserPlus,
  Settings,
  LogOut,
  Camera,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStatus } from "./StatusProvider";
import InviteManager from "./InviteManager";
import { updateServer, createServerChannel, deleteServer, deleteChat } from "@/app/lib/api/chat";
import { uploadChatImage } from "@/app/lib/yandex-storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ServerSettingsProps {
  server: any;
  currentUser: any;
  isAdmin: boolean;
}

export default function ServerSettings({ server, currentUser, isAdmin }: ServerSettingsProps) {
  const router = useRouter();
  const { getUserOnlineStatus } = useStatus();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(server.name || "");
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(server.imageUrl);
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"CHANNEL" | "GROUP">("CHANNEL");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот канал? Все сообщения будут удалены.")) {
      return;
    }

    setDeletingChannelId(channelId);
    try {
      await deleteChat(channelId);
      router.refresh();
    } catch (error) {
      console.error("Error deleting channel:", error);
      alert(error instanceof Error ? error.message : "Ошибка при удалении канала");
    } finally {
      setDeletingChannelId(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let imageUrl = server.imageUrl;

      // Загружаем новое изображение, если оно выбрано
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        const uploadResult = await uploadChatImage(formData);
        imageUrl = uploadResult?.url || imageUrl;
      }

      // Обновляем сервер
      await updateServer(server.id, {
        name: editedName,
        imageUrl: imageUrl || undefined
      });

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("Error updating server:", error);
      alert(error instanceof Error ? error.message : "Ошибка при обновлении сервера");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      alert("Введите название канала");
      return;
    }

    setIsCreatingChannel(true);
    try {
      await createServerChannel(server.id, {
        name: newChannelName,
        type: newChannelType
      });

      setShowChannelDialog(false);
      setNewChannelName("");
      setNewChannelType("CHANNEL");
      router.refresh();
    } catch (error) {
      console.error("Error creating channel:", error);
      alert(error instanceof Error ? error.message : "Ошибка при создании канала");
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteServer(server.id);
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error deleting server:", error);
      alert(error instanceof Error ? error.message : "Ошибка при удалении сервера");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

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

  const getAccessIcon = () => {
    switch (server.access) {
      case "PUBLIC": return <Globe size={16} className="text-green-400" />;
      case "LINK_ONLY": return <Link size={16} className="text-yellow-400" />;
      case "PRIVATE": return <Lock size={16} className="text-red-400" />;
      default: return <Globe size={16} />;
    }
  };

  const getAccessText = () => {
    switch (server.access) {
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
        {(name?.[0] || "S").toUpperCase()}
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

  const filteredMembers = server.members?.filter((member: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.displayName?.toLowerCase().includes(query) ||
      member.username?.toLowerCase().includes(query)
    );
  }) || [];

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      {/* Header */}
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
              <h1 className="text-lg font-semibold">Управление сервером</h1>
              <p className="text-xs text-white/40">
                {server._count?.members || 0} участников • {server._count?.chats || 0} каналов
              </p>
            </div>
          </div>
          <div className="relative">
            {isAdmin && (
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
                        setShowChannelDialog(true);
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
                      <span>Удалить сервер</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Server Avatar and Title */}
        <div className="bg-[#121214]/50 rounded-3xl p-6 mb-4">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <AvatarWithStatus
                src={imagePreview}
                name={server.name}
                isOnline={false}
                size="lg"
                showStatus={false}
              />
              {isEditing && isAdmin && (
                <>
                  <button
                    onClick={() => document.getElementById("server-avatar-upload")?.click()}
                    className="absolute bottom-0 right-0 p-3 bg-violet-500 rounded-full hover:bg-violet-600 transition-colors shadow-lg"
                  >
                    <Camera size={16} />
                  </button>
                  <input
                    id="server-avatar-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </>
              )}
            </div>

            {isEditing && isAdmin ? (
              <div className="mt-6 w-full max-w-md space-y-3">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Название сервера"
                  className="w-full text-center text-2xl font-bold bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-violet-500 transition-colors"
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedName(server.name);
                      setImagePreview(server.imageUrl);
                      setImageFile(null);
                    }}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors font-medium disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-violet-500 rounded-2xl hover:bg-violet-600 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Сохранить
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold mt-6">{server.name}</h2>
                <p className="text-white/40 mt-2">
                  {server._count?.members || 0} участников • {server._count?.chats || 0} каналов
                </p>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
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
            onClick={() => setShowChannelDialog(true)}
            className="bg-[#121214]/50 hover:bg-[#121214] rounded-2xl p-4 transition-all group"
          >
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <Hash size={20} className="text-blue-400" />
            </div>
            <p className="text-sm font-medium">Канал</p>
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

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-[#121214]/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Server size={18} className="text-violet-400" />
              </div>
              <h3 className="font-semibold">Тип</h3>
            </div>
            <p className="text-white/80 text-lg font-medium">Сервер</p>
            <div className="flex items-center gap-2 mt-3 text-sm">
              {getAccessIcon()}
              <span className="text-white/60">{getAccessText()}</span>
            </div>
          </div>

          <div className="bg-[#121214]/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Users size={18} className="text-violet-400" />
              </div>
              <h3 className="font-semibold">Участники</h3>
            </div>
            <p className="text-3xl font-bold text-white/90">{server._count?.members || 0}</p>
            <p className="text-white/40 text-sm mt-1">
              {server._count?.chats || 0} каналов
            </p>
          </div>

          <div className="bg-[#121214]/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Calendar size={18} className="text-blue-400" />
              </div>
              <h3 className="font-semibold">Создан</h3>
            </div>
            <p className="text-white/80 font-medium">{formatDate(server.createdAt)}</p>
            <p className="text-white/40 text-sm mt-1">{formatTime(server.createdAt)}</p>
          </div>
        </div>

        {/* Invite Manager */}
        {isAdmin && (
          <div className="mb-4">
            <InviteManager
              serverId={server.id}
              chatName={server.name}
              chatType="SERVER"
            />
          </div>
        )}

        {/* Server Channels */}
        {server.chats && server.chats.length > 0 && (
          <div className="mb-4">
            <div className="bg-[#121214]/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Hash size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Каналы</h3>
                    <p className="text-xs text-white/40">{server.chats.length} каналов</p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setShowChannelDialog(true)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <Hash size={18} className="text-violet-400" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {server.chats.map((chat: any) => (
                  <div
                    key={chat.id}
                    className="w-full flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all group"
                  >
                    <button
                      onClick={() => router.push(`/chat/${chat.id}`)}
                      className="flex items-center gap-3 flex-1"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        chat.type === "CHANNEL"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-green-500/20 text-green-400"
                      }`}>
                        {chat.type === "CHANNEL" ? (
                          <Hash size={18} />
                        ) : (
                          <MessageSquare size={18} />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-white/90">{chat.name}</p>
                        <p className="text-xs text-white/40">
                          {chat.type === "CHANNEL" ? "Канал" : "Группа"} • {chat._count?.users || 0} участников
                        </p>
                      </div>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteChannel(chat.id)}
                        disabled={deletingChannelId === chat.id}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Удалить"
                      >
                        {deletingChannelId === chat.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Members List */}
        {server.members && server.members.length > 0 && (
          <div className="mb-4">
            <div className="bg-[#121214]/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <Users size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Участники</h3>
                    <p className="text-xs text-white/40">{server.members.length} участников</p>
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
              {server.members.length > 5 && (
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
                  const isOwner = member.id === server.ownerId;
                  const isUserOnline = getUserOnlineStatus(member.id);
                  const isCurrentUser = member.id === currentUser.id;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                    >
                      <AvatarWithStatus
                        src={member.avatarUrl}
                        name={member.displayName || member.username}
                        isOnline={isUserOnline}
                        size="sm"
                        showStatus={true}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{member.displayName || member.username}</p>
                          {isOwner && (
                            <Crown size={14} className="text-yellow-500 shrink-0" />
                          )}
                          {isCurrentUser && (
                            <span className="text-xs text-white/40">(вы)</span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 truncate">@{member.username}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwner && (
                          <span className="text-xs text-yellow-500 font-medium px-2 py-1 bg-yellow-500/10 rounded-lg">
                            Владелец
                          </span>
                        )}
                        {isAdmin && !isCurrentUser && !isOwner && (
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

        {/* Danger Zone */}
        <div className="mb-4">
          <div className="bg-[#121214]/50 rounded-2xl p-5">
            <h3 className="text-lg font-semibold mb-4 text-red-400">Опасная зона</h3>
            <div className="space-y-2">
              <button
                onClick={() => {/* TODO: Leave server */}}
                className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-red-500/10 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <LogOut size={18} className="text-red-400" />
                  <span className="text-red-400 font-medium">Покинуть сервер</span>
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
                    <span className="text-red-400 font-medium">Удалить сервер</span>
                  </div>
                  <ChevronRight size={18} className="text-red-400/40 group-hover:text-red-400/80 transition-colors" />
                </button>
              )}
            </div>
          </div>
        </div>
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
                Удалить сервер "{server.name}"?
              </DialogTitle>
            </div>
            <DialogDescription className="text-white/60 pt-4 leading-relaxed">
              Вы уверены, что хотите удалить этот сервер? Все каналы, сообщения и настройки будут удалены без возможности восстановления. Все участники потеряют доступ к серверу.
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
                  Удалить сервер
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Channel Dialog */}
      <Dialog open={showChannelDialog} onOpenChange={setShowChannelDialog}>
        <DialogContent className="bg-[#121214] border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                {newChannelType === "CHANNEL" ? (
                  <Hash className="w-6 h-6 text-blue-400" />
                ) : (
                  <Users className="w-6 h-6 text-green-400" />
                )}
              </div>
              <DialogTitle className="text-xl font-semibold text-white">
                Создать {newChannelType === "CHANNEL" ? "канал" : "чат"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-white/60 pt-4">
              Создайте новый {newChannelType === "CHANNEL" ? "текстовый канал" : "групповой чат"} на сервере. Все участники сервера получат доступ.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-white/80 mb-2 block">
                Тип
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNewChannelType("CHANNEL")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${
                    newChannelType === "CHANNEL"
                      ? "bg-blue-500/20 border-2 border-blue-500"
                      : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                  }`}
                  disabled={isCreatingChannel}
                >
                  <Hash size={18} className="text-blue-400" />
                  <span className="font-medium">Канал</span>
                </button>
                <button
                  onClick={() => setNewChannelType("GROUP")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${
                    newChannelType === "GROUP"
                      ? "bg-green-500/20 border-2 border-green-500"
                      : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                  }`}
                  disabled={isCreatingChannel}
                >
                  <Users size={18} className="text-green-400" />
                  <span className="font-medium">Чат</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-white/80 mb-2 block">
                Название
              </label>
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder={newChannelType === "CHANNEL" ? "общий-чат" : "Общение"}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-violet-500 transition-colors"
                disabled={isCreatingChannel}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3 sm:gap-0">
            <button
              onClick={() => {
                setShowChannelDialog(false);
                setNewChannelName("");
                setNewChannelType("CHANNEL");
              }}
              disabled={isCreatingChannel}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors font-medium disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={handleCreateChannel}
              disabled={isCreatingChannel || !newChannelName.trim()}
              className={`flex-1 px-4 py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium ${
                newChannelType === "CHANNEL"
                  ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
                  : "bg-green-500/10 hover:bg-green-500/20 text-green-400"
              }`}
            >
              {isCreatingChannel ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  {newChannelType === "CHANNEL" ? <Hash size={16} /> : <Users size={16} />}
                  Создать
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
