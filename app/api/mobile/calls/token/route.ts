import { NextRequest, NextResponse } from "next/server";
import { StreamClient } from "@stream-io/node-sdk";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ success: false, error: "Stream not configured" }, { status: 500 });
    }

    const client = new StreamClient(apiKey, apiSecret);
    const token = client.generateUserToken({
      user_id: user.id,
      validity_in_seconds: 60 * 60 * 4,
    });

    return NextResponse.json({ success: true, token, apiKey });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
