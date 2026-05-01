// app/create/[type]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Camera, Server, Trash2, Plus, Hash, MessageSquare, Globe, Lock, Shield, Users, Crown, X, Link as LinkIcon } from "lucide-react";
import { motion } from "framer-motion";
import UserSelector from "@/components/UserSelector";
import { createFullServer, createChat, createGroupChat } from "@/app/lib/api/chat";
import { uploadChatImage } from "@/app/lib/yandex-storage";
import { getCurrentUser2 } from "@/app/lib/api/user";

export default function CreatePage() {
  const params = useParams();
  const type = params?.type as string;
  const router = useRouter();

  const [name, setName] = useState("");
  const [access, setAccess] = useState("PUBLIC");
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [channels, setChannels] = useState([{ name: "general", type: "CHANNEL" }]);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"CREATOR" | "ADMIN" | "MEMBER">("MEMBER");

  const onSubmit = async () => {
    if (!name.trim()) {
      alert("Введите название");
      return;
    }
    
    setLoading(true);
    try {
      let imageUrl = "";
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadResult = await uploadChatImage(formData);
        imageUrl = uploadResult?.url || "";
      }

      let result;
      if (type === 'server') {
        // Фильтруем каналы с пустыми именами
        const validChannels = channels.filter(ch => ch.name && ch.name.trim());
        
        if (validChannels.length === 0) {
          alert("Добавьте хотя бы один канал");
          setLoading(false);
          return;
        }
        
        result = await createFullServer({ 
          name, 
          imageUrl, 
          access, 
          channels: validChannels,
          userIds: selectedUsers 
        });
        
        if (result && result.id) {
          console.log("Server created:", result);
          // Перенаправляем на первый канал сервера
          if (result.chats && result.chats.length > 0) {
            router.push(`/chat/${result.chats[0].id}`);
          } else {
            router.push(`/server/${result.id}`);
          }
          router.refresh();
        } else {
          throw new Error("Failed to create server");
        }
      } else if (type === 'group') {
        result = await createGroupChat({ 
          name, 
          imageUrl, 
          access, 
          userIds: selectedUsers 
        });
        
        if (result && result.id) {
          console.log("Group created:", result);
          router.push(`/chat/${result.id}`);
          router.refresh();
        } else {
          throw new Error("Failed to create group");
        }
      } else if (type === 'channel') {
        result = await createChat({ 
          name, 
          imageUrl, 
          access, 
          type: 'CHANNEL',
          userIds: selectedUsers 
        });
        
        if (result && result.id) {
          console.log("Channel created:", result);
          router.push(`/chat/${result.id}`);
          router.refresh();
        } else {
          throw new Error("Failed to create channel");
        }
      } else {
        throw new Error("Unknown type");
      }
    } catch (error) {
      console.error("Error creating:", error);
      alert(error instanceof Error ? error.message : "Ошибка создания");
    } finally { 
      setLoading(false); 
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'server': return 'Новый сервер';
      case 'group': return 'Новая группа';
      case 'channel': return 'Новый канал';
      default: return 'Создание';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'server': return <Server size={40} className="text-violet-500" />;
      case 'group': return <Users size={40} className="text-violet-500" />;
      case 'channel': return <Hash size={40} className="text-violet-500" />;
      default: return <MessageSquare size={40} className="text-white/20" />;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'CREATOR': return <Crown size={16} className="text-yellow-500" />;
      case 'ADMIN': return <Shield size={16} className="text-violet-500" />;
      default: return <Users size={16} className="text-white/40" />;
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'CREATOR': return "Создатель";
      case 'ADMIN': return "Администратор";
      default: return "Участник";
    }
  };

  const getAccessOptions = () => {
    if (type === 'server') {
      return [
        { value: "PUBLIC", icon: Globe, label: "Публичный", desc: "Все могут найти и присоединиться" },
        { value: "LINK_ONLY", icon: LinkIcon, label: "По ссылке", desc: "Доступ только по приглашению" },
        { value: "PRIVATE", icon: Lock, label: "Приватный", desc: "Только по приглашению админа" }
      ];
    }
    return [
      { value: "PUBLIC", icon: Globe, label: "Публичный", desc: "Все могут найти и присоединиться" },
      { value: "LINK_ONLY", icon: LinkIcon, label: "По ссылке", desc: "Доступ только по приглашению" },
      { value: "PRIVATE", icon: Lock, label: "Приватный", desc: "Только по приглашению админа" }
    ];
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col md:flex-row">
      {/* Левая панель: Предпросмотр */}
      <div className="md:w-1/3 bg-gradient-to-br from-violet-900/20 to-purple-600/10 border-r border-white/5 p-12 hidden md:flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-32 h-32 mx-auto rounded-3xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden">
            {preview ? (
              <img src={preview} className="w-full h-full object-cover" />
            ) : (
              getIcon()
            )}
          </div>
          <h2 className="text-xl font-bold italic">#{name || "название"}</h2>
          <p className="text-[10px] text-white/20 uppercase tracking-widest">
            {selectedUsers.length + 1} участников
          </p>
          {(type === 'group' || type === 'channel') && selectedUsers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-[10px] text-violet-400 uppercase tracking-widest mb-2">Роли участников</p>
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2 text-xs">
                  {getRoleIcon('CREATOR')}
                  <span className="text-white/60">Вы</span>
                  <span className="text-yellow-500 ml-auto">Создатель</span>
                </div>
                {selectedUsers.slice(0, 3).map((userId, idx) => (
                  <div key={userId} className="flex items-center gap-2 text-xs">
                    {getRoleIcon(selectedRole)}
                    <span className="text-white/60">Участник {idx + 1}</span>
                    <span className="text-white/40 ml-auto">{getRoleName(selectedRole)}</span>
                  </div>
                ))}
                {selectedUsers.length > 3 && (
                  <div className="text-xs text-white/40 text-center pt-1">
                    + ещё {selectedUsers.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Правая панель: Форма */}
      <div className="flex-1 p-8 md:p-20 overflow-y-auto no-scrollbar">
        <div className="max-w-2xl space-y-10">
          <h1 className="text-4xl font-black uppercase italic">{getTitle()}</h1>

          {/* 01. Имя и Фото */}
          <div className="flex items-center gap-6">
            <label className="w-20 h-20 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-all hover:scale-105">
              {preview ? (
                <img src={preview} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <Camera className="text-white/20" />
              )}
              <input type="file" hidden onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { 
                  setFile(f); 
                  setPreview(URL.createObjectURL(f)); 
                }
              }} />
            </label>
            <input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название..."
              className="flex-1 bg-transparent border-b border-white/10 py-4 text-2xl outline-none focus:border-violet-500 transition-all placeholder:text-white/20"
            />
          </div>

          {/* 02. Пригласить людей (для групп и каналов) */}
          {(type === 'group' || type === 'channel') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">
                  Пригласить участников
                </h3>
                {selectedUsers.length > 0 && (
                  <button
                    onClick={() => setShowRoleSelect(!showRoleSelect)}
                    className="text-[10px] text-white/40 hover:text-violet-400 transition-colors flex items-center gap-1"
                  >
                    <Shield size={12} />
                    Роль по умолчанию: {getRoleName(selectedRole)}
                  </button>
                )}
              </div>
              
              {showRoleSelect && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-xl p-3 space-y-2"
                >
                  <p className="text-xs text-white/40">Роль для новых участников:</p>
                  <div className="flex gap-2">
                    {(['MEMBER', 'ADMIN'] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                          selectedRole === role
                            ? 'bg-violet-500 text-white'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {getRoleIcon(role)}
                          {getRoleName(role)}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
              
              <UserSelector 
                selectedIds={selectedUsers} 
                onSelect={setSelectedUsers}
                placeholder="Поиск пользователей..."
              />
              
              {selectedUsers.length > 0 && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-white/40 mb-2">Выбранные участники:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((userId) => (
                      <div key={userId} className="flex items-center gap-2 bg-white/10 rounded-lg px-2 py-1 text-xs">
                        <span>{userId.slice(0, 8)}...</span>
                        <button
                          onClick={() => setSelectedUsers(selectedUsers.filter(id => id !== userId))}
                          className="text-white/40 hover:text-red-400"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 03. Доступ для всех типов */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Доступ</h3>
            <div className="flex flex-wrap gap-3">
              {getAccessOptions().map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAccess(option.value)}
                  className={`flex-1 min-w-[120px] p-4 rounded-xl border transition-all ${
                    access === option.value
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <option.icon size={20} className={`mx-auto mb-2 ${
                    access === option.value ? 'text-violet-400' : 'text-white/40'
                  }`} />
                  <p className="text-xs font-medium">{option.label}</p>
                  <p className="text-[10px] text-white/40 mt-1">{option.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* 04. Структура каналов (только для сервера) */}
          {type === 'server' && (
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Каналы сервера</h3>
                <button 
                  onClick={() => setChannels([...channels, { name: "", type: "CHANNEL" }])} 
                  className="text-[10px] text-white/40 hover:text-white flex items-center gap-1"
                >
                  <Plus size={12} /> ДОБАВИТЬ
                </button>
              </div>
              <div className="space-y-2">
                {channels.map((ch, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 group hover:border-violet-500/30 transition-all">
                    {ch.type === 'CHANNEL' ? <Hash size={16} className="text-violet-400" /> : <MessageSquare size={16} className="text-green-400" />}
                    <input 
                      value={ch.name} 
                      onChange={(e) => {
                        const n = [...channels]; 
                        n[i].name = e.target.value; 
                        setChannels(n);
                      }}
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/20" 
                      placeholder="название-канала" 
                    />
                    <button 
                      onClick={() => {
                        const n = [...channels]; 
                        n[i].type = n[i].type === 'CHANNEL' ? 'GROUP' : 'CHANNEL'; 
                        setChannels(n);
                      }} 
                      className="text-[10px] font-bold text-white/20 hover:text-violet-400 transition-colors px-2 py-1 rounded"
                    >
                      {ch.type === 'CHANNEL' ? 'Канал' : 'Группа'}
                    </button>
                    {channels.length > 1 && (
                      <button 
                        onClick={() => setChannels(channels.filter((_, idx) => idx !== i))} 
                        className="text-white/10 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/20">
                • Каналы — для объявлений и правил (только админы пишут).<br/>
                • Группы — для общения (все участники пишут).
              </p>
            </section>
          )}

          <button 
            disabled={!name.trim() || loading}
            onClick={onSubmit}
            className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white font-black py-4 rounded-2xl hover:from-violet-400 hover:to-purple-500 active:scale-[0.98] transition-all disabled:opacity-20 disabled:cursor-not-allowed uppercase text-lg tracking-wider"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Создание...
              </div>
            ) : (
              `Создать ${type === 'server' ? 'сервер' : type === 'group' ? 'группу' : 'канал'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}