import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { jwtVerify } from "jose";
import { env } from "./lib/env.js";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user: { id: string; email: string; name: string; shareToken: string } | null;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  let user: TrpcContext["user"] = null;
  try {
    const cookie = opts.req.headers.get("cookie") || "";
    const tokenMatch = cookie.match(/auth_token=([^;]+)/);
    const token = tokenMatch?.[1];
    if (token) {
      const secret = new TextEncoder().encode(env.jwtSecret);
      const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });
      if (
        payload.sub &&
        payload.email &&
        payload.name &&
        payload.shareToken
      ) {
        user = {
          id: payload.sub as string,
          email: payload.email as string,
          name: payload.name as string,
          shareToken: payload.shareToken as string,
        };
      }
    }
  } catch {
    // ignore invalid token
  }
  return { req: opts.req, resHeaders: opts.resHeaders, user };
}
