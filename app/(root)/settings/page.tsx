// app/settings/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { toast } from "sonner";
import {
  Shield, Palette, Bell, MessageSquare, User,
  ChevronRight, ArrowLeft, Moon, Sun, Monitor,
  Upload, Trash2, Loader2, Camera, Check,
  Eye, EyeOff, Lock, Globe, Users, Volume2,
  Smartphone, Wifi, Download, Image as ImageIcon,
  XCircle,
} from "lucide-react";
import {
  getOwnProfileEditorData, removeUserBackground,
  updateOwnProfile, uploadUserAvatar, uploadUserBackground
} from "@/app/lib/api/user";
import { useSettings } from "@/components/SettingsProvider";
import { SettingsType } from "@/app/lib/types";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

type Tab = "privacy" | "appearance" | "notifications" | "chat" | "account";

const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "privacy",       label: "Приватность",  icon: Shield,        desc: "Видимость и доступ" },
  { id: "appearance",    label: "Внешний вид",  icon: Palette,       desc: "Тема, шрифт, фон" },
  { id: "notifications", label: "Уведомления",  icon: Bell,          desc: "Push, звук, вибрация" },
  { id: "chat",          label: "Чаты",         icon: MessageSquare, desc: "Поведение и медиа" },
  { id: "account",       label: "Аккаунт",      icon: User,          desc: "Профиль и безопасность" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { settings, isLoading, updateMultipleSettings } = useSettings();
  const [tab, setTab] = useState<Tab>("privacy");
  const [dirty, setDirty] = useState(false);
  const [temp, setTemp] = useState<SettingsType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [profile, setProfile] = useState({ displayName: "", bio: "", status: "", telegram: "", vk: "", github: "", website: "" });
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

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
    try {
      await updateMultipleSettings(temp);
      setDirty(false);
      toast.success("Настройки сохранены");
    } catch {
      toast.error("Не удалось сохранить настройки");
    }
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

  const validateLinks = () => {
    const errors: Record<string, string> = {};
    const rules: [string, string, RegExp][] = [
      ["telegram", "Telegram", /^https?:\/\/(t\.me|telegram\.me)\/.+/i],
      ["vk",       "VK",       /^https?:\/\/(vk\.com|vkontakte\.ru)\/.+/i],
      ["github",   "GitHub",   /^https?:\/\/github\.com\/.+/i],
      ["website",  "Сайт",     /^https?:\/\/.+\..+/i],
    ];
    for (const [key, label, pattern] of rules) {
      const val = (profile as any)[key]?.trim();
      if (val && !pattern.test(val)) errors[key] = `Неверная ссылка для ${label}`;
    }
    return errors;
  };

  const saveProfile = async () => {
    const errors = validateLinks();
    setLinkErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSavingProfile(true);
    try {
      await updateOwnProfile({ displayName: profile.displayName, bio: profile.bio, status: profile.status, socialLinks: { telegram: profile.telegram, vk: profile.vk, github: profile.github, website: profile.website } });
      toast.success("Профиль обновлён");
    } catch {
      toast.error("Не удалось сохранить профиль");
    } finally { setIsSavingProfile(false); }
  };

  if (isLoading || !temp) return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
      <Loader2 className="text-violet-400 animate-spin" size={28} />
    </div>
  );

  const activeTab = TABS.find(t => t.id === tab)!;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-[#0a0a0c]/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => router.back()}
            className="flex items-center gap-2 px-3 py-2 -ml-3 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
            <ArrowLeft size={18} />
            <span className="text-sm">Назад</span>
          </button>
          <h1 className="text-base font-medium tracking-tight">Настройки</h1>
          <div className="min-w-[110px] flex justify-end">
            <AnimatePresence mode="wait">
              {dirty && (
                <motion.button key="save"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  onClick={save} disabled={isSaving}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  Сохранить
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
        {/* hairline divider */}
        <div className="h-px bg-white/5" />
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[260px_1fr] gap-12">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-1">
            {TABS.map(t => {
              const isActive = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left group ${
                    isActive ? "bg-white/5" : "hover:bg-white/[0.03]"
                  }`}>
                  <t.icon size={17} className={isActive ? "text-violet-400" : "text-white/40 group-hover:text-white/60"} />
                  <span className={`text-sm flex-1 ${isActive ? "text-white" : "text-white/60 group-hover:text-white/80"}`}>
                    {t.label}
                  </span>
                  {isActive && <div className="w-1 h-5 bg-violet-500 rounded-full" />}
                </button>
              );
            })}
          </aside>

          {/* Main */}
          <main className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-8"
              >
                {/* Section header */}
                <div className="space-y-1.5 pb-2">
                  <h2 className="text-3xl font-semibold tracking-tight">{activeTab.label}</h2>
                  <p className="text-sm text-white/40">{activeTab.desc}</p>
                </div>

                {/* ── PRIVACY ── */}
                {tab === "privacy" && <>
                  <Group title="Видимость">
                    <Toggle label="Статус «В сети»" desc="Другие видят, когда вы онлайн" icon={Eye} value={temp.showOnlineStatus ?? true} onChange={v => set("showOnlineStatus", v)} />
                    <Toggle label="Время последнего визита" desc="Показывать «был(а) в сети»" icon={EyeOff} value={temp.showLastSeen ?? true} onChange={v => set("showLastSeen", v)} />
                  </Group>
                  <Group title="Доступ">
                    <SelectRow label="Личные сообщения" icon={MessageSquare}
                      options={[{ v: "everyone", l: "Все" }, { v: "contacts", l: "Контакты" }, { v: "nobody", l: "Никто" }]}
                      value={temp.allowDirectMessages ?? "everyone"} onChange={v => set("allowDirectMessages", v)} />
                    <SelectRow label="Добавление в чаты" icon={Users}
                      options={[{ v: "everyone", l: "Все" }, { v: "contacts", l: "Контакты" }, { v: "nobody", l: "Никто" }]}
                      value={temp.allowAddToChats ?? "everyone"} onChange={v => set("allowAddToChats", v)} />
                    <SelectRow label="Видимость профиля" icon={Globe}
                      options={[{ v: "public", l: "Публичный" }, { v: "contacts", l: "Контакты" }, { v: "private", l: "Приватный" }]}
                      value={temp.profileVisibility ?? "public"} onChange={v => set("profileVisibility", v)} />
                  </Group>
                </>}

                {/* ── APPEARANCE ── */}
                {tab === "appearance" && <>
                  <Group title="Тема">
                    <div className="grid grid-cols-3 gap-2">
                      {[{ v: "light", l: "Светлая", I: Sun }, { v: "dark", l: "Тёмная", I: Moon }, { v: "system", l: "Система", I: Monitor }].map(o => (
                        <SelectionTile key={o.v} active={temp.theme === o.v} onClick={() => set("theme", o.v)}>
                          <o.I size={20} className={temp.theme === o.v ? "text-violet-400" : "text-white/50"} />
                          <span className="text-sm">{o.l}</span>
                        </SelectionTile>
                      ))}
                    </div>
                  </Group>

                  <Group title="Размер текста">
                    <div className="grid grid-cols-3 gap-2">
                      {[{ v: "small", l: "Мелкий", s: "text-sm" }, { v: "medium", l: "Средний", s: "text-base" }, { v: "large", l: "Крупный", s: "text-lg" }].map(o => (
                        <SelectionTile key={o.v} active={temp.messageFontSize === o.v} onClick={() => set("messageFontSize", o.v)}>
                          <span className={`${o.s} font-medium`}>Aa</span>
                          <span className="text-sm">{o.l}</span>
                        </SelectionTile>
                      ))}
                    </div>
                  </Group>

                  <Group title="Фон чата">
                    {temp.chatBackground ? (
                      <div className="relative h-44 rounded-2xl overflow-hidden bg-[#16161b] group">
                        <img src={temp.chatBackground} className="w-full h-full object-cover" alt="" />
                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button onClick={() => fileRef.current?.click()} disabled={isUploadingBg}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl text-sm font-medium flex items-center gap-2">
                            <Upload size={14} /> Заменить
                          </button>
                          <button onClick={handleBgRemove} disabled={isUploadingBg}
                            className="px-4 py-2 bg-red-500/80 hover:bg-red-500 rounded-xl text-sm font-medium flex items-center gap-2">
                            <Trash2 size={14} /> Удалить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => fileRef.current?.click()} disabled={isUploadingBg}
                        className="w-full h-44 flex flex-col items-center justify-center gap-2 bg-[#16161b] hover:bg-[#1a1a20] rounded-2xl transition-colors disabled:opacity-50">
                        {isUploadingBg ? (
                          <Loader2 size={22} className="animate-spin text-white/40" />
                        ) : (
                          <>
                            <Upload size={20} className="text-white/40" />
                            <span className="text-sm text-white/60">Загрузить фон</span>
                            <span className="text-xs text-white/30">JPG, PNG, WEBP · до 5 МБ</span>
                          </>
                        )}
                      </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                  </Group>
                </>}

                {/* ── NOTIFICATIONS ── */}
                {tab === "notifications" && <>
                  <Group title="Push-уведомления">
                    <Toggle label="Получать уведомления" desc="Когда приложение в фоне" icon={Bell} value={temp.pushNotifications ?? true} onChange={v => set("pushNotifications", v)} />
                    <Toggle label="Звук" desc="Воспроизводить сигнал" icon={Volume2} value={temp.soundNotifications ?? true} onChange={v => set("soundNotifications", v)} />
                    <Toggle label="Вибрация" desc="Тактильный отклик" icon={Smartphone} value={temp.vibration ?? true} onChange={v => set("vibration", v)} />
                  </Group>
                  <Group title="Содержимое">
                    <Toggle label="Предпросмотр сообщения" desc="Показывать текст в push" icon={Eye} value={temp.showNotificationPreview ?? true} onChange={v => set("showNotificationPreview", v)} />
                  </Group>
                </>}

                {/* ── CHAT ── */}
                {tab === "chat" && <>
                  <Group title="Поведение">
                    <Toggle label="Отчёты о прочтении" desc="Отправлять ✓✓ когда прочитано" icon={Check} value={temp.sendReadReceipts ?? true} onChange={v => set("sendReadReceipts", v)} />
                    <Toggle label="Индикатор набора" desc='Показывать «печатает…»' icon={MessageSquare} value={temp.showTypingIndicator ?? true} onChange={v => set("showTypingIndicator", v)} />
                    <Toggle label="Сжимать изображения" desc="Уменьшать перед отправкой" icon={ImageIcon} value={temp.compressImages ?? true} onChange={v => set("compressImages", v)} />
                  </Group>
                  <Group title="Автозагрузка медиа">
                    <div className="grid grid-cols-3 gap-2">
                      {[{ v: "always", l: "Всегда", I: Download }, { v: "wifi", l: "Только Wi-Fi", I: Wifi }, { v: "never", l: "Никогда", I: XCircle }].map(o => (
                        <SelectionTile key={o.v} active={temp.autoDownloadMedia === o.v} onClick={() => set("autoDownloadMedia", o.v)}>
                          <o.I size={18} className={temp.autoDownloadMedia === o.v ? "text-violet-400" : "text-white/50"} />
                          <span className="text-sm">{o.l}</span>
                        </SelectionTile>
                      ))}
                    </div>
                  </Group>
                </>}

                {/* ── ACCOUNT ── */}
                {tab === "account" && <>
                  {/* Profile hero — аватар + имя */}
                  <div className="bg-[#13131a] rounded-3xl">
                    <div className="flex items-center gap-5 p-6">
                      <div className="relative shrink-0">
                        <div className="w-24 h-24 rounded-full bg-[#1f1f26] overflow-hidden flex items-center justify-center">
                          {avatarUrl ? (
                            <img src={avatarUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <User size={36} className="text-white/30" />
                          )}
                        </div>
                        <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                        <button onClick={() => avatarRef.current?.click()} disabled={isUploadingAvatar}
                          className="absolute -bottom-1 -right-1 w-9 h-9 bg-violet-600 hover:bg-violet-500 rounded-full transition-colors disabled:opacity-50 flex items-center justify-center text-white">
                          {isUploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-semibold text-white truncate">
                          {profile.displayName || "Без имени"}
                        </p>
                        {profile.status && (
                          <p className="text-sm text-white/50 truncate mt-0.5">{profile.status}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Group title="Профиль">
                    <Field label="Отображаемое имя" value={profile.displayName} onChange={v => setProfile(p => ({ ...p, displayName: v }))} placeholder="Например, Иван Иванов" />
                    <Field label="Статус" value={profile.status} onChange={v => setProfile(p => ({ ...p, status: v }))} placeholder="Что у вас сейчас на уме?" />
                    <FieldArea label="О себе" value={profile.bio} onChange={v => setProfile(p => ({ ...p, bio: v }))} placeholder="Расскажите немного о себе..." />
                  </Group>

                  <Group title="Социальные сети">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        ["telegram", "Telegram", "https://t.me/username"],
                        ["vk", "VK", "https://vk.com/username"],
                        ["github", "GitHub", "https://github.com/username"],
                        ["website", "Сайт", "https://example.com"],
                      ].map(([k, label, ph]) => (
                        <Field
                          key={k}
                          label={label}
                          value={(profile as any)[k]}
                          onChange={v => { setProfile(p => ({ ...p, [k]: v })); setLinkErrors(p => ({ ...p, [k]: "" })); }}
                          placeholder={ph}
                          error={linkErrors[k]}
                        />
                      ))}
                    </div>
                    <button onClick={saveProfile} disabled={isSavingProfile}
                      className="w-full py-3 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                      {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : "Сохранить профиль"}
                    </button>
                  </Group>

                  {/* Security — с 3D замком */}
                  <Group title="Безопасность">
                    <button onClick={() => setShowChangePassword(true)}
                      className="w-full bg-[#13131a] hover:bg-[#16161e] rounded-2xl transition-colors text-left flex items-center gap-4 p-5 group">
                      <div className="relative w-14 h-14 shrink-0">
                        <Image src="/images/3dlock.png" alt="" fill className="object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">Сменить пароль</p>
                        <p className="text-xs text-white/50 mt-0.5">С подтверждением через push или email</p>
                      </div>
                      <ChevronRight size={18} className="text-white/30 group-hover:text-white/60 transition-colors" />
                    </button>
                  </Group>

                  <Group title="Опасная зона">
                    <button className="w-full flex items-center gap-4 p-4 -mx-4 rounded-2xl hover:bg-red-500/5 transition-colors text-left">
                      <Trash2 size={18} className="text-red-400 shrink-0 ml-1" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-400">Удалить аккаунт</p>
                        <p className="text-xs text-white/40 mt-0.5">Все ваши данные будут удалены без возможности восстановления</p>
                      </div>
                      <ChevronRight size={16} className="text-red-400/30 mr-1" />
                    </button>
                  </Group>
                </>}

              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      <ChangePasswordDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </div>
  );
}

/* ── Building blocks ─────────────────────────────────────────────── */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium text-white/35 uppercase tracking-[0.12em] ml-1">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Toggle({ label, desc, icon: Icon, value, onChange }: { label: string; desc?: string; icon: React.ElementType; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="w-full flex items-center gap-4 px-4 py-3.5 -mx-4 rounded-2xl hover:bg-white/[0.03] transition-colors text-left">
      <Icon size={17} className={value ? "text-violet-400" : "text-white/30"} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90">{label}</p>
        {desc && <p className="text-xs text-white/40 mt-0.5">{desc}</p>}
      </div>
      <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-violet-600" : "bg-white/10"}`}>
        <motion.div className="absolute top-1 w-4 h-4 bg-white rounded-full"
          animate={{ left: value ? "22px" : "4px" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }} />
      </div>
    </button>
  );
}

function SelectRow({ label, icon: Icon, options, value, onChange }: { label: string; icon: React.ElementType; options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-4 py-3 -mx-4 space-y-3">
      <div className="flex items-center gap-3">
        <Icon size={17} className="text-white/40 shrink-0" />
        <p className="text-sm text-white/90">{label}</p>
      </div>
      <div className="flex gap-1.5 ml-7">
        {options.map(o => (
          <button key={o.v} onClick={() => onChange(o.v)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
              value === o.v
                ? "bg-violet-500/15 text-violet-300"
                : "bg-[#16161b] text-white/50 hover:bg-[#1a1a22] hover:text-white/70"
            }`}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectionTile({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-2 py-5 rounded-2xl transition-colors ${
        active
          ? "bg-violet-500/10 ring-1 ring-violet-500/40 text-white"
          : "bg-[#13131a] hover:bg-[#181820] text-white/60"
      }`}>
      {children}
      {active && (
        <motion.div
          layoutId="tile-check"
          className="absolute top-2 right-2 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center"
        >
          <Check size={10} className="text-white" strokeWidth={3} />
        </motion.div>
      )}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, error }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/50 ml-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-4 py-3 bg-[#16161b] rounded-xl text-white text-sm outline-none transition-all focus:ring-1 ${
          error ? "ring-1 ring-red-500/50 focus:ring-red-500/50" : "focus:ring-violet-500/40"
        }`} />
      {error && <p className="text-xs text-red-400 ml-1">{error}</p>}
    </div>
  );
}

function FieldArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/50 ml-1">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        className="w-full px-4 py-3 bg-[#16161b] rounded-xl text-white text-sm resize-none outline-none focus:ring-1 focus:ring-violet-500/40 transition-all" />
    </div>
  );
}
