import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

/**
 * GET /api/mobile/stickers/by-url?url=... (mobile mirror)
 */
export async function GET(req: NextRequest) {
  const user = await getMobileUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const sticker = await prisma.sticker.findFirst({
    where: { imageUrl: url },
    select: { packId: true },
  });
  if (!sticker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pack = await prisma.stickerPack.findUnique({
    where: { id: sticker.packId },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { stickers: true, favorites: true } },
      stickers: { orderBy: { position: "asc" } },
      favorites: { where: { userId: user.id }, select: { userId: true } },
    },
  });
  if (!pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });
  if (!pack.isPublic && pack.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    pack: { ...pack, isFavorite: pack.favorites.length > 0, favorites: undefined },
  });
}
