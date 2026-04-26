import { NextResponse } from "next/server";
import { getCurrentUser, updateUserHeartbeat } from "@/app/lib/api/user";

export async function POST() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await updateUserHeartbeat(currentUser.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in heartbeat:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}