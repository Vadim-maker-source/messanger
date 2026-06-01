import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { Adapter } from "next-auth/adapters";

// HTTPS = secure cookies, HTTP = обычные. Без Secure-флага cookie работает на
// любом домене / IP-адресе через HTTP, что нужно для 194.87.201.226 без TLS.
const useSecureCookies = (process.env.NEXTAUTH_URL || "").startsWith("https://");
const cookiePrefix = useSecureCookies ? "__Secure-" : "";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 дней
  },
  // Явно указываем cookies чтобы не зависеть от автоматики NextAuth, которая
  // на HTTP может ставить Secure-флаг и cookie не сохранится.
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: `${useSecureCookies ? "__Host-" : ""}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Нужны email и пароль');
        }

        const email = credentials.email.trim();

        // Поиск без учёта регистра
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (!user || !user.hashedPassword) {
          throw new Error('Неверный email или пароль');
        }

        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isPasswordCorrect) {
          throw new Error('Неверный email или пароль');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          username: user.username,
        };
      }
    }),
    // ── QR-провайдер: вход без пароля по подтверждённому QR-токену ────
    CredentialsProvider({
      id: "qr",
      name: "qr",
      credentials: {
        token: { label: "QR Token", type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.token;
        if (!token) throw new Error("Нет токена");

        const attempt = await prisma.qrLoginAttempt.findUnique({
          where: { token },
        });

        if (!attempt) throw new Error("QR-код не найден");
        if (attempt.status !== "APPROVED") throw new Error("QR-код не подтверждён");
        if (!attempt.userId) throw new Error("Нет пользователя");
        if (attempt.expiresAt < new Date()) throw new Error("QR-код просрочен");

        const user = await prisma.user.findUnique({
          where: { id: attempt.userId },
        });
        if (!user) throw new Error("Пользователь не найден");

        // Помечаем токен как использованный — нельзя залогиниться второй раз
        await prisma.qrLoginAttempt.delete({ where: { token } });

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        // Уникальный идентификатор этой сессии — храним в JWT.
        // Используется чтобы привязать НА КАЖДУЮ выпущенную куку
        // отдельную запись в таблице Session. Удаление этой записи
        // даёт возможность дистанционно завершить сессию на конкретном устройстве.
        token.sid = randomBytes(16).toString("hex");
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        (session as any).sid = token.sid as string;
      }
      return session;
    }
  },
  // debug в production даёт подробный лог в консоль сервера — где именно
  // cookie не ставится / не читается. Уберём после диагностики.
  debug: process.env.NEXTAUTH_DEBUG === "true",
  secret: process.env.NEXTAUTH_SECRET,
};