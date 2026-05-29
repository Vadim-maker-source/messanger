import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/app/lib/api/user";
import { checkRateLimit, rateLimited } from "@/app/lib/rate-limit";
import { LIMITS, asEmail, badRequest, errorResponse } from "@/app/lib/validate";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;

export async function POST(request: NextRequest) {
  try {
    // Жёсткий rate limit: 3 регистрации в минуту, 10 в час с одного IP
    const minRl = checkRateLimit(request, "register-min", { limit: 3, windowMs: 60_000 });
    if (!minRl.ok) return rateLimited(minRl);
    const hourRl = checkRateLimit(request, "register-hour", { limit: 10, windowMs: 3_600_000 });
    if (!hourRl.ok) return rateLimited(hourRl);

    const body = await request.json().catch(() => ({}));
    const email = asEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";

    if (!email) return badRequest("Некорректный email");
    if (password.length < LIMITS.PASSWORD_MIN || password.length > LIMITS.PASSWORD_MAX) {
      return badRequest(`Пароль должен быть от ${LIMITS.PASSWORD_MIN} до ${LIMITS.PASSWORD_MAX} символов`);
    }
    if (!USERNAME_REGEX.test(username)) {
      return badRequest("Username: только латиница, цифры, _, от 3 до 32 символов");
    }
    if (displayName.length === 0 || displayName.length > LIMITS.PROFILE_NAME) {
      return badRequest(`Имя должно быть от 1 до ${LIMITS.PROFILE_NAME} символов`);
    }

    const result = await registerUser({ email, password, username, displayName });

    return NextResponse.json(
      { success: true, userId: result.userId },
      { headers: corsHeaders }
    );
  } catch (e: any) {
    // registerUser может бросать понятные ошибки (email уже занят и т.п.)
    const msg = e?.message || "Registration failed";
    // Не возвращаем стектрейс / Prisma детали
    if (msg.includes("Unique constraint") || msg.includes("already")) {
      return badRequest("Email или username уже заняты");
    }
    if (msg.length < 200) {
      return NextResponse.json(
        { success: false, error: msg },
        { status: 400, headers: corsHeaders }
      );
    }
    return errorResponse(e, "register");
  }
}
