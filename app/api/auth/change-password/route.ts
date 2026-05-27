import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/app/lib/api/user";
import { prisma } from "@/app/lib/prisma";

/**
 * POST /api/auth/change-password
 * Меняет пароль текущего пользователя.
 * Принимает: { oldPassword, newPassword, forgot?: boolean }
 *
 * При forgot=true старый пароль не проверяется (требуется предварительное
 * подтверждение через 2FA push-код на стороне клиента).
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { oldPassword, newPassword, forgot } = await request.json();

    if (!newPassword) {
      return NextResponse.json(
        { success: false, error: "newPassword is required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "Пароль должен быть не короче 6 символов" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { hashedPassword: true },
    });

    if (!user?.hashedPassword) {
      return NextResponse.json(
        { success: false, error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    if (!forgot) {
      if (!oldPassword) {
        return NextResponse.json(
          { success: false, error: "Введите текущий пароль" },
          { status: 400 }
        );
      }
      const isValid = await bcrypt.compare(oldPassword, user.hashedPassword);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: "Старый пароль неверный" },
          { status: 400 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
