// app/api/mobile/auth/check-users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        hashedPassword: true,
      },
      take: 5,
    });

    const usersInfo = users.map(user => ({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      hasPassword: !!user.hashedPassword,
      passwordLength: user.hashedPassword?.length || 0,
      passwordStartsWith: user.hashedPassword?.substring(0, 7) || 'none',
      isBcryptHash: user.hashedPassword?.startsWith('$2') || false,
    }));

    return NextResponse.json({
      success: true,
      count: users.length,
      users: usersInfo,
    });

  } catch (error: any) {
    console.error("Check users error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
