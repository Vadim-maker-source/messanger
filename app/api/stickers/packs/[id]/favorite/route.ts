import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/api/user";
import { favoritePack, unfavoritePack } from "@/app/lib/api/stickers";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await favoritePack(user, id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "not_found" ? 404 : 403 }
    );
  }
  return NextResponse.json(result);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await unfavoritePack(user, id);
  return NextResponse.json(result);
}
