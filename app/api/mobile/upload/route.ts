import { NextRequest } from "next/server";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { uploadChatImage } from "@/app/lib/yandex-storage";
import { unauthorized, badRequest, errorResponse } from "@/app/lib/validate";
import { checkRateLimit, rateLimited } from "@/app/lib/rate-limit";
import { NextResponse } from "next/server";

// До 200 МБ файлы — даём 5 минут на загрузку с медленной сети
export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileUserFromRequest(req);
    if (!user) return unauthorized();

    // Rate limit: 30 загрузок за минуту с одного юзера
    const rl = checkRateLimit(req, "upload", { limit: 30, windowMs: 60_000 }, user.id);
    if (!rl.ok) return rateLimited(rl);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) return badRequest("Файл не передан");

    let result;
    try {
      result = await uploadChatImage(formData);
    } catch (e: any) {
      // Validation errors — возвращаем 400, не 500
      return badRequest(e?.message || "Ошибка загрузки");
    }

    if (!result) return badRequest("Ошибка загрузки");
    return NextResponse.json({ success: true, url: result.url, fileName: result.fileName });
  } catch (e) {
    return errorResponse(e, "upload");
  }
}
