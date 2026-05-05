import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "../middleware.js";
import {
  findUserByEmail,
  createUser,
} from "../lib/sheets-queries.js";
import { SignJWT } from "jose";
import { env } from "../lib/env.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function setAuthCookie(token: string) {
  const secure = env.isProduction ? "Secure; SameSite=None" : "SameSite=Lax";
  return `auth_token=${token}; HttpOnly; Path=/; Max-Age=2592000; ${secure}`;
}

function clearAuthCookie() {
  const secure = env.isProduction ? "Secure; SameSite=None" : "SameSite=Lax";
  return `auth_token=; HttpOnly; Path=/; Max-Age=0; ${secure}`;
}

async function createToken(user: { id: string; email: string; name: string; shareToken: string }) {
  const secret = new TextEncoder().encode(env.jwtSecret);
  return new SignJWT({ email: user.email, name: user.name, shareToken: user.shareToken })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export const authRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await findUserByEmail(input.email);
      if (existing) {
        return { success: false, error: "Email already registered" } as const;
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      const id = crypto.randomUUID();
      const shareToken = crypto.randomBytes(16).toString("hex");
      const createdAt = new Date().toISOString();

      const user = await createUser({
        id,
        email: input.email,
        passwordHash,
        name: input.name,
        shareToken,
        createdAt,
      });

      const token = await createToken({
        id: user.id,
        email: user.email,
        name: user.name,
        shareToken: user.shareToken,
      });

      ctx.resHeaders.append("Set-Cookie", setAuthCookie(token));
      return { success: true, user: { id: user.id, email: user.email, name: user.name, shareToken: user.shareToken } } as const;
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user = await findUserByEmail(input.email);
      if (!user) {
        return { success: false, error: "Invalid email or password" } as const;
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        return { success: false, error: "Invalid email or password" } as const;
      }
      const token = await createToken({
        id: user.id,
        email: user.email,
        name: user.name,
        shareToken: user.shareToken,
      });
      ctx.resHeaders.append("Set-Cookie", setAuthCookie(token));
      return { success: true, user: { id: user.id, email: user.email, name: user.name, shareToken: user.shareToken } } as const;
    }),

  me: authedQuery.query(async ({ ctx }) => {
    return { user: ctx.user };
  }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    ctx.resHeaders.append("Set-Cookie", clearAuthCookie());
    return { success: true };
  }),
});
