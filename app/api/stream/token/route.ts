import { NextResponse } from "next/server";
import { StreamClient } from "@stream-io/node-sdk";
import { getCurrentUser } from "@/app/lib/api/user";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { message: "STREAM env vars are not configured" },
        { status: 500 },
      );
    }

    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const client = new StreamClient(apiKey, apiSecret);
    const token = client.generateUserToken({
      user_id: user.id,
      validity_in_seconds: 60 * 60 * 4, // 4h
    });

    return NextResponse.json({ token });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Failed to create token" },
      { status: 500 },
    );
  }
}

