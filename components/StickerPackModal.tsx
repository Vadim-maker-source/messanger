"use client";

import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Sticker as StickerIcon, Star, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

interface StickerData {
  id: string;
  imageUrl: string;
  alt: string | null;
}

interface PackData {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  authorId: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  stickers: StickerData[];
  _count: { stickers: number; favorites: number };
  isFavorite: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** URL стикера, по которому открыли модалку */
  stickerUrl: string | null;
  /** ID текущего пользователя — чтобы знать, его это пак или нет */
  currentUserId: string;
}

export default function StickerPackModal({ open, onClose, stickerUrl, currentUserId }: Props) {
  const [pack, setPack] = useState<PackData | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!stickerUrl) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/stickers/by-url?url=${encodeURIComponent(stickerUrl)}`);
      if (res.status === 404) {
        setNotFound(true);
        setPack(null);
        return;
      }
      if (!res.ok) {
        toast.error("Не удалось загрузить пак");
        return;
      }
      const data = await res.json();
      setPack(data.pack);
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [stickerUrl]);

  useEffect(() => {
    if (open && stickerUrl) load();
    if (!open) {
      // Сброс при закрытии — чтобы при следующем открытии не моргала старая инфа
      setPack(null);
      setNotFound(false);
    }
  }, [open, stickerUrl, load]);

  const toggleFavorite = async () => {
    if (!pack) return;
    setSavingFavorite(true);
    try {
      const method = pack.isFavorite ? "DELETE" : "POST";
      const res = await fetch(`/api/stickers/packs/${pack.id}/favorite`, { method });
      if (!res.ok) {
        toast.error("Не получилось");
        return;
      }
      setPack({ ...pack, isFavorite: !pack.isFavorite });
      toast.success(pack.isFavorite ? "Убрано из избранного" : "Добавлено в избранное");
    } finally {
      setSavingFavorite(false);
    }
  };

  const isOwner = pack?.authorId === currentUserId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#121214] text-white w-full max-w-lg p-0 overflow-hidden">
        <div className="max-h-[80vh] flex flex-col">
          {loading && (
            <div className="p-12 grid place-items-center">
              <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            </div>
          )}

          {notFound && !loading && (
            <div className="p-12 text-center">
              <StickerIcon size={40} className="mx-auto text-white/20 mb-3" />
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-white">
                  Пак не найден
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-white/45 mt-2">
                Возможно, автор удалил его
              </p>
            </div>
          )}

          {pack && !loading && (
            <>
              {/* Шапка */}
              <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  {/* Превью пака — первая картинка */}
                  <div className="w-14 h-14 shrink-0 rounded-2xl bg-black/40 grid place-items-center overflow-hidden">
                    {pack.stickers[0]?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pack.stickers[0].imageUrl}
                        alt={pack.name}
                        className="w-12 h-12 object-contain"
                      />
                    ) : (
                      <StickerIcon size={20} className="text-white/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base font-bold text-white truncate flex items-center gap-1.5">
                      {pack.name}
                      {!pack.isPublic && <Lock size={12} className="text-white/40" />}
                    </DialogTitle>
                    <div className="text-xs text-white/45 truncate mt-0.5">
                      от @{pack.author.username} · {pack._count.stickers} стик. ·{" "}
                      {pack._count.favorites} ★
                    </div>
                  </div>
                </div>
                {pack.description && (
                  <p className="text-sm text-white/65 mt-3 leading-relaxed">{pack.description}</p>
                )}
              </DialogHeader>

              {/* Сетка стикеров */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-4 gap-2">
                  {pack.stickers.map((s) => (
                    <div
                      key={s.id}
                      className="aspect-square rounded-lg bg-white/[0.02] hover:bg-white/[0.04] p-2 transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.imageUrl}
                        alt={s.alt || ""}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Футер с кнопкой */}
              <div className="px-5 py-4 border-t border-white/[0.06] bg-[#0e0e10]">
                {isOwner ? (
                  <div className="text-center text-sm text-white/55">
                    Это ваш пак — он уже у вас в «Мои»
                  </div>
                ) : (
                  <button
                    onClick={toggleFavorite}
                    disabled={savingFavorite}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                      pack.isFavorite
                        ? "bg-white/[0.06] hover:bg-white/[0.1] text-white"
                        : "bg-violet-500 hover:bg-violet-600 text-white"
                    }`}
                  >
                    {savingFavorite ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Star size={16} fill={pack.isFavorite ? "currentColor" : "none"} />
                    )}
                    {pack.isFavorite ? "Убрать из избранного" : "Сохранить пак"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
