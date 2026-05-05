import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";

const app = new Hono<{ Bindings: HttpBindings }>();

// Removed bodyLimit because it consumes the request stream, 
// causing tRPC to crash with "stream already read" on Vercel.

app.use("/api/trpc/*", async (c) => {
  try {
    return await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext,
    });
  } catch (e: any) {
    console.error("tRPC Error:", e);
    return c.json({ success: false, error: e.message || "Internal Server Error" }, 500);
  }
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// Global safety net
app.onError((err, c) => {
  console.error("Hono Global Error:", err);
  return c.json({ success: false, error: err.message }, 500);
});

export default app;