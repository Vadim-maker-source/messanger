import { NextRequest, NextResponse } from "next/server";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { uploadChatImage } from "@/app/lib/yandex-storage";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ success: false, error: "No file" }, { status: 400 });

    const result = await uploadChatImage(formData);
    if (!result) return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });

    return NextResponse.json({ success: true, url: result.url, fileName: result.fileName });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
