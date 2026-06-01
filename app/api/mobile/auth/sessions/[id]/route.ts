import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { socketServer } from "@/app/lib/socket-server";

/** DELETE /api/mobile/auth/sessions/[id] — отозвать сессию (soft-delete) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
    }
    if (session.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    // Сигнал в реальном времени всем устройствам этого юзера —
    // отозванная веб-сессия мгновенно вылогинится при получении события.
    // Передаём id и tokenHash чтобы клиент мог точно идентифицировать "свою" сессию.
    socketServer
      .trigger(`user-${user.id}`, "session-revoked", {
        sessionId: id,
        tokenHash: session.tokenHash,
      })
      .catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[sessions/delete] error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
