import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const callId = request.nextUrl.searchParams.get("callId");
    if (!callId) {
      return NextResponse.json({ success: false, error: "callId is required" }, { status: 400 });
    }

    const call = await prisma.call.findFirst({
      where: { streamCallId: callId },
      select: { offerSdp: true, status: true },
    });

    if (!call || call.status !== "RINGING" || !call.offerSdp) {
      return NextResponse.json({ success: false, hasOffer: false });
    }

    return NextResponse.json({ success: true, hasOffer: true, sdp: call.offerSdp });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get offer" },
      { status: 500 },
    );
  }
}
