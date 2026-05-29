import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { generateToken } from "@/app/lib/token";
import { checkRateLimit, rateLimited } from "@/app/lib/rate-limit";
import { asEmail, badRequest, errorResponse } from "@/app/lib/validate";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 попыток в минуту, 20 в час с одного IP
    const minRl = checkRateLimit(request, "login-min", { limit: 5, windowMs: 60_000 });
    if (!minRl.ok) return rateLimited(minRl);
    const hourRl = checkRateLimit(request, "login-hour", { limit: 20, windowMs: 3_600_000 });
    if (!hourRl.ok) return rateLimited(hourRl);

    const body = await request.json().catch(() => ({}));
    const email = asEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password || password.length > 200) {
      // Generic ошибка, не раскрывает существует ли email
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        hashedPassword: true,
      },
    });

    // Защита от timing-атак: всегда проверяем пароль (даже если user не найден)
    const dummyHash = "$2a$12$dummyHashToPreventTimingAttacks0123456789abcdefghi";
    const passwordToCheck = user?.hashedPassword || dummyHash;
    const isValid = await bcrypt.compare(password, passwordToCheck);

    if (!user || !user.hashedPassword || !isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = generateToken(user.id, user.email);

    // Возвращаем только нужные поля — никаких автоматических spread'ов
    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          status: user.status,
        },
        token,
      },
      { headers: corsHeaders }
    );
  } catch (e) {
    return errorResponse(e, "login");
  }
}
