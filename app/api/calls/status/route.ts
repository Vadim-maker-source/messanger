import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/api/user";

export const dynamic = "force-dynamic";

type Body = {
  callId: string;
  status: "ACTIVE" | "ENDED" | "DECLINED";
};

const ALLOWED_STATUSES = new Set(["ACTIVE", "ENDED", "DECLINED"]);

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Partial<Body>;
    const callId = String(body.callId || "").trim();
    const status = String(body.status || "").trim().toUpperCase();

    if (!callId || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const streamCallId = `default:${callId}`;
    const call = await prisma.call.findFirst({
      where: {
        streamCallId,
        chat: { users: { some: { id: user.id } } },
      },
      select: { id: true },
    });

    if (!call) {
      return NextResponse.json({ message: "Call not found" }, { status: 404 });
    }

    const updated = await prisma.call.update({
      where: { id: call.id },
      data: { status: status as Body["status"] },
      select: { id: true, status: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Failed to update call status" },
      { status: 500 },
    );
  }
}
