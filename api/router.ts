import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./routers/auth";
import { tradeRouter, journalRouter } from "./routers/trade";
import { friendRouter } from "./routers/friend";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  trade: tradeRouter,
  journal: journalRouter,
  friend: friendRouter,
});

export type AppRouter = typeof appRouter;
