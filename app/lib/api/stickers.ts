/**
 * Бизнес-логика стикеров — общая для web и mobile API.
 * Веб-роуты передают user из getCurrentUser, mobile — из JWT.
 */

import { prisma } from "@/app/lib/prisma";
import { uploadSticker, deleteStickerFile, makePackSlug, STICKER_LIMITS } from "@/app/lib/stickers";

interface UserCtx {
  id: string;
}

interface ListPacksOpts {
  filter?: "mine" | "favorites" | "public";
  search?: string;
}

export async function listPacks(user: UserCtx, opts: ListPacksOpts = {}) {
  const filter = opts.filter || "mine";
  const search = opts.search?.trim() || "";

  const where = (() => {
    if (filter === "mine") return { authorId: user.id };
    if (filter === "favorites") return { favorites: { some: { userId: user.id } } };
    return {
      isPublic: true,
      authorId: { not: user.id },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
  })();

  const packs = await prisma.stickerPack.findMany({
    where,
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { stickers: true, favorites: true } },
      stickers: {
        take: 4,
        orderBy: { position: "asc" },
        select: { id: true, imageUrl: true, alt: true },
      },
      favorites: { where: { userId: user.id }, select: { userId: true } },
    },
  });

  return packs.map((p) => ({
    ...p,
    isFavorite: p.favorites.length > 0,
    favorites: undefined,
  }));
}

export async function getPack(user: UserCtx, id: string) {
  const pack = await prisma.stickerPack.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { stickers: true, favorites: true } },
      stickers: { orderBy: { position: "asc" } },
      favorites: { where: { userId: user.id }, select: { userId: true } },
    },
  });
  if (!pack) return { error: "not_found" as const };
  if (!pack.isPublic && pack.authorId !== user.id) return { error: "forbidden" as const };
  return {
    pack: { ...pack, isFavorite: pack.favorites.length > 0, favorites: undefined },
  };
}

export async function createPack(user: UserCtx, input: { name: string; description?: string; isPublic?: boolean }) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 64) return { error: "Название от 2 до 64 символов" };

  const myPacksCount = await prisma.stickerPack.count({ where: { authorId: user.id } });
  if (myPacksCount >= 30) return { error: "Лимит 30 стикерпаков" };

  const pack = await prisma.stickerPack.create({
    data: {
      name,
      slug: makePackSlug(name),
      description: input.description?.trim().slice(0, 280) || null,
      isPublic: input.isPublic !== false,
      authorId: user.id,
    },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { stickers: true, favorites: true } },
      stickers: true,
    },
  });
  return { pack: { ...pack, isFavorite: false } };
}

export async function updatePack(
  user: UserCtx,
  id: string,
  input: { name?: string; description?: string; isPublic?: boolean }
) {
  const pack = await prisma.stickerPack.findUnique({ where: { id } });
  if (!pack) return { error: "not_found" as const };
  if (pack.authorId !== user.id) return { error: "forbidden" as const };

  const data: Record<string, unknown> = {};
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 64) return { error: "Название от 2 до 64 символов" };
    data.name = name;
  }
  if (typeof input.description === "string") data.description = input.description.trim().slice(0, 280) || null;
  if (typeof input.isPublic === "boolean") data.isPublic = input.isPublic;

  const updated = await prisma.stickerPack.update({
    where: { id },
    data,
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { stickers: true, favorites: true } },
      stickers: { orderBy: { position: "asc" } },
    },
  });
  return { pack: { ...updated, isFavorite: false } };
}

export async function deletePack(user: UserCtx, id: string) {
  const pack = await prisma.stickerPack.findUnique({ where: { id }, include: { stickers: true } });
  if (!pack) return { error: "not_found" as const };
  if (pack.authorId !== user.id) return { error: "forbidden" as const };

  await Promise.all([
    ...pack.stickers.map((s) => deleteStickerFile(s.imageUrl)),
    pack.coverUrl ? deleteStickerFile(pack.coverUrl) : Promise.resolve(),
  ]);
  await prisma.stickerPack.delete({ where: { id } });
  return { success: true };
}

export async function addStickerToPack(user: UserCtx, packId: string, file: File, alt?: string) {
  const pack = await prisma.stickerPack.findUnique({
    where: { id: packId },
    include: { _count: { select: { stickers: true } } },
  });
  if (!pack) return { error: "not_found" as const };
  if (pack.authorId !== user.id) return { error: "forbidden" as const };
  if (pack._count.stickers >= STICKER_LIMITS.MAX_STICKERS_PER_PACK) {
    return { error: `Лимит ${STICKER_LIMITS.MAX_STICKERS_PER_PACK} стикеров на пак` };
  }

  let imageUrl: string;
  try {
    imageUrl = await uploadSticker(file, packId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Ошибка загрузки" };
  }

  const sticker = await prisma.sticker.create({
    data: {
      packId,
      imageUrl,
      alt: alt?.slice(0, 16) || null,
      position: pack._count.stickers,
    },
  });
  return { sticker };
}

export async function deleteStickerById(user: UserCtx, id: string) {
  const sticker = await prisma.sticker.findUnique({
    where: { id },
    include: { pack: { select: { authorId: true } } },
  });
  if (!sticker) return { error: "not_found" as const };
  if (sticker.pack.authorId !== user.id) return { error: "forbidden" as const };

  await deleteStickerFile(sticker.imageUrl);
  await prisma.sticker.delete({ where: { id } });
  return { success: true };
}

export async function favoritePack(user: UserCtx, packId: string) {
  const pack = await prisma.stickerPack.findUnique({ where: { id: packId } });
  if (!pack) return { error: "not_found" as const };
  if (!pack.isPublic && pack.authorId !== user.id) return { error: "forbidden" as const };

  await prisma.stickerPackFavorite.upsert({
    where: { userId_packId: { userId: user.id, packId } },
    create: { userId: user.id, packId },
    update: {},
  });
  return { success: true };
}

export async function unfavoritePack(user: UserCtx, packId: string) {
  await prisma.stickerPackFavorite.deleteMany({ where: { userId: user.id, packId } });
  return { success: true };
}
