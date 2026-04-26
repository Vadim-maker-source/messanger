// app/api/mobile/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import { generateToken } from "@/app/lib/token";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user || !user.hashedPassword) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }
    
    const isValid = await bcrypt.compare(password, user.hashedPassword);
    
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }
    
    // Генерируем токен используя NEXTAUTH_SECRET
    const token = generateToken(user.id, user.email);
    
    const { hashedPassword, ...userWithoutPassword } = user;
    
    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      token: token,
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}