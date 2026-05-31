import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/api/user";
import { addStickerToPack } from "@/app/lib/api/stickers";

// Файлы могут быть до 50 МБ — увеличиваем таймаут до 60s (по умолчанию 10s)
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: packId } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const alt = (formData.get("alt") as string | null) || undefined;

  if (!file) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });

  const result = await addStickerToPack(user, packId, file, alt);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
