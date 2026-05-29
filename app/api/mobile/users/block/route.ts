import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { pusherServer } from "@/app/lib/pusher";

// POST /api/mobile/users/block  { targetId }  — block
// DELETE /api/mobile/users/block { targetId }  — unblock
// GET /api/mobile/users/block?targetId=...     — check status

export async function GET(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const targetId = new URL(req.url).searchParams.get("targetId");
    if (!targetId) return NextResponse.json({ success: false, error: "targetId required" }, { status: 400 });

    const [iBlocked, theyBlocked] = await Promise.all([
      (prisma as any).block.findUnique({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetId } } }),
      (prisma as any).block.findUnique({ where: { blockerId_blockedId: { blockerId: targetId, blockedId: user.id } } }),
    ]);

    return NextResponse.json({ success: true, data: { iBlockedThem: !!iBlocked, theyBlockedMe: !!theyBlocked } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { targetId } = await req.json();
    if (!targetId) return NextResponse.json({ success: false, error: "targetId required" }, { status: 400 });
    if (targetId === user.id) return NextResponse.json({ success: false, error: "Cannot block yourself" }, { status: 400 });

    await (prisma as any).block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetId } },
      update: {},
      create: { blockerId: user.id, blockedId: targetId },
    });

    // Уведомляем обоих участников в реальном времени
    pusherServer.trigger(`user-${user.id}`, "block-update", {
      targetId,
      iBlockedThem: true,
    }).catch(() => {});
    pusherServer.trigger(`user-${targetId}`, "block-update", {
      targetId: user.id,
      theyBlockedMe: true,
    }).catch(() => {});

    return NextResponse.json({ success: true, data: { blocked: true } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { targetId } = await req.json();
    if (!targetId) return NextResponse.json({ success: false, error: "targetId required" }, { status: 400 });

    await (prisma as any).block.deleteMany({ where: { blockerId: user.id, blockedId: targetId } });

    // Уведомляем обоих участников в реальном времени
    pusherServer.trigger(`user-${user.id}`, "block-update", {
      targetId,
      iBlockedThem: false,
    }).catch(() => {});
    pusherServer.trigger(`user-${targetId}`, "block-update", {
      targetId: user.id,
      theyBlockedMe: false,
    }).catch(() => {});

    return NextResponse.json({ success: true, data: { blocked: false } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
