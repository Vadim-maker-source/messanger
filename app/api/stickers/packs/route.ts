import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/api/user";
import { listPacks, createPack } from "@/app/lib/api/stickers";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filter = (req.nextUrl.searchParams.get("filter") || "mine") as "mine" | "favorites" | "public";
  const search = req.nextUrl.searchParams.get("search") || "";

  const packs = await listPacks(user, { filter, search });
  return NextResponse.json({ packs });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const result = await createPack(user, body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
