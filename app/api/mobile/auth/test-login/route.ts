// app/api/mobile/auth/test-login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    console.log("=== LOGIN DEBUG ===");
    console.log("Email:", email);
    console.log("Password length:", password?.length);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    console.log("User found:", !!user);
    console.log("User has password:", !!user?.hashedPassword);

    if (!user) {
      return NextResponse.json({
        success: false,
        error: "User not found",
        debug: { email, userExists: false }
      }, { status: 404 });
    }

    if (!user.hashedPassword) {
      return NextResponse.json({
        success: false,
        error: "User has no password set",
        debug: { email, hasPassword: false }
      }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);
    console.log("Password valid:", isValid);

    if (!isValid) {
      // Попробуем также проверить без хеширования (если пароль был сохранен в открытом виде)
      const isPlainMatch = password === user.hashedPassword;
      console.log("Plain password match:", isPlainMatch);

      return NextResponse.json({
        success: false,
        error: "Invalid password",
        debug: {
          email,
          passwordProvided: true,
          bcryptMatch: isValid,
          plainMatch: isPlainMatch,
          hashLength: user.hashedPassword.length
        }
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: "Login would succeed",
      debug: {
        userId: user.id,
        email: user.email,
        username: user.username
      }
    });

  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
