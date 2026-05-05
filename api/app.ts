import { Hono } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";

const app = new Hono();

// Changed from app.use to app.all for proper endpoint termination
app.all("/api/trpc/*", async (c) => {
  try {
    return await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext,
    });
  } catch (e: any) {
    console.error("tRPC Error:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  console.error("Hono Global Error:", err);
  return c.json({ success: false, error: err.message }, 500);
});

export default app;