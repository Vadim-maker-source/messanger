// app/create/[type]/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Camera, Server, Hash, Users, Globe, Lock, Link as LinkIcon,
  Plus, Trash2, MessageSquare, ArrowLeft, Check, Search, X, Loader2, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createFullServer, createChat, createGroupChat, getInviteSuggestions } from "@/app/lib/api/chat";
import { uploadChatImage } from "@/app/lib/yandex-storage";
import { generateAvatarColor } from "@/components/Avatar";

const STEPS = {
  server: ["info", "channels", "members", "access"],
  group:  ["info", "members", "access"],
  channel:["info", "members", "access"],
};

const TYPE_META = {
  server:  { label: "Сервер",  color: "from-violet-500 to-purple-600",  icon: Server,  accent: "violet" },
  group:   { label: "Группа",  color: "from-emerald-500 to-teal-600",   icon: Users,   accent: "emerald" },
  channel: { label: "Канал",   color: "from-blue-500 to-cyan-600",      icon: Hash,    accent: "blue" },
};

export default function CreatePage() {
  const params = useParams();
  const type = (params?.type as string) ?? "group";
  const router = useRouter();
  const meta = TYPE_META[type as keyof typeof TYPE_META] ?? TYPE_META.group;
  const steps = STEPS[type as keyof typeof STEPS] ?? STEPS.group;

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [access, setAccess] = useState("PUBLIC");
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]); // {id, username, avatarUrl}
  const [channels, setChannels] = useState([{ name: "general", type: "CHANNEL" }]);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [colorPreview] = useState(() => generateAvatarColor());

  // user search
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setSearching(true);
      const data = await getInviteSuggestions(query);
      setSuggestions(data);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const toggleUser = (u: any) => {
    setSelectedUsers(prev =>
      prev.find(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]
    );
  };

  const onSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      let imageUrl = "";
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await uploadChatImage(fd);
        imageUrl = r?.url || "";
      } else {
        imageUrl = colorPreview;
      }
      const userIds = selectedUsers.map(u => u.id);
      let result: any;

      if (type === "server") {
        const validChannels = channels.filter(c => c.name.trim());
        result = await createFullServer({ name, imageUrl, access, channels: validChannels, userIds });
        if (result?.chats?.[0]) router.push(`/chat/${result.chats[0].id}`);
        else router.push(`/server/${result.id}`);
      } else if (type === "group") {
        result = await createGroupChat({ name, imageUrl, access, userIds });
        router.push(`/chat/${result.id}`);
      } else {
        result = await createChat({ name, imageUrl, access, type: "CHANNEL", userIds });
        router.push(`/chat/${result.id}`);
      }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (steps[step] === "info") return name.trim().length > 0;
    if (steps[step] === "channels") return channels.some(c => c.name.trim());
    return true;
  };

  const isLast = step === steps.length - 1;
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Back */}
        <button onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
          className="flex items-center gap-2 text-white/30 hover:text-white/70 transition-colors mb-8 text-sm">
          <ArrowLeft size={16} /> {step > 0 ? "Назад" : "Отмена"}
        </button>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? `bg-gradient-to-r ${meta.color}` : 'bg-white/10'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            {/* STEP: info */}
            {steps[step] === "info" && (
              <div className="space-y-8">
                <div>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-1">{meta.label}</p>
                  <h1 className="text-3xl font-bold">Как назовём?</h1>
                </div>

                {/* Avatar */}
                <label className="group relative w-24 h-24 rounded-2xl overflow-hidden cursor-pointer block mx-auto">
                  {preview
                    ? <img src={preview} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-bold text-3xl"
                        style={{ backgroundColor: colorPreview, color: "#ffffffee" }}>
                        {name?.[0]?.toUpperCase() || <Icon size={28} className="text-white/60" />}
                      </div>
                  }
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={20} className="text-white" />
                  </div>
                  <input type="file" accept="image/*" hidden onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
                  }} />
                </label>

                {/* Name input */}
                <div className="relative">
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canNext() && setStep(s => s + 1)}
                    placeholder={`Название ${meta.label.toLowerCase()}а...`}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-lg outline-none focus:border-white/30 transition-all placeholder:text-white/20"
                  />
                  {name && (
                    <button onClick={() => setName("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP: channels */}
            {steps[step] === "channels" && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-1">Структура</p>
                  <h1 className="text-3xl font-bold">Каналы сервера</h1>
                  <p className="text-white/30 text-sm mt-1">Добавьте каналы для общения</p>
                </div>

                <div className="space-y-2">
                  {channels.map((ch, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 group hover:border-white/15 transition-all">
                      <button onClick={() => {
                        const n = [...channels];
                        n[i].type = n[i].type === "CHANNEL" ? "GROUP" : "CHANNEL";
                        setChannels(n);
                      }} className="shrink-0">
                        {ch.type === "CHANNEL"
                          ? <Hash size={16} className="text-violet-400" />
                          : <MessageSquare size={16} className="text-emerald-400" />}
                      </button>
                      <input
                        value={ch.name}
                        onChange={e => { const n = [...channels]; n[i].name = e.target.value; setChannels(n); }}
                        className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/20"
                        placeholder="название-канала"
                      />
                      {channels.length > 1 && (
                        <button onClick={() => setChannels(channels.filter((_, idx) => idx !== i))}
                          className="text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>

                <button onClick={() => setChannels([...channels, { name: "", type: "CHANNEL" }])}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-sm">
                  <Plus size={16} /> Добавить канал
                </button>
              </div>
            )}

            {/* STEP: members */}
            {steps[step] === "members" && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-1">Участники</p>
                  <h1 className="text-3xl font-bold">Кого добавим?</h1>
                  <p className="text-white/30 text-sm mt-1">Можно пропустить и добавить позже</p>
                </div>

                {/* Selected chips */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(u => (
                      <motion.div key={u.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-2 bg-white/10 rounded-full pl-1 pr-3 py-1">
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} className="w-6 h-6 rounded-full object-cover" />
                          : <div className="w-6 h-6 rounded-full bg-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-300">{u.username?.[0]?.toUpperCase()}</div>}
                        <span className="text-sm">{u.username}</span>
                        <button onClick={() => toggleUser(u)} className="text-white/30 hover:text-white/70 ml-0.5">
                          <X size={12} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Поиск по username..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3.5 text-sm outline-none focus:border-white/30 transition-all placeholder:text-white/20"
                  />
                  {searching && <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 animate-spin" />}
                </div>

                {/* Results */}
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {suggestions.map(u => {
                    const selected = selectedUsers.some(x => x.id === u.id);
                    return (
                      <button key={u.id} onClick={() => toggleUser(u)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${selected ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} className="w-9 h-9 rounded-full object-cover shrink-0" />
                          : <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0">{u.username?.[0]?.toUpperCase()}</div>}
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium truncate">{u.displayName || u.username}</p>
                          <p className="text-xs text-white/30 truncate">@{u.username}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? `bg-gradient-to-br ${meta.color} border-transparent` : 'border-white/20'}`}>
                          {selected && <Check size={11} className="text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP: access */}
            {steps[step] === "access" && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-1">Приватность</p>
                  <h1 className="text-3xl font-bold">Кто может войти?</h1>
                </div>

                <div className="space-y-2">
                  {[
                    { value: "PUBLIC",    icon: Globe,    label: "Публичный",   desc: "Любой может найти и вступить" },
                    { value: "LINK_ONLY", icon: LinkIcon, label: "По ссылке",   desc: "Только по ссылке-приглашению" },
                    { value: "PRIVATE",   icon: Lock,     label: "Приватный",   desc: "Только по приглашению от вас" },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setAccess(opt.value)}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all ${access === opt.value ? 'border-white/30 bg-white/8' : 'border-white/8 hover:border-white/15 bg-white/3'}`}>
                      <opt.icon size={20} className={access === opt.value ? 'text-white' : 'text-white/30'} />
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-semibold ${access === opt.value ? 'text-white' : 'text-white/60'}`}>{opt.label}</p>
                        <p className="text-xs text-white/30">{opt.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${access === opt.value ? `bg-gradient-to-br ${meta.color} border-transparent` : 'border-white/20'}`}>
                        {access === opt.value && <Check size={11} className="text-white" />}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Summary */}
                <div className="bg-white/3 border border-white/8 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    {preview
                      ? <img src={preview} className="w-10 h-10 rounded-xl object-cover" />
                      : <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center`}><Icon size={18} className="text-white" /></div>}
                    <div>
                      <p className="font-semibold text-sm">{name}</p>
                      <p className="text-xs text-white/30">{selectedUsers.length > 0 ? `${selectedUsers.length + 1} участников` : meta.label}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <div className="mt-8">
          {isLast ? (
            <button onClick={onSubmit} disabled={loading || !name.trim()}
              className={`w-full py-4 rounded-2xl font-bold text-base bg-gradient-to-r ${meta.color} disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2`}>
              {loading ? <><Loader2 size={18} className="animate-spin" /> Создание...</> : `Создать ${meta.label.toLowerCase()}`}
            </button>
          ) : (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
              className="w-full py-4 rounded-2xl font-bold text-base bg-white/8 hover:bg-white/12 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              Далее <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
