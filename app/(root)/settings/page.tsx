// app/settings/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, Palette, Bell, MessageSquare, User, 
  ChevronRight, Save, X, Moon, Sun, Monitor,
  Upload, Trash2, ImageIcon, Loader2, Download, Camera
} from "lucide-react";
import { exportMyHistory, getOwnProfileEditorData, removeUserBackground, updateOwnProfile, uploadUserAvatar, uploadUserBackground } from "@/app/lib/api/user";
import { useSettings } from "@/components/SettingsProvider";
import { SettingsType } from "@/app/lib/types";

type SettingsTab = "privacy" | "appearance" | "notifications" | "chat" | "account";

export default function SettingsPage() {
  const router = useRouter();
  const { settings, isLoading, updateMultipleSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>("privacy");
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [tempSettings, setTempSettings] = useState<SettingsType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    bio: "",
    status: "",
    telegram: "",
    vk: "",
    github: "",
    website: ""
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isExportingAllData, setIsExportingAllData] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Синхронизируем tempSettings с settings из контекста
  useEffect(() => {
    if (settings) {
      setTempSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await getOwnProfileEditorData();
        if (!profileData) return;
        setProfileForm({
          displayName: profileData.displayName || "",
          bio: profileData.bio || "",
          status: profileData.status || "",
          telegram: profileData.socialLinks?.telegram || "",
          vk: profileData.socialLinks?.vk || "",
          github: profileData.socialLinks?.github || "",
          website: profileData.socialLinks?.website || ""
        });
        setAvatarUrl(profileData.avatarUrl || null);
      } catch (error) {
        console.error("Failed to load profile editor data:", error);
      }
    };

    loadProfile();
  }, []);

  const handleSettingChange = <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => {
    setTempSettings(prev => prev ? { ...prev, [key]: value } : null);
    setUnsavedChanges(true);
  };

  const saveSettings = async () => {
    if (!tempSettings || !unsavedChanges) return;
    
    try {
      await updateMultipleSettings(tempSettings);
      setUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const cancelChanges = () => {
    setTempSettings(settings);
    setUnsavedChanges(false);
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Можно загружать только изображения");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Размер файла не должен превышать 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const result = await uploadUserBackground(formData);
      if (result.success) {
        setTempSettings(prev => prev ? { ...prev, chatBackground: result.url } : null);
        await updateMultipleSettings({ chatBackground: result.url });
        setUnsavedChanges(false);
      }
    } catch (error) {
      console.error("Failed to upload background:", error);
      alert("Ошибка при загрузке фона");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveBackground = async () => {
    if (!confirm("Удалить фоновое изображение?")) return;
    
    setIsUploading(true);
    try {
      await removeUserBackground();
      setTempSettings(prev => prev ? { ...prev, chatBackground: null } : null);
      await updateMultipleSettings({ chatBackground: null });
      setUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to remove background:", error);
      alert("Ошибка при удалении фона");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Можно загружать только изображения");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Размер файла не должен превышать 5MB");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const result = await uploadUserAvatar(formData);
      if (result.success && result.url) {
        setAvatarUrl(result.url);
        alert("Аватар успешно обновлен!");
      } else {
        throw new Error("Failed to upload avatar");
      }
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      alert("Ошибка при загрузке аватара");
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const saveProfile = async () => {
    try {
      setIsSavingProfile(true);
      await updateOwnProfile({
        displayName: profileForm.displayName,
        bio: profileForm.bio,
        status: profileForm.status,
        socialLinks: {
          telegram: profileForm.telegram,
          vk: profileForm.vk,
          github: profileForm.github,
          website: profileForm.website
        }
      });
      alert("Профиль обновлен");
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert("Ошибка сохранения профиля");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const exportAllHistory = async () => {
    try {
      setIsExportingAllData(true);
      const data = await exportMyHistory();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export all data:", error);
      alert("Ошибка выгрузки данных");
    } finally {
      setIsExportingAllData(false);
    }
  };

  if (isLoading || !tempSettings) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      <div className="border-b border-white/5 bg-[#121214]/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <ChevronRight size={20} className="text-white/60 rotate-180" />
          </button>
          <h1 className="text-lg font-semibold">Настройки</h1>
          <div className="flex gap-2">
            {unsavedChanges && (
              <>
                <button
                  onClick={cancelChanges}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  title="Отменить"
                >
                  <X size={20} className="text-white/60" />
                </button>
                <button
                  onClick={saveSettings}
                  className="p-2 bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors"
                  title="Сохранить"
                >
                  <Save size={20} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-2 border-b border-white/10 mb-6 overflow-x-auto">
          {[
            { id: "privacy", label: "Приватность", icon: Shield },
            { id: "appearance", label: "Внешний вид", icon: Palette },
            { id: "notifications", label: "Уведомления", icon: Bell },
            { id: "chat", label: "Чаты", icon: MessageSquare },
            { id: "account", label: "Аккаунт", icon: User }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors relative ${
                activeTab === tab.id ? "text-orange-400" : "text-white/40 hover:text-white/60"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400"
                />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "privacy" && (
              <div className="space-y-6">
                <SettingToggle
                  label="Показывать статус «В сети»"
                  description="Другие пользователи будут видеть, когда вы онлайн"
                  value={tempSettings.showOnlineStatus ?? true}
                  onChange={(v) => handleSettingChange("showOnlineStatus", v)}
                />
                <SettingToggle
                  label="Показывать «Был(а) в сети»"
                  description="Отображать время последнего посещения"
                  value={tempSettings.showLastSeen ?? true}
                  onChange={(v) => handleSettingChange("showLastSeen", v)}
                />
                <SettingSelect
                  label="Кто может писать в личные сообщения"
                  options={[
                    { value: "everyone", label: "Все пользователи" },
                    { value: "contacts", label: "Только контакты" },
                    { value: "nobody", label: "Никто" }
                  ]}
                  value={tempSettings.allowDirectMessages ?? "everyone"}
                  onChange={(v) => handleSettingChange("allowDirectMessages", v)}
                />
                <SettingSelect
                  label="Кто может добавлять в чаты"
                  options={[
                    { value: "everyone", label: "Все пользователи" },
                    { value: "contacts", label: "Только контакты" },
                    { value: "nobody", label: "Никто" }
                  ]}
                  value={tempSettings.allowAddToChats ?? "everyone"}
                  onChange={(v) => handleSettingChange("allowAddToChats", v)}
                />
                <SettingSelect
                  label="Видимость профиля"
                  options={[
                    { value: "public", label: "Публичный" },
                    { value: "contacts", label: "Только контакты" },
                    { value: "private", label: "Приватный" }
                  ]}
                  value={tempSettings.profileVisibility ?? "public"}
                  onChange={(v) => handleSettingChange("profileVisibility", v)}
                />
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-6">
                <div className="p-4 bg-white/5 rounded-xl">
                  <label className="block font-medium mb-3">Тема приложения</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "light", label: "Светлая", icon: Sun },
                      { value: "dark", label: "Тёмная", icon: Moon },
                      { value: "system", label: "Системная", icon: Monitor }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleSettingChange("theme", opt.value)}
                        className={`p-3 rounded-lg text-sm transition-all flex flex-col items-center gap-1 ${
                          tempSettings.theme === opt.value
                            ? "bg-orange-500 text-white"
                            : "bg-white/5 hover:bg-white/10 text-white/80"
                        }`}
                      >
                        <opt.icon size={18} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <SettingSelect
                  label="Размер шрифта сообщений"
                  options={[
                    { value: "small", label: "Мелкий" },
                    { value: "medium", label: "Средний" },
                    { value: "large", label: "Крупный" }
                  ]}
                  value={tempSettings.messageFontSize ?? "medium"}
                  onChange={(v) => handleSettingChange("messageFontSize", v)}
                />
                
                <SettingColorPicker
                  label="Акцентный цвет"
                  value={tempSettings.accentColor || undefined}
                  onChange={(v) => handleSettingChange("accentColor", v || null)}
                />
                
                <div className="p-4 bg-white/5 rounded-xl">
                  <label className="block font-medium mb-3">Фон чата</label>
                  
                  {tempSettings.chatBackground && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
                      <div 
                        className="h-32 bg-cover bg-center relative"
                        style={{ backgroundImage: `url(${tempSettings.chatBackground})` }}
                      >
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <button
                            onClick={handleRemoveBackground}
                            disabled={isUploading}
                            className="px-3 py-1.5 bg-red-500 rounded-lg text-sm flex items-center gap-2"
                          >
                            <Trash2 size={14} />
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBackgroundUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Upload size={18} />
                      )}
                      {tempSettings.chatBackground ? "Изменить фон" : "Загрузить фон"}
                    </button>
                    
                    {tempSettings.chatBackground && (
                      <button
                        onClick={() => window.open(tempSettings.chatBackground || "", "_blank")}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                      >
                        <ImageIcon size={18} />
                      </button>
                    )}
                  </div>
                  
                  <p className="text-xs text-white/40 mt-3">
                    Рекомендуемый размер: 1920x1080px. Максимальный размер: 5MB.
                    Поддерживаются форматы: JPG, PNG, GIF, WEBP.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                <SettingToggle
                  label="Push-уведомления"
                  description="Получать уведомления, когда приложение закрыто"
                  value={tempSettings.pushNotifications ?? true}
                  onChange={(v) => handleSettingChange("pushNotifications", v)}
                />
                <SettingToggle
                  label="Звуковые уведомления"
                  value={tempSettings.soundNotifications ?? true}
                  onChange={(v) => handleSettingChange("soundNotifications", v)}
                />
                <SettingToggle
                  label="Вибрация"
                  value={tempSettings.vibration ?? true}
                  onChange={(v) => handleSettingChange("vibration", v)}
                />
                <SettingToggle
                  label="Предпросмотр сообщений"
                  description="Показывать текст сообщения в уведомлении"
                  value={tempSettings.showNotificationPreview ?? true}
                  onChange={(v) => handleSettingChange("showNotificationPreview", v)}
                />
              </div>
            )}

            {activeTab === "chat" && (
              <div className="space-y-6">
                <SettingToggle
                  label="Отправлять отчёты о прочтении"
                  description="Отправлять галочки ✓✓, когда вы прочитали сообщение"
                  value={tempSettings.sendReadReceipts ?? true}
                  onChange={(v) => handleSettingChange("sendReadReceipts", v)}
                />
                <SettingToggle
                  label="Показывать индикатор набора"
                  description="Отображать «печатает...», когда вы вводите сообщение"
                  value={tempSettings.showTypingIndicator ?? true}
                  onChange={(v) => handleSettingChange("showTypingIndicator", v)}
                />
                <SettingSelect
                  label="Автозагрузка медиа"
                  options={[
                    { value: "always", label: "Всегда" },
                    { value: "wifi", label: "Только через Wi-Fi" },
                    { value: "never", label: "Никогда" }
                  ]}
                  value={tempSettings.autoDownloadMedia ?? "wifi"}
                  onChange={(v) => handleSettingChange("autoDownloadMedia", v)}
                />
                <SettingToggle
                  label="Сжимать изображения"
                  description="Уменьшать размер фото перед отправкой"
                  value={tempSettings.compressImages ?? true}
                  onChange={(v) => handleSettingChange("compressImages", v)}
                />
              </div>
            )}

            {activeTab === "account" && (
              <div className="space-y-6">
                <div className="bg-white/5 rounded-2xl p-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <User size={18} className="text-orange-400" />
                    Профиль
                  </h4>
                  
                  {/* Avatar Section */}
                  <div className="flex flex-col items-center mb-6 pb-6 border-b border-white/10">
                    <div className="relative mb-4">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center overflow-hidden">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={40} className="text-white/60" />
                        )}
                      </div>
                      
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="absolute bottom-0 right-0 p-2 bg-orange-500 hover:bg-orange-600 rounded-full transition-colors disabled:opacity-50"
                        title="Изменить аватар"
                      >
                        {isUploadingAvatar ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Camera size={16} />
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-white/60">Нажмите на иконку камеры, чтобы изменить аватар</p>
                    <p className="text-xs text-white/40 mt-1">Рекомендуемый размер: 512x512px. Максимум: 5MB</p>
                  </div>
                  
                  <div className="space-y-3">
                    <input
                      value={profileForm.displayName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="Имя отображения"
                      className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                    <input
                      value={profileForm.status}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, status: e.target.value }))}
                      placeholder="Статус"
                      className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                    <textarea
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="О себе"
                      rows={3}
                      className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input 
                        value={profileForm.telegram} 
                        onChange={(e) => setProfileForm(prev => ({ ...prev, telegram: e.target.value }))} 
                        placeholder="Telegram" 
                        className="px-3 py-2 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50" 
                      />
                      <input 
                        value={profileForm.vk} 
                        onChange={(e) => setProfileForm(prev => ({ ...prev, vk: e.target.value }))} 
                        placeholder="VK" 
                        className="px-3 py-2 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50" 
                      />
                      <input 
                        value={profileForm.github} 
                        onChange={(e) => setProfileForm(prev => ({ ...prev, github: e.target.value }))} 
                        placeholder="GitHub" 
                        className="px-3 py-2 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50" 
                      />
                      <input 
                        value={profileForm.website} 
                        onChange={(e) => setProfileForm(prev => ({ ...prev, website: e.target.value }))} 
                        placeholder="Сайт" 
                        className="px-3 py-2 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50" 
                      />
                    </div>
                    <button
                      onClick={saveProfile}
                      disabled={isSavingProfile}
                      className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors disabled:opacity-50 font-medium"
                    >
                      {isSavingProfile ? "Сохранение..." : "Сохранить профиль"}
                    </button>
                  </div>
                </div>
                
                <div className="bg-white/5 rounded-2xl p-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <Shield size={18} className="text-orange-400" />
                    Безопасность
                  </h4>
                  <button className="w-full text-left p-3 hover:bg-white/5 rounded-xl transition-colors flex items-center justify-between">
                    <span className="text-white/80">Сменить пароль</span>
                    <ChevronRight size={16} className="text-white/40" />
                  </button>
                  <button
                    onClick={exportAllHistory}
                    disabled={isExportingAllData}
                    className="w-full text-left p-3 hover:bg-white/5 rounded-xl transition-colors text-white/80 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Download size={16} /> 
                      Выгрузить мои данные
                    </span>
                    <span className="text-xs text-white/40">{isExportingAllData ? "..." : "JSON"}</span>
                  </button>
                  <button className="w-full text-left p-3 hover:bg-red-500/10 rounded-xl transition-colors text-red-400">
                    Удалить аккаунт
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Вспомогательные компоненты
function SettingToggle({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
      <div>
        <p className="font-medium">{label}</p>
        {description && <p className="text-sm text-white/40">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-7 rounded-full transition-colors ${value ? "bg-orange-500" : "bg-white/20"}`}
      >
        <motion.div
          className="absolute top-1 w-5 h-5 bg-white rounded-full shadow"
          animate={{ left: value ? "28px" : "4px" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

function SettingSelect({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="p-4 bg-white/5 rounded-xl">
      <label className="block font-medium mb-3">{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`p-3 rounded-lg text-sm transition-all ${
              value === opt.value ? "bg-orange-500 text-white" : "bg-white/5 hover:bg-white/10 text-white/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingColorPicker({ label, value, onChange }: { label: string; value?: string; onChange: (v?: string) => void }) {
  return (
    <div className="p-4 bg-white/5 rounded-xl">
      <label className="block font-medium mb-3">{label}</label>
      <div className="flex items-center gap-4">
        <input
          type="color"
          value={value || "#FF6B35"}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-12 rounded-lg cursor-pointer border-0"
        />
        <input
          type="text"
          value={value || ""}
          placeholder="#FF6B35"
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-4 py-2 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        />
        {value && (
          <button onClick={() => onChange(undefined)} className="p-2 text-white/40 hover:text-white/60">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}