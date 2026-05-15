// app/settings/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Palette, Bell, MessageSquare, User,
  ChevronRight, Save, X, Moon, Sun, Monitor,
  Upload, Trash2, Loader2, Camera, Download, Check,
  Eye, EyeOff, Lock, Globe, Users, Volume2, VolumeX,
  Smartphone, Wifi, Image as ImageIcon
} from "lucide-react";
import {
  exportMyHistory, getOwnProfileEditorData, removeUserBackground,
  updateOwnProfile, uploadUserAvatar, uploadUserBackground
} from "@/app/lib/api/user";
import { useSettings } from "@/components/SettingsProvider";
import { SettingsType } from "@/app/lib/types";

type Tab = "privacy" | "appearance" | "notifications" | "chat" | "account";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "privacy",       label: "Приватность",  icon: Shield },
  { id: "appearance",    label: "Внешний вид",  icon: Palette },
  { id: "notifications", label: "Уведомления",  icon: Bell },
  { id: "chat",          label: "Чаты",         icon: MessageSquare },
  { id: "account",       label: "Аккаунт",      icon: User },
];

export default function SettingsPage() {
  const router = useRouter();
  const { settings, isLoading, updateMultipleSettings } = useSettings();
  const [tab, setTab] = useState<Tab>("privacy");
  const [dirty, setDirty] = useState(false);
  const [temp, setTemp] = useState<SettingsType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [profile, setProfile] = useState({ displayName: "", bio: "", status: "", telegram: "", vk: "", github: "", website: "" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (settings) setTemp(settings); }, [settings]);

  useEffect(() => {
    getOwnProfileEditorData().then(d => {
      if (!d) return;
      setProfile({
        displayName: d.displayName || "", bio: d.bio || "", status: d.status || "",
        telegram: d.socialLinks?.telegram || "", vk: d.socialLinks?.vk || "",
        github: d.socialLinks?.github || "", website: d.socialLinks?.website || ""
      });
      setAvatarUrl(d.avatarUrl || null);
    });
  }, []);

  const set = <K extends keyof SettingsType>(k: K, v: SettingsType[K]) => {
    setTemp(p => p ? { ...p, [k]: v } : null);
    setDirty(true);
  };

  const save = async () => {
    if (!temp || !dirty) return;
    setIsSaving(true);
    try { await updateMultipleSettings(temp); setDirty(false); }
    finally { setIsSaving(false); }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBg(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await uploadUserBackground(fd);
      if (r.success) { setTemp(p => p ? { ...p, chatBackground: r.url } : null); await updateMultipleSettings({ chatBackground: r.url }); setDirty(false); }
    } finally { setIsUploadingBg(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleBgRemove = async () => {
    setIsUploadingBg(true);
    try { await removeUserBackground(); setTemp(p => p ? { ...p, chatBackground: null } : null); await updateMultipleSettings({ chatBackground: null }); setDirty(false); }
    finally { setIsUploadingBg(false); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await uploadUserAvatar(fd);
      if (r.success && r.url) setAvatarUrl(r.url);
    } finally { setIsUploadingAvatar(false); if (avatarRef.current) avatarRef.current.value = ""; }
  };

  const saveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await updateOwnProfile({ displayName: profile.displayName, bio: profile.bio, status: profile.status, socialLinks: { telegram: profile.telegram, vk: profile.vk, github: profile.github, website: profile.website } });
    } finally { setIsSavingProfile(false); }
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      const data = await exportMyHistory();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `my-data-${Date.now()}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } finally { setIsExporting(false); }
  };

  if (isLoading || !temp) return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f0f12]/80 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <ChevronRight size={20} className="text-white/50 rotate-180" />
          </button>
          <span className="font-semibold text-white/90">Настройки</span>
          <div className="w-9 flex justify-end">
            {dirty && (
              <button onClick={save} disabled={isSaving} className="p-2 bg-violet-600 hover:bg-violet-500 rounded-xl transition-colors disabled:opacity-50">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
        {/* Tab bar */}
        <div className="flex gap-1 bg-white/5 rounded-2xl p-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all relative ${tab === t.id ? "text-white" : "text-white/40 hover:text-white/60"}`}>
              {tab === t.id && <motion.div layoutId="tabBg" className="absolute inset-0 bg-violet-600/30 rounded-xl border border-violet-500/30" />}
              <t.icon size={16} className="relative z-10" />
              <span className="relative z-10 hidden sm:block">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-3">

            {/* ── PRIVACY ── */}
            {tab === "privacy" && <>
              <Section title="Видимость">
                <Toggle label="Статус «В сети»" desc="Другие видят, когда вы онлайн" icon={Eye} value={temp.showOnlineStatus ?? true} onChange={v => set("showOnlineStatus", v)} />
                <Toggle label="Время последнего визита" desc="Показывать «был(а) в сети»" icon={EyeOff} value={temp.showLastSeen ?? true} onChange={v => set("showLastSeen", v)} />
              </Section>
              <Section title="Доступ">
                <SelectRow label="Личные сообщения" icon={MessageSquare}
                  options={[{ v: "everyone", l: "Все" }, { v: "contacts", l: "Контакты" }, { v: "nobody", l: "Никто" }]}
                  value={temp.allowDirectMessages ?? "everyone"} onChange={v => set("allowDirectMessages", v)} />
                <SelectRow label="Добавление в чаты" icon={Users}
                  options={[{ v: "everyone", l: "Все" }, { v: "contacts", l: "Контакты" }, { v: "nobody", l: "Никто" }]}
                  value={temp.allowAddToChats ?? "everyone"} onChange={v => set("allowAddToChats", v)} />
                <SelectRow label="Видимость профиля" icon={Globe}
                  options={[{ v: "public", l: "Публичный" }, { v: "contacts", l: "Контакты" }, { v: "private", l: "Приватный" }]}
                  value={temp.profileVisibility ?? "public"} onChange={v => set("profileVisibility", v)} />
              </Section>
            </>}

            {/* ── APPEARANCE ── */}
            {tab === "appearance" && <>
              <Section title="Тема">
                <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                  {[{ v: "light", l: "Светлая", I: Sun }, { v: "dark", l: "Тёмная", I: Moon }, { v: "system", l: "Системная", I: Monitor }].map(o => (
                    <button key={o.v} onClick={() => set("theme", o.v)}
                      className={`flex flex-col items-center gap-2 py-4 rounded-xl text-sm transition-all border ${temp.theme === o.v ? "bg-violet-600/20 border-violet-500/50 text-violet-300" : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10"}`}>
                      <o.I size={20} />
                      {o.l}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="Шрифт">
                <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                  {[{ v: "small", l: "Мелкий" }, { v: "medium", l: "Средний" }, { v: "large", l: "Крупный" }].map(o => (
                    <button key={o.v} onClick={() => set("messageFontSize", o.v)}
                      className={`py-3 rounded-xl text-sm transition-all border ${temp.messageFontSize === o.v ? "bg-violet-600/20 border-violet-500/50 text-violet-300" : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10"}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="Фон чата">
                <div className="px-4 pb-4 space-y-3">
                  {temp.chatBackground && (
                    <div className="relative h-28 rounded-xl overflow-hidden border border-white/10">
                      <img src={temp.chatBackground} className="w-full h-full object-cover" alt="bg" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <button onClick={handleBgRemove} disabled={isUploadingBg} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/80 rounded-lg text-sm">
                          <Trash2 size={14} /> Удалить
                        </button>
                      </div>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                  <button onClick={() => fileRef.current?.click()} disabled={isUploadingBg}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-colors disabled:opacity-50">
                    {isUploadingBg ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {temp.chatBackground ? "Изменить фон" : "Загрузить фон"}
                  </button>
                  <p className="text-xs text-white/30">JPG, PNG, WEBP · до 5 МБ · рекомендуется 1920×1080</p>
                </div>
              </Section>
            </>}

            {/* ── NOTIFICATIONS ── */}
            {tab === "notifications" && <>
              <Section title="Уведомления">
                <Toggle label="Push-уведомления" desc="Когда приложение закрыто" icon={Bell} value={temp.pushNotifications ?? true} onChange={v => set("pushNotifications", v)} />
                <Toggle label="Звук" icon={Volume2} value={temp.soundNotifications ?? true} onChange={v => set("soundNotifications", v)} />
                <Toggle label="Вибрация" icon={Smartphone} value={temp.vibration ?? true} onChange={v => set("vibration", v)} />
                <Toggle label="Предпросмотр в уведомлении" desc="Показывать текст сообщения" icon={Eye} value={temp.showNotificationPreview ?? true} onChange={v => set("showNotificationPreview", v)} />
              </Section>
            </>}

            {/* ── CHAT ── */}
            {tab === "chat" && <>
              <Section title="Поведение">
                <Toggle label="Отчёты о прочтении" desc="Отправлять ✓✓ когда прочитали" icon={Check} value={temp.sendReadReceipts ?? true} onChange={v => set("sendReadReceipts", v)} />
                <Toggle label="Индикатор набора" desc="Показывать «печатает…»" icon={MessageSquare} value={temp.showTypingIndicator ?? true} onChange={v => set("showTypingIndicator", v)} />
                <Toggle label="Сжимать изображения" desc="Уменьшать фото перед отправкой" icon={ImageIcon} value={temp.compressImages ?? true} onChange={v => set("compressImages", v)} />
              </Section>
              <Section title="Загрузка медиа">
                <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                  {[{ v: "always", l: "Всегда", I: Download }, { v: "wifi", l: "Wi-Fi", I: Wifi }, { v: "never", l: "Никогда", I: VolumeX }].map(o => (
                    <button key={o.v} onClick={() => set("autoDownloadMedia", o.v)}
                      className={`flex flex-col items-center gap-2 py-3 rounded-xl text-sm transition-all border ${temp.autoDownloadMedia === o.v ? "bg-violet-600/20 border-violet-500/50 text-violet-300" : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10"}`}>
                      <o.I size={18} />
                      {o.l}
                    </button>
                  ))}
                </div>
              </Section>
            </>}

            {/* ── ACCOUNT ── */}
            {tab === "account" && <>
              <Section title="Аватар">
                <div className="flex items-center gap-4 px-4 pb-4">
                  <div className="relative shrink-0">
                    <div className="w-20 h-20 rounded-full bg-violet-500/20 overflow-hidden flex items-center justify-center">
                      {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="avatar" /> : <User size={32} className="text-violet-400" />}
                    </div>
                    <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                    <button onClick={() => avatarRef.current?.click()} disabled={isUploadingAvatar}
                      className="absolute -bottom-1 -right-1 p-1.5 bg-violet-600 hover:bg-violet-500 rounded-full transition-colors disabled:opacity-50">
                      {isUploadingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                    </button>
                  </div>
                  <div className="text-sm text-white/40">
                    <p>Нажмите на иконку камеры</p>
                    <p>512×512 · до 5 МБ</p>
                  </div>
                </div>
              </Section>

              <Section title="Профиль">
                <div className="px-4 pb-4 space-y-2">
                  <input value={profile.displayName} onChange={e => setProfile(p => ({ ...p, displayName: e.target.value }))}
                    placeholder="Имя" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
                  <input value={profile.status} onChange={e => setProfile(p => ({ ...p, status: e.target.value }))}
                    placeholder="Статус" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
                  <textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                    placeholder="О себе" rows={3} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm resize-none focus:outline-none focus:border-violet-500/50 transition-colors" />
                  <div className="grid grid-cols-2 gap-2">
                    {[["telegram", "Telegram"], ["vk", "VK"], ["github", "GitHub"], ["website", "Сайт"]].map(([k, ph]) => (
                      <input key={k} value={(profile as any)[k]} onChange={e => setProfile(p => ({ ...p, [k]: e.target.value }))}
                        placeholder={ph} className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
                    ))}
                  </div>
                  <button onClick={saveProfile} disabled={isSavingProfile}
                    className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Сохранить профиль
                  </button>
                </div>
              </Section>

              <Section title="Данные и безопасность">
                <button onClick={exportData} disabled={isExporting}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-sm text-white/70">
                  <span className="flex items-center gap-3"><Download size={16} className="text-violet-400" /> Выгрузить мои данные</span>
                  <span className="text-xs text-white/30">{isExporting ? "..." : "JSON"}</span>
                </button>
                <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-sm text-white/70">
                  <span className="flex items-center gap-3"><Lock size={16} className="text-violet-400" /> Сменить пароль</span>
                  <ChevronRight size={14} className="text-white/20" />
                </button>
                <div className="h-px bg-white/5 mx-4" />
                <button className="w-full flex items-center px-4 py-3 hover:bg-red-500/5 transition-colors text-sm text-red-400/80">
                  <Trash2 size={16} className="mr-3" /> Удалить аккаунт
                </button>
              </Section>
            </>}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111114] border border-white/5 rounded-2xl overflow-hidden">
      <p className="px-4 pt-4 pb-2 text-xs font-semibold text-white/30 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function Toggle({ label, desc, icon: Icon, value, onChange }: { label: string; desc?: string; icon: React.ElementType; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
      <Icon size={16} className={value ? "text-violet-400" : "text-white/25"} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80">{label}</p>
        {desc && <p className="text-xs text-white/30 mt-0.5">{desc}</p>}
      </div>
      <div className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-violet-600" : "bg-white/15"}`}>
        <motion.div className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
          animate={{ left: value ? "22px" : "4px" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }} />
      </div>
    </button>
  );
}

function SelectRow({ label, icon: Icon, options, value, onChange }: { label: string; icon: React.ElementType; options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-4 py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3 mb-2">
        <Icon size={16} className="text-violet-400 shrink-0" />
        <p className="text-sm text-white/80">{label}</p>
      </div>
      <div className="flex gap-1.5 ml-7">
        {options.map(o => (
          <button key={o.v} onClick={() => onChange(o.v)}
            className={`flex-1 py-1.5 rounded-lg text-xs transition-all border ${value === o.v ? "bg-violet-600/25 border-violet-500/40 text-violet-300" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"}`}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
