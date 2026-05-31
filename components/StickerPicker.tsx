"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sticker as StickerIcon,
  Search,
  Star,
  Plus,
  X,
  Heart,
  Globe,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Типы ───────────────────────────────────────────────────────────────────

interface StickerPreview {
  id: string;
  imageUrl: string;
  alt: string | null;
}

interface PackAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface PackSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  authorId: string;
  author: PackAuthor;
  stickers: StickerPreview[]; // первые 4 для превью
  _count: { stickers: number; favorites: number };
  isFavorite: boolean;
  createdAt: string;
}

interface PackDetails extends PackSummary {
  stickers: StickerPreview[]; // все стикеры пака
}

type Mode = "mine" | "favorites" | "discover" | "create";

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  onSendSticker: (sticker: { imageUrl: string; alt: string | null; packName: string }) => void;
}

// ─── Главный компонент ──────────────────────────────────────────────────────

export default function StickerPicker({ open, onClose, anchorRef, onSendSticker }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("mine");

  // Закрытие по клику вне и Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-full left-0 mb-3 z-50 w-[560px] h-[540px] bg-[#16161a] border border-white/10 rounded-2xl shadow-2xl flex overflow-hidden"
        >
          {/* Левая узкая колонка с режимами */}
          <ModeSidebar mode={mode} onChange={setMode} onClose={onClose} />

          {/* Контент режима */}
          <div className="flex-1 flex flex-col min-w-0">
            {mode === "mine" && <PacksView filter="mine" onSend={onSendSticker} />}
            {mode === "favorites" && <PacksView filter="favorites" onSend={onSendSticker} />}
            {mode === "discover" && <DiscoverView />}
            {mode === "create" && <CreateView onCreated={() => setMode("mine")} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Левая колонка с режимами (иконки) ──────────────────────────────────────

function ModeSidebar({
  mode,
  onChange,
  onClose,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-14 bg-[#0e0e10] border-r border-white/[0.06] flex flex-col py-2">
      <ModeButton active={mode === "mine"} onClick={() => onChange("mine")} title="Мои стикерпаки">
        <StickerIcon size={20} />
      </ModeButton>
      <ModeButton
        active={mode === "favorites"}
        onClick={() => onChange("favorites")}
        title="Избранные"
      >
        <Heart size={20} />
      </ModeButton>
      <ModeButton
        active={mode === "discover"}
        onClick={() => onChange("discover")}
        title="Найти стикеры"
      >
        <Globe size={20} />
      </ModeButton>
      <ModeButton
        active={mode === "create"}
        onClick={() => onChange("create")}
        title="Создать пак"
      >
        <Plus size={20} />
      </ModeButton>

      <div className="flex-1" />

      <button
        onClick={onClose}
        className="mx-auto w-10 h-10 mb-1 rounded-xl grid place-items-center text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors"
        title="Закрыть"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`mx-auto my-0.5 w-10 h-10 rounded-xl grid place-items-center transition-all ${
        active
          ? "bg-violet-500 text-white"
          : "text-white/45 hover:text-white hover:bg-white/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Режим "Мои" / "Избранные" — двухколоночный layout ──────────────────────

function PacksView({
  filter,
  onSend,
}: {
  filter: "mine" | "favorites";
  onSend: Props["onSendSticker"];
}) {
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [activePack, setActivePack] = useState<PackDetails | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stickers/packs?filter=${filter}`);
      const data = await res.json();
      const list: PackSummary[] = data.packs || [];
      setPacks(list);
      // Авто-выбор первого пака если активный пропал
      if (list.length > 0) {
        const exists = list.find((p) => p.id === activePackId);
        if (!exists) {
          setActivePackId(list[0].id);
          openPack(list[0].id);
        }
      } else {
        setActivePackId(null);
        setActivePack(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const openPack = async (id: string) => {
    setActivePackId(id);
    try {
      const res = await fetch(`/api/stickers/packs/${id}`);
      const data = await res.json();
      if (data.pack) setActivePack(data.pack);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div>
          <StickerIcon size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-base text-white/55 font-medium">
            {filter === "mine" ? "У вас пока нет стикерпаков" : "Нет избранных паков"}
          </p>
          <p className="text-sm text-white/35 mt-1.5 max-w-xs">
            {filter === "mine"
              ? "Создайте свой через значок «+» слева"
              : "Найдите интересные паки через значок 🌐"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Боковая панель с превью паков */}
      <div className="w-16 bg-[#101013] border-r border-white/[0.04] py-2 overflow-y-auto">
        {packs.map((p) => (
          <PackPreviewButton
            key={p.id}
            pack={p}
            active={activePackId === p.id}
            onClick={() => openPack(p.id)}
          />
        ))}
      </div>

      {/* Сетка стикеров активного пака */}
      <div className="flex-1 flex flex-col min-w-0">
        {activePack ? (
          <ActivePackContent
            pack={activePack}
            onSend={(s) =>
              onSend({ imageUrl: s.imageUrl, alt: s.alt, packName: activePack.name })
            }
            onChanged={async () => {
              if (activePackId) await openPack(activePackId);
              await load();
            }}
            onPackDeleted={async () => {
              setActivePackId(null);
              setActivePack(null);
              await load();
            }}
          />
        ) : (
          <div className="flex-1 grid place-items-center text-sm text-white/40">
            Выберите пак слева
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Превью пака (кнопка в боковой полоске) ─────────────────────────────────

function PackPreviewButton({
  pack,
  active,
  onClick,
}: {
  pack: PackSummary;
  active: boolean;
  onClick: () => void;
}) {
  // Превью = первая картинка пака; fallback: обложка
  const preview = pack.stickers[0]?.imageUrl || pack.coverUrl;
  return (
    <button
      onClick={onClick}
      title={pack.name}
      className={`relative w-12 h-12 mx-auto mb-1 rounded-xl grid place-items-center transition-all ${
        active
          ? "bg-violet-500/15 ring-2 ring-violet-500"
          : "hover:bg-white/[0.06]"
      }`}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={pack.name}
          className="w-9 h-9 object-contain"
          loading="lazy"
        />
      ) : (
        <StickerIcon size={20} className="text-white/30" />
      )}
    </button>
  );
}

// ─── Сетка стикеров активного пака ──────────────────────────────────────────

function ActivePackContent({
  pack,
  onSend,
  onChanged,
  onPackDeleted,
}: {
  pack: PackDetails;
  onSend: (s: StickerPreview) => void;
  onChanged: () => void | Promise<void>;
  onPackDeleted: () => void | Promise<void>;
}) {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/auth/socket-token")
      .then((r) => r.json())
      .then((d) => setMe(d.userId || null))
      .catch(() => {});
  }, []);

  const isOwner = me === pack.authorId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    let success = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(`/api/stickers/packs/${pack.id}/stickers`, {
          method: "POST",
          body: fd,
        });
        if (res.ok) success++;
        else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Ошибка загрузки");
        }
      } catch {
        toast.error("Ошибка загрузки");
      }
    }
    if (success > 0) toast.success(`Добавлено стикеров: ${success}`);
    e.target.value = "";
    await onChanged();
  };

  const handleDeleteSticker = async (id: string) => {
    if (!confirm("Удалить стикер?")) return;
    try {
      await fetch(`/api/stickers/${id}`, { method: "DELETE" });
      await onChanged();
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  const handleDeletePack = async () => {
    if (!confirm(`Удалить стикерпак «${pack.name}»? Все ${pack._count.stickers} стикеров будут удалены безвозвратно.`)) return;
    try {
      const res = await fetch(`/api/stickers/packs/${pack.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Не удалось удалить пак");
        return;
      }
      toast.success("Пак удалён");
      await onPackDeleted();
    } catch {
      toast.error("Не удалось удалить пак");
    }
  };

  return (
    <>
      {/* Шапка с инфой о паке */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{pack.name}</div>
          <div className="text-[11px] text-white/45">
            от @{pack.author.username} · {pack._count.stickers} стик. · {pack._count.favorites} ★
          </div>
        </div>
        {isOwner && (
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium transition-colors"
              title="Добавить стикер"
            >
              <Plus size={13} /> Добавить
            </button>
            <button
              onClick={handleDeletePack}
              className="w-8 h-8 grid place-items-center rounded-lg bg-white/[0.04] hover:bg-red-500/15 text-white/55 hover:text-red-400 transition-colors"
              title="Удалить пак"
            >
              <Trash2 size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/webp,image/gif,image/jpeg"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        )}
      </div>

      {/* Сетка */}
      <div className="flex-1 overflow-y-auto p-3">
        {pack.stickers.length === 0 ? (
          <div className="h-full grid place-items-center text-center">
            <div>
              <StickerIcon size={32} className="mx-auto text-white/20 mb-2" />
              <p className="text-sm text-white/45">Пак пустой</p>
              {isOwner && (
                <p className="text-xs text-white/30 mt-1">Загрузите стикеры через «Добавить»</p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {pack.stickers.map((s) => (
              <div key={s.id} className="group relative aspect-square">
                <button
                  onClick={() => onSend(s)}
                  className="w-full h-full rounded-lg hover:bg-white/[0.05] p-2 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.imageUrl}
                    alt={s.alt || ""}
                    className="w-full h-full object-contain"
                  />
                </button>
                {isOwner && (
                  <button
                    onClick={() => handleDeleteSticker(s.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    title="Удалить"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Discover (публичные паки) ──────────────────────────────────────────────

function DiscoverView() {
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/stickers/packs?filter=public${
        search ? `&search=${encodeURIComponent(search)}` : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();
      setPacks(data.packs || []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const toggleFavorite = async (pack: PackSummary) => {
    try {
      const method = pack.isFavorite ? "DELETE" : "POST";
      await fetch(`/api/stickers/packs/${pack.id}/favorite`, { method });
      setPacks((prev) =>
        prev.map((p) => (p.id === pack.id ? { ...p, isFavorite: !pack.isFavorite } : p))
      );
      toast.success(pack.isFavorite ? "Убрано из избранного" : "Добавлено в избранное");
    } catch {
      toast.error("Ошибка");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Поиск */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.05]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск стикерпаков..."
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white/[0.04] border border-white/[0.06] rounded-lg text-white outline-none focus:border-violet-500/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && (
          <div className="text-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-white/40 mx-auto" />
          </div>
        )}
        {!loading && packs.length === 0 && (
          <div className="text-center text-sm text-white/40 py-8">
            {search ? "Ничего не найдено" : "Публичных паков пока нет"}
          </div>
        )}
        {packs.map((pack) => (
          <DiscoverPackCard key={pack.id} pack={pack} onToggleFavorite={toggleFavorite} />
        ))}
      </div>
    </div>
  );
}

function DiscoverPackCard({
  pack,
  onToggleFavorite,
}: {
  pack: PackSummary;
  onToggleFavorite: (p: PackSummary) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
      {/* Превью — первая картинка */}
      <div className="w-14 h-14 shrink-0 rounded-xl bg-black/40 grid place-items-center overflow-hidden">
        {pack.stickers[0]?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pack.stickers[0].imageUrl}
            alt={pack.name}
            className="w-12 h-12 object-contain"
            loading="lazy"
          />
        ) : (
          <StickerIcon size={20} className="text-white/30" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{pack.name}</div>
        <div className="text-[11px] text-white/45 truncate">
          от @{pack.author.username} · {pack._count.stickers} стикеров
        </div>
        {pack.description && (
          <div className="text-xs text-white/55 mt-0.5 line-clamp-1">{pack.description}</div>
        )}
      </div>

      <button
        onClick={() => onToggleFavorite(pack)}
        className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center transition-colors ${
          pack.isFavorite
            ? "bg-violet-500 text-white"
            : "bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white"
        }`}
        title={pack.isFavorite ? "Убрать из избранного" : "В избранное"}
      >
        <Star size={15} fill={pack.isFavorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

// ─── Создание пака ──────────────────────────────────────────────────────────

function CreateView({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (name.trim().length < 2) {
      toast.error("Название минимум 2 символа");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/stickers/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), isPublic }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка");
        return;
      }
      toast.success(`Пак «${name.trim()}» создан`);
      setName("");
      setDescription("");
      onCreated();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-md mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Создать стикерпак</h2>
          <p className="text-sm text-white/55">
            После создания загрузите стикеры (PNG, WEBP, GIF, JPG до 50 МБ)
          </p>
        </div>

        <div>
          <label className="text-xs text-white/55 mb-1.5 block uppercase tracking-wider font-medium">
            Название <span className="text-violet-400">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            placeholder="Например: «Котики на районе»"
            className="w-full px-4 py-3 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white outline-none focus:border-violet-500/40 transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-white/55 mb-1.5 block uppercase tracking-wider font-medium">
            Описание
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="О чём этот пак?"
            className="w-full px-4 py-3 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white outline-none focus:border-violet-500/40 transition-colors resize-none"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="mt-0.5 accent-violet-500"
          />
          <div>
            <div className="text-sm font-medium text-white">Публичный пак</div>
            <div className="text-xs text-white/50 mt-0.5">
              Другие пользователи смогут найти и добавить в избранное
            </div>
          </div>
        </label>

        <button
          onClick={create}
          disabled={creating || name.trim().length < 2}
          className="w-full py-3 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Создать пак
        </button>
      </div>
    </div>
  );
}
