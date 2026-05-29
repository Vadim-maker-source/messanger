import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
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
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
      }
      return session;
    }
  },
  // debug в production даёт подробный лог в консоль сервера — где именно
  // cookie не ставится / не читается. Уберём после диагностики.
  debug: process.env.NEXTAUTH_DEBUG === "true",
  secret: process.env.NEXTAUTH_SECRET,
};