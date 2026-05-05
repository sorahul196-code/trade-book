import { createRouter, publicQuery } from "./middleware.js";
import { authRouter } from "./routers/auth.js";
import { tradeRouter, journalRouter } from "./routers/trade.js";
import { friendRouter } from "./routers/friend.js";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  trade: tradeRouter,
  journal: journalRouter,
  friend: friendRouter,
});

export type AppRouter = typeof appRouter;
